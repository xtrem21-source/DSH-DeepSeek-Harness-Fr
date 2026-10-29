// Module client du micro DSH — source de verite de ce paquet.
//
// Base : open-cowork-micro (PATCH-VOIX/voice-input.js), adapte a DSH Desktop :
//   - findInput : contenteditable en priorite
//   - findSubmitButton : aria-label quand il n'y a pas de form
//   - insertText : gestion du contenteditable
//   - init : contenteditable accepte comme zone de saisie
//   - panneau : consigne de cle adaptee a DSH
//   - bouton : monte dans l'emplacement React `conversation.input.activity`
//     (et non insere dans le DOM du composeur, que React detruisait a chaque
//     envoi : c'etait la cause de la disparition du micro)
//   - writeInput : remplacement du texte dans un contenteditable Lexical
//
// L'ancien generateur outils/adapter-voice-input.mjs a servi a produire la
// premiere version ; ce fichier est desormais tenu a la main. Le patcher verifie
// sa syntaxe et ses marqueurs avant de le copier dans le profil.
window.__ModuleLoader__.load({
  id: 'dsh-voice-input',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    function apply(ctx) {
/* open-cowork-voice-input v2 — saisie vocale (transcription Gemini) pour Open Cowork
 * Ajoute un bouton micro ancré DANS la barre de saisie du chat (il suit donc le
 * redimensionnement et le déplacement de la fenêtre) : enregistre votre voix,
 * l'envoie à l'API Gemini pour transcription, puis insère le texte dans le champ de saisie.
 * Aucune dépendance, aucun paquet à installer. La clé API reste en local (localStorage).
 *
 * v2 : bouton ancré dans le conteneur du champ de saisie (au lieu de position:fixed) ;
 *      modèle par défaut mis à jour (gemini-3.5-flash-lite) ;
 *      réinsertion automatique via MutationObserver après réaffichage React ;
 *      repli sur position:fixed si le conteneur n'est pas trouvé.
 */
(function () {
  'use strict';
  if (window.__ocVoice) return;
  window.__ocVoice = { version: 2 };

  var LS = {
    key: 'ocVoice.geminiKey',
    prov: 'ocVoice.provider',
    elevenKey: 'ocVoice.elevenKey',
    model: 'ocVoice.model',
    lang: 'ocVoice.lang',
    pos: 'ocVoice.pos',
    auto: 'ocVoice.autoInsert',
    // Envoi automatique par mot-cle : si la transcription se termine par un
    // mot-cle ("envoie", "envoyer"...), le message est envoye tout seul.
    // DESACTIVE par defaut ('0') => comportement d'origine inchange.
    sendKw: 'ocVoice.sendKeyword'
  };
  // Mots-cles de fin (FRANCAIS uniquement) : s'ils sont le dernier mot de la
  // transcription, on les retire du texte. Le declenchement de l'envoi ne
  // depend PLUS du mot-cle : la case "envoi automatique" decide a elle seule.
  // Le mot-cle sert seulement a nettoyer le texte quand on l'a prononce.
  // Comparaison insensible casse/accents/ponctuation.
  var SEND_KEYWORDS = [
    'envoie', 'envoies', 'envoyer', 'envoi', 'enver', 'envoit', 'envoyez'
  ];
  // Expression reguliere des homophones du mot-cle, y compris la forme
  // DECOUPEE "en voie" (le modele separe parfois le mot en deux) : on la
  // recolle avant comparaison.
  var SPLIT_KEYWORD_RE = /\ben[-\s]+voi(?:e|es|er|t)?\b/gi;
  var DEFAULT_MODEL = 'gemini-3.5-flash-lite';
  // Modeles Gemini retires/indisponibles pour les nouveaux comptes : s'ils sont
  // stockes dans localStorage (anciens reglages), on les migre automatiquement
  // vers le modele par defaut actuel.
  var DEAD_MODELS = [
    'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite',
    'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.0-pro',
    'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'
  ];
  var MAX_MS = 180000; // 3 minutes maximum
  var LANGS = [
    ['auto', 'Détection automatique'],
    ['fr', 'Français'],
    ['en', 'Anglais'],
    ['es', 'Espagnol'],
    ['de', 'Allemand'],
    ['it', 'Italien'],
    ['pt', 'Portugais'],
    ['nl', 'Néerlandais'],
    ['ar', 'Arabe'],
    ['zh', 'Chinois'],
    ['ru', 'Russe']
  ];
  var LANG_NAMES = {};
  LANGS.forEach(function (l) { LANG_NAMES[l[0]] = l[1].toLowerCase(); });

  var st = {
    recording: false,
    busy: false,
    recorder: null,
    chunks: [],
    startedAt: 0,
    tick: null,
    stream: null,
    ui: null,
    anchored: false,     // true si le bouton est inséré dans la barre de saisie
    slot: false,         // true si React a monté le bouton (plus d'ancrage DOM)
    overlayParent: null, // parent utilisé pour le repli (position:fixed)
    observer: null
  };

  // Journalisation double : console du renderer + fichier de logs de l'application
  // (via electronAPI.logs.write) afin de pouvoir diagnostiquer ce qui se passe.
  var LOG_PREFIX = '[Saisie vocale]';
  function toStr(v) {
    if (v instanceof Error) return v.name + ': ' + v.message + (v.stack ? ' | ' + v.stack.split('\n')[1] : '');
    if (typeof v === 'object' && v !== null) { try { return JSON.stringify(v); } catch (e) { return String(v); } }
    return String(v);
  }
  var LOG_BUFFER_KEY = 'ocVoice.log';
  function flog(level) {
    var args = [].slice.call(arguments, 1);
    var text = args.map(toStr).join(' ');
    var line = new Date().toISOString().substr(11, 8) + ' [' + level + '] ' + text;
    try { console.log.apply(console, [LOG_PREFIX].concat(args)); } catch (e) {}
    // 1) fichier de logs de l'application (si le canal IPC est disponible)
    try {
      var api = window.electronAPI;
      if (api && api.logs && typeof api.logs.write === 'function') {
        var lvl = (level === 'error' || level === 'warn') ? level : 'info';
        // ATTENTION : le handler main fait `console[level](...args)` : le 2e
        // parametre doit etre un TABLEAU de messages (pas une chaine), sinon
        // il est "spread" caractere par caractere.
        api.logs.write(lvl, [LOG_PREFIX + ' ' + text]);
      }
    } catch (e) {}
    // 2) tampon localStorage (lisible depuis l'exterieur, meme si l'IPC echoue)
    try {
      var buf = localStorage.getItem(LOG_BUFFER_KEY) || '';
      var lines = buf ? buf.split('\n') : [];
      lines.push(line);
      if (lines.length > 120) lines = lines.slice(lines.length - 120);
      localStorage.setItem(LOG_BUFFER_KEY, lines.join('\n'));
    } catch (e) {}
  }
  function log() { flog.apply(null, ['info'].concat([].slice.call(arguments))); }
  function logWarn() { flog.apply(null, ['warn'].concat([].slice.call(arguments))); }
  function logErr() { flog.apply(null, ['error'].concat([].slice.call(arguments))); }
  function ls(key, def) {
    try { var v = localStorage.getItem(key); return v === null ? def : v; } catch (e) { return def; }
  }
  function setLs(key, value) {
    try { localStorage.setItem(key, value); } catch (e) {}
  }

  // Lit le modele enregistre et migre automatiquement les modeles retires.
  function resolveModel() {
    var m = (ls(LS.model, '') || '').trim();
    var lower = m.toLowerCase();
    var dead = DEAD_MODELS.some(function (d) { return lower.indexOf(d) === 0; });
    if (!m || dead) {
      if (dead) log('modele "' + m + '" retire -> migration vers ' + DEFAULT_MODEL);
      else log('aucun modele enregistre -> utilisation de ' + DEFAULT_MODEL);
      setLs(LS.model, DEFAULT_MODEL); // corriger le stockage pour de bon
      return DEFAULT_MODEL;
    }
    return m;
  }

  /* ---------- styles ---------- */
  function injectStyles() {
    if (document.getElementById('ocVoiceStyles')) return;
    var css = '' +
      '#ocVoiceRoot{position:fixed;z-index:2147483000;display:flex;flex-direction:column;align-items:flex-end;gap:6px;font-family:inherit}' +
      '#ocVoiceRoot *{box-sizing:border-box}' +
      // bouton ancre dans la barre de saisie, JUSTE A DROITE de la fleche d'envoi.
      // Il respecte le flex du groupe (align-items:center) et la taille w-9 h-9.
      '#ocVoiceAnchor{display:inline-flex;align-items:center;justify-content:center;margin:0;flex:0 0 auto}' +
      '#ocVoiceAnchor .ocv-btn{width:36px;height:36px}' +
      '#ocVoiceAnchor .ocv-btn svg{width:17px;height:17px}' +
      // Variante montée par React dans conversation.input.activity : compacte,
      // sans ombre, alignée sur les autres boutons de la barre.
      // Variante montée par React dans conversation.input.activity : mêmes
      // dimensions que la flèche d'envoi (34 px), sans ombre.
      // Spécificité doublée (.ocv-btn.ocv-btn-inline) : la règle .ocv-btn
      // ci-dessous, plus générale, ne doit pas reprendre le dessus.
      '.ocv-btn.ocv-btn-inline{width:34px;height:34px;border-radius:999px;box-shadow:none;background:transparent;border:1px solid transparent}' +
      '.ocv-btn.ocv-btn-inline:hover{background:var(--color-surface-hover, #2a2723);border-color:var(--color-border, #34302a)}' +
      '.ocv-btn.ocv-btn-inline svg{width:16px;height:16px}' +
      '.ocv-btn{width:44px;height:44px;border-radius:9999px;border:1px solid var(--color-border, #34302a);' +
      'background:var(--color-surface, #22201d);color:var(--color-text-primary, #f1ece4);display:flex;align-items:center;' +
      'justify-content:center;cursor:pointer;box-shadow:var(--shadow-elevated, 0 8px 24px rgba(0,0,0,.34));' +
      'transition:background .15s,border-color .15s,transform .15s;padding:0;touch-action:none}' +
      '.ocv-btn:hover{background:var(--color-surface-hover, #2a2723)}' +
      '.ocv-btn:active{transform:scale(.96)}' +
      '.ocv-btn[data-rec="1"]{background:var(--color-error, #ef4444);border-color:var(--color-error, #ef4444);color:#fff;' +
      'animation:ocvPulse 1.4s ease-in-out infinite}' +
      '.ocv-btn[data-busy="1"]{opacity:.7;cursor:progress}' +
      '.ocv-btn svg{width:20px;height:20px;display:block}' +
      '.ocv-gear{width:26px;height:26px;border-radius:9999px;border:1px solid var(--color-border-subtle, rgba(255,245,232,.07));' +
      'background:var(--color-surface, #22201d);color:var(--color-text-muted, #8c8378);display:flex;align-items:center;' +
      'justify-content:center;cursor:pointer;box-shadow:var(--shadow-soft, 0 1px 4px rgba(0,0,0,.24));padding:0}' +
      '.ocv-gear:hover{color:var(--color-text-primary, #f1ece4);background:var(--color-surface-hover, #2a2723)}' +
      '.ocv-gear svg{width:13px;height:13px}' +
      '.ocv-bubble{max-width:320px;padding:7px 11px;border-radius:12px;font-size:12px;line-height:1.45;' +
      'background:var(--color-surface, #22201d);color:var(--color-text-secondary, #b6ada2);' +
      'border:1px solid var(--color-border-muted, #2a2722);box-shadow:var(--shadow-elevated, 0 8px 24px rgba(0,0,0,.34));' +
      'white-space:pre-wrap;word-break:break-word;display:none}' +
      '.ocv-bubble[data-kind="error"]{border-color:var(--color-error, #ef4444);color:var(--color-error, #ef4444)}' +
      '.ocv-bubble[data-kind="ok"]{border-color:var(--color-success, #22c55e);color:var(--color-success, #22c55e)}' +
      '.ocv-spin{width:13px;height:13px;border-radius:9999px;border:2px solid currentColor;border-top-color:transparent;' +
      'display:inline-block;vertical-align:-2px;animation:ocvSpin .7s linear infinite;margin-right:6px}' +
      '@keyframes ocvSpin{to{transform:rotate(360deg)}}' +
      '@keyframes ocvPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.55)}50%{box-shadow:0 0 0 10px rgba(239,68,68,0)}}' +
      '.ocv-panel{width:326px;padding:14px;border-radius:16px;background:var(--color-background-secondary, #1d1b18);' +
      'border:1px solid var(--color-border, #34302a);box-shadow:var(--shadow-elevated, 0 8px 24px rgba(0,0,0,.34));display:none}' +
      '.ocv-panel h4{margin:0 0 10px;font-size:13px;font-weight:600;color:var(--color-text-primary, #f1ece4)}' +
      '.ocv-panel label{display:block;font-size:11px;color:var(--color-text-muted, #8c8378);margin:9px 0 4px}' +
      '.ocv-panel input[type=text],.ocv-panel input[type=password],.ocv-panel select{width:100%;padding:7px 9px;font-size:12px;' +
      'border-radius:9px;border:1px solid var(--color-border, #34302a);background:var(--color-surface, #22201d);' +
      'color:var(--color-text-primary, #f1ece4);outline:none}' +
      '.ocv-panel input:focus,.ocv-panel select:focus{border-color:var(--color-accent, #d67a52)}' +
      '.ocv-panel .ocv-row{display:flex;gap:8px;align-items:center;margin-top:10px}' +
      '.ocv-panel .ocv-hint{font-size:11px;color:var(--color-text-muted, #8c8378);margin-top:6px;line-height:1.45}' +
      '.ocv-panel .ocv-hint a{color:var(--color-accent, #d67a52);cursor:pointer;text-decoration:underline}' +
      '.ocv-primary{flex:1;padding:7px 10px;border-radius:9px;border:1px solid var(--color-accent, #d67a52);' +
      'background:var(--color-accent, #d67a52);color:#fff;font-size:12px;cursor:pointer}' +
      '.ocv-secondary{padding:7px 10px;border-radius:9px;border:1px solid var(--color-border, #34302a);' +
      'background:transparent;color:var(--color-text-secondary, #b6ada2);font-size:12px;cursor:pointer}' +
      '.ocv-check{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--color-text-secondary, #b6ada2);margin-top:10px}' +
      '.ocv-status{font-size:11px;margin-top:9px;line-height:1.45;color:var(--color-text-muted, #8c8378);min-height:14px}' +
      '.ocv-status[data-kind="ok"]{color:var(--color-success, #22c55e)}' +
      '.ocv-status[data-kind="error"]{color:var(--color-error, #ef4444)}' +
      '.ocv-wide{flex:1}';
    var el = document.createElement('style');
    el.id = 'ocVoiceStyles';
    el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  var ICONS = {
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.3a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15H4.4a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11.5 4.6V4.4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1z"/></svg>'
  };

  /* ---------- interface ---------- */
  function panelHtml() {
    var opts = LANGS.map(function (l) {
      return '<option value="' + l[0] + '">' + l[1] + '</option>';
    }).join('');
    return '' +
      '<h4>Saisie vocale</h4>' +
      '<label>Fournisseur de transcription</label>' +
      '<select id="ocvProv">' +
      '<option value="gemini">Gemini (Google)</option>' +
      '<option value="elevenlabs">ElevenLabs — Scribe v2</option>' +
      '</select>' +
      '<span id="ocvGemBloc">' +
      '<label>Clé API Gemini</label>' +
      '<input type="password" id="ocvKey" placeholder="AIza..." autocomplete="off" spellcheck="false">' +
      '<div class="ocv-hint">Clé gratuite sur <a id="ocvKeyLink">aistudio.google.com/apikey</a> — stockée uniquement sur cet ordinateur.</div>' +
      '<label>Modèle de transcription</label>' +
      '<input type="text" id="ocvModel" placeholder="' + DEFAULT_MODEL + '" spellcheck="false">' +
      '</span>' +
      '<span id="ocvElevenBloc">' +
      '<label>Clé API ElevenLabs</label>' +
      '<input type="password" id="ocvElevenKey" placeholder="sk_..." autocomplete="off" spellcheck="false">' +
      '<div class="ocv-hint">Clé gratuite sur <a id="ocvElevenLink">elevenlabs.io/app/settings/api-keys</a> — modèle Scribe v2, audio envoyé à ElevenLabs.</div>' +
      '</span>' +
      '<label>Langue parlée</label>' +
      '<select id="ocvLang">' + opts + '</select>' +
      '<label class="ocv-check"><input type="checkbox" id="ocvAuto"> Insérer le texte dans le champ de saisie</label>' +
      '<label class="ocv-check"><input type="checkbox" id="ocvSendKw"> Envoi automatique <span style="opacity:.7">(le message part dès l\'arrêt de l\'enregistrement ; « envoie » en fin de phrase est retiré)</span></label>' +
      '<div class="ocv-row">' +
      '<button type="button" class="ocv-primary" id="ocvSave">Enregistrer</button>' +
      '<button type="button" class="ocv-secondary" id="ocvClose">Fermer</button>' +
      '</div>' +
      '<div class="ocv-row">' +
      '<button type="button" class="ocv-secondary ocv-wide" id="ocvTest">Tester la clé API</button>' +
      '</div>' +
      '<div class="ocv-status" id="ocvStatus"></div>';
  }

  function ensureUi() {
    if (st.ui) return st.ui;
    injectStyles();

    // --- conteneur flottant (bulles + panneau de réglages) : reste en position:fixed ---
    var root = document.createElement('div');
    root.id = 'ocVoiceRoot';
    var bubble = document.createElement('div');
    bubble.className = 'ocv-bubble';
    var panel = document.createElement('div');
    panel.className = 'ocv-panel';
    panel.innerHTML = panelHtml();
    var gear = document.createElement('button');
    gear.type = 'button';
    gear.className = 'ocv-gear';
    gear.title = 'Réglages de la saisie vocale';
    gear.innerHTML = ICONS.gear;
    // La roue est masquee : les reglages s'ouvrent desormais par clic DROIT sur le
    // micro. On la garde dans le DOM (compatibilite) mais elle n'est plus visible.
    gear.style.display = 'none';
    root.appendChild(bubble);
    root.appendChild(panel);
    root.appendChild(gear);
    document.body.appendChild(root);
    positionOverlay(root);

    // --- bouton micro (sera ancré dans la barre de saisie) ---
    var anchor = document.createElement('span');
    anchor.id = 'ocVoiceAnchor';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ocv-btn';
    btn.title = 'Saisie vocale — clic : enregistrer, clic droit : réglages';
    btn.innerHTML = ICONS.mic;
    anchor.appendChild(btn);
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleRecording();
    });
    // Clic DROIT sur le micro : ouvre le panneau de configuration (remplace la roue).
    btn.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });

    st.ui = { root: root, bubble: bubble, panel: panel, gear: gear, btn: btn, anchor: anchor };
    log('ensureUi: interface creee (controleur flottant + bouton micro)');

    // ancrage dès que possible, puis surveillance des réaffichages React
    mountAnchored();
    if (!st.slot && !st.observer && document.body) {
      var obsRetries = 0;
      var obsTimer = null;
      st.observer = new MutationObserver(function () {
        // Le bouton vit dans un slot React : plus rien à surveiller.
        if (st.slot) return;
        // sortir seulement si notre ancre est REELLEMENT connectee au DOM
        // ET toujours placee juste apres la fleche d'envoi.
        var el = document.getElementById('ocVoiceAnchor');
        var submit = findSubmitButton();
        var wellPlaced = !!(el && el.isConnected && submit && submit.nextElementSibling === el);
        if (st.anchored && wellPlaced) return;
        obsRetries++;
        // ne pas inonder les logs : 1 message tous les 20 declenchements
        if (obsRetries === 1 || obsRetries % 20 === 0) {
          log('MutationObserver: reancrage (declenchement n°' + obsRetries + ', ancre connectee=' + !!(el && el.isConnected) + ')');
        }
        // Regrouper les mutations d'un meme rendu : sans cela, chaque insertion
        // de notre propre ancre declenchait un nouveau passage en boucle.
        if (obsTimer) return;
        obsTimer = setTimeout(function () { obsTimer = null; mountAnchored(); }, 80);
      });
      st.observer.observe(document.body, { childList: true, subtree: true });
      log('MutationObserver actif (surveillance des re-rendus React)');
    }

    // Roue masquee : plus d'ecouteur de clic (les reglages s'ouvrent par clic droit sur le micro).
    panel.querySelector('#ocvSave').addEventListener('click', saveSettings);
    panel.querySelector('#ocvClose').addEventListener('click', function () { panel.style.display = 'none'; });
    panel.querySelector('#ocvTest').addEventListener('click', testApiKey);
    panel.querySelector('#ocvProv').addEventListener('change', function () {
      setLs(LS.prov, this.value);
      applyProviderUi();
      log('fournisseur: ' + this.value);
    });
    panel.querySelector('#ocvElevenKey').addEventListener('change', function () {
      setLs(LS.elevenKey, this.value.trim());
      log('cle ElevenLabs enregistree (longueur ' + this.value.trim().length + ')');
    });
    function ouvrirLien(id, url) {
      var a = panel.querySelector(id);
      if (!a) return;
      a.addEventListener('click', function () {
        try {
          if (window.electronAPI && window.electronAPI.openExternal) {
            window.electronAPI.openExternal(url);
            return;
          }
          window.open(url, '_blank');
        } catch (e) {}
      });
    }
    ouvrirLien('#ocvKeyLink', 'https://aistudio.google.com/apikey');
    ouvrirLien('#ocvElevenLink', 'https://elevenlabs.io/app/settings/api-keys');
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.style.display === 'block') panel.style.display = 'none';
    });
    window.addEventListener('resize', function () { positionOverlay(root); });
    return st.ui;
  }

  /** Place le conteneur flottant (bulles/panneau) près du bouton micro, sinon coin bas-droit. */
  function positionOverlay(root) {
    try {
      var btn = st.ui && st.ui.btn;
      if (btn && btn.offsetParent !== null) {
        var r = btn.getBoundingClientRect();
        var right = Math.max(8, window.innerWidth - r.right);
        root.style.right = right + 'px';
        root.style.left = 'auto';
        root.style.bottom = Math.max(8, window.innerHeight - r.top + 8) + 'px';
        root.style.top = 'auto';
        return;
      }
    } catch (e) {}
    root.style.right = '18px';
    root.style.left = 'auto';
    root.style.bottom = '112px';
    root.style.top = 'auto';
  }

  // ---------------------------------------------------------------------------
  //  Ancrage : le micro est place JUSTE A DROITE de la fleche d'envoi, dans la
  //  barre de saisie (meme groupe flex). Ancrage par structure DOM, donc il suit
  //  naturellement la barre et le redimensionnement de la fenetre.
  // ---------------------------------------------------------------------------

  // Trouve le bouton d'envoi (fleche) de la barre de saisie : button[type=submit]
  // situe dans le <form> qui contient notre textarea.
  function findSubmitButton() {
    var area = findInput();
    if (!area) return null;
    // 1) cas d'origine : un <form> avec un bouton submit.
    var form = area.closest && area.closest('form');
    if (form) {
      var parForm = form.querySelector('button[type="submit"]');
      if (parForm) return parForm;
    }
    // 2) DSH Desktop : button[type=button] dont l'aria-label nomme l'envoi.
    //    On n'utilise PAS isVisible ici : il exclut les boutons disabled, or
    //    celui de DSH est desactive tant que le champ de saisie est vide, et
    //    il reste l'ancre a viser. On ne teste donc que la presence visuelle.
    var boutons = [].slice.call(document.querySelectorAll('button')).filter(function (b) {
      return !!b && b.offsetParent !== null;
    });
    var parLabel = boutons.filter(function (b) {
      var etiquette = (b.getAttribute('aria-label') || '') + ' ' + (b.title || '');
      return /envoyer( le)? message|send message|^\s*send\s*$/i.test(etiquette.trim());
    });
    if (parLabel.length) return parLabel[parLabel.length - 1];
    // 3) dernier recours : un bouton submit visible.
    var submits = boutons.filter(function (b) { return b.type === 'submit'; });
    return submits.length ? submits[submits.length - 1] : null;
  }

  // Anti-récurrence : planifie quelques réancrages différés (en ms) tant que la
  // flèche d'envoi n'est pas retrouvée, pour rattraper le re-rendu React qui suit
  // l'envoi d'un message. Sans cela, le micro resterait masqué définitivement.
  function scheduleReanchor(delays) {
    (delays || [250, 700, 1500]).forEach(function (ms) {
      setTimeout(function () {
        var submit = findSubmitButton();
        if (submit && submit.parentElement) { mountAnchored(); return; }
        // pas encore de flèche : on réessaie plus loin si un essai reste planifié.
        mountAnchored();
      }, ms);
    });
  }

  /** Garantit une ancre connectee (recree si elle a ete purgee par React). */
  function ensureAnchorNode() {
    var anchor = st.ui && st.ui.anchor;
    if (anchor && anchor.isConnected) return anchor;
    // React a jete notre noeud : on en refabrique un NEUF (l'ancien est un
    // orphelin detache, inutilisable pour getElementById). On reattache les
    // ecouteurs et on reconsruit l'icone selon l'etat courant.
    log('ensureAnchorNode: ancre purgee par React, recree');
    var span = document.createElement('span');
    span.id = 'ocVoiceAnchor';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ocv-btn';
    btn.title = 'Saisie vocale — clic : enregistrer, clic droit : réglages';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleRecording();
    });
    btn.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });
    span.appendChild(btn);
    if (st.ui) st.ui.anchor = span;
    if (st.ui) st.ui.btn = btn;
    return span;
  }

  /** Insère le micro JUSTE A DROITE de la fleche d'envoi ; repli flottant sinon. */
  function mountAnchored() {
    // React a monté le bouton dans son propre emplacement : plus rien à ancrer.
    if (st.slot) return;
    if (!st.ui) { log('mountAnchored: st.ui absent, abandon'); return; }
    var anchor = ensureAnchorNode();
    // eviter les doublons eventuels (plusieurs ancres dans le DOM)
    var dups = [].slice.call(document.querySelectorAll('#ocVoiceAnchor'));
    for (var i = 0; i < dups.length; i++) {
      if (dups[i] !== anchor && dups[i].isConnected) dups[i].remove();
    }

    var submit = findSubmitButton();
    if (st._lastSubmit !== !!submit) {
      st._lastSubmit = !!submit;
      log('mountAnchored: fleche envoi=' + (submit ? 'TROUVEE' : 'INTROUVABLE'));
    }
    if (submit && submit.parentElement) {
      var group = submit.parentElement; // le groupe de droite (flex items-center gap-2)
      // deja place juste apres la fleche ? rien a faire.
      if (st.anchored && anchor.isConnected && submit.nextElementSibling === anchor) {
        hideAnchor(false);
        return;
      }
      // insérer immédiatement APRES le bouton d'envoi
      try { anchor.remove(); } catch (e) {}
      if (submit.nextSibling) group.insertBefore(anchor, submit.nextSibling);
      else group.appendChild(anchor);
      st.anchored = true;
      hideAnchor(false);
      setBtnState();
      positionOverlay(st.ui.root);
      return;
    }
    // Pas de barre de saisie (ecran d'accueil, autre vue, ou re-rendu en cours) :
    // on MASQUE le micro temporairement, puis on RE-ESSAIE plus tard. Important :
    // React detruit puis recree la barre d'envoi APRES chaque message ; il ne faut
    // PAS laisser le bouton masque pour de bon. On reprogramme donc des essais.
    if (st.anchored) {
      log('mountAnchored: plus de fleche -> bouton masque temporairement, reancrage differe');
      try { anchor.remove(); } catch (e) {}
      st.anchored = false;
    }
    hideAnchor(true);
    scheduleReanchor();
  }

  /**
   * Attache le bouton monté par React (slot conversation.input.activity).
   * C'est le chemin normal dans DSH : le bouton appartient à l'arbre React,
   * donc il survit à chaque rendu du composeur (et donc à chaque envoi).
   */
  function attachButton(el) {
    if (!el) return;
    st.slot = true;
    if (!st.ui) ensureUi();
    var ancien = st.ui.anchor;
    if (ancien && ancien.isConnected) { try { ancien.remove(); } catch (e) {} }
    st.anchored = false;
    st.ui.anchor = null;          // hideAnchor() ne doit plus toucher à React
    st.ui.btn = el;
    if (el.classList) el.classList.add('ocv-btn');
    placerADroite(el, true);
    setBtnState();
    log('bouton micro monté dans la barre de saisie (slot React)');
  }

  /**
   * Disposition Reasonix : le micro passe À DROITE de la flèche d'envoi.
   *
   * Le bouton vit dans l'emplacement conversation.input.activity, dont le
   * conteneur est un frère du bouton d'envoi dans la rangée flex. On déplace ce
   * conteneur avec `order` — sans sortir de l'arbre React, donc sans risquer la
   * disparition. React ne gère pas cette propriété : elle survit aux rendus, et
   * l'effet du composant la repose si le conteneur est recréé.
   */
  function placerADroite(el, actif) {
    try {
      var slot = el.closest ? el.closest('[data-slot="conversation.input.activity"]') : null;
      var conteneur = slot && slot.parentElement;
      if (!conteneur || !conteneur.style) return;
      if (actif) {
        conteneur.style.order = '1';
        conteneur.setAttribute('data-ocv-place', 'droite');
      } else {
        conteneur.style.order = '';
        conteneur.removeAttribute('data-ocv-place');
      }
    } catch (e) {}
  }

  /** Le composant a été démonté par React : on repasse au repli DOM. */
  function detachButton(el) {
    if (!el || !st.ui || st.ui.btn !== el) return;
    placerADroite(el, false);
    st.ui.btn = null;
    st.slot = false;
    // Un nouveau rendu du composeur remontera le bouton ; en attendant, on
    // retente l'ancrage DOM pour ne jamais laisser l'utilisateur sans micro.
    setTimeout(function () { if (!st.slot) mountAnchored(); }, 0);
  }

  /** Cache/affiche l'ancre (et son bouton) sans la detruire. */
  function hideAnchor(hidden) {
    var anchor = st.ui && st.ui.anchor;
    if (!anchor) return;
    try { anchor.style.display = hidden ? 'none' : ''; } catch (e) {}
  }

  function togglePanel() {
    var ui = ensureUi();
    if (ui.panel.style.display === 'block') {
      ui.panel.style.display = 'none';
      return;
    }
    ui.panel.querySelector('#ocvKey').value = ls(LS.key, '');
    ui.panel.querySelector('#ocvElevenKey').value = ls(LS.elevenKey, '');
    ui.panel.querySelector('#ocvProv').value = ls(LS.prov, 'gemini');
    ui.panel.querySelector('#ocvModel').value = resolveModel();
    ui.panel.querySelector('#ocvLang').value = ls(LS.lang, 'fr');
    ui.panel.querySelector('#ocvAuto').checked = ls(LS.auto, '1') === '1';
    ui.panel.querySelector('#ocvSendKw').checked = ls(LS.sendKw, '0') === '1';
    applyProviderUi();
    positionOverlay(ui.root);
    ui.panel.style.display = 'block';
    ui.bubble.style.display = 'none';
  }

  // Un seul fournisseur visible a la fois : Gemini montre sa cle et son modele,
  // ElevenLabs seulement sa cle (le modele scribe_v2 est impose par le module).
  function applyProviderUi() {
    var ui = ensureUi();
    var prov = ls(LS.prov, 'gemini');
    var g = ui.panel.querySelector('#ocvGemBloc');
    var e = ui.panel.querySelector('#ocvElevenBloc');
    if (g) g.style.display = prov === 'elevenlabs' ? 'none' : '';
    if (e) e.style.display = prov === 'elevenlabs' ? '' : 'none';
  }

  function setPanelStatus(text, kind) {
    var ui = ensureUi();
    var s = ui.panel.querySelector('#ocvStatus');
    if (!s) return;
    s.textContent = text || '';
    s.setAttribute('data-kind', kind || 'info');
  }

  /* ---------- test des cles ---------- */
  function testApiKey() {
    if (ls(LS.prov, 'gemini') === 'elevenlabs') { testElevenKey(); return; }
    var ui = ensureUi();
    var key = (ui.panel.querySelector('#ocvKey').value || ls(LS.key, '')).trim();
    if (!key) { setPanelStatus('Aucune clé Gemini saisie.', 'error'); return; }
    var model = ui.panel.querySelector('#ocvModel').value.trim() || DEFAULT_MODEL;
    setPanelStatus('Test de la clé Gemini...', 'info');
    fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) +
      ':generateContent?key=' + encodeURIComponent(key), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Réponds uniquement par OK.' }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 8 }
      })
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (json) {
        if (!res.ok) {
          var d = json && json.error && json.error.message ? json.error.message : 'HTTP ' + res.status;
          throw new Error(d);
        }
        var parts = ((json && json.candidates && json.candidates[0] && json.candidates[0].content) || {}).parts || [];
        var out = parts.map(function (p) { return p.text || ''; }).join('').trim();
        if (!out) throw new Error('réponse vide du modèle');
        setPanelStatus('Clé valide — ' + model + ' répond.', 'ok');
      });
    }).catch(function (err) {
      var m = err && err.name === 'TypeError' ? 'connexion à Gemini impossible (réseau ou CORS)' : (err && err.message ? err.message : String(err));
      setPanelStatus('Échec : ' + m, 'error');
      logErr('test cle Gemini ECHEC: ' + m);
    });
  }

  function testElevenKey() {
    var ui = ensureUi();
    var key = (ui.panel.querySelector('#ocvElevenKey').value || ls(LS.elevenKey, '')).trim();
    if (!key) { setPanelStatus('Aucune clé ElevenLabs saisie.', 'error'); return; }
    setPanelStatus('Test de la clé ElevenLabs...', 'info');
    fetch('https://api.elevenlabs.io/v1/user', {
      method: 'GET',
      headers: { 'xi-api-key': key }
    }).then(function (res) {
      return res.text().then(function (t) {
        if (res.ok) { setPanelStatus('Clé ElevenLabs valide.', 'ok'); return; }
        var msg = 'HTTP ' + res.status;
        try {
          var j = JSON.parse(t);
          var d = j && j.detail;
          if (typeof d === 'string') msg = d;
          else if (d && d.message) msg = d.message;
          else if (j && j.message) msg = j.message;
        } catch (e) {}
        setPanelStatus('Clé ElevenLabs refusée : ' + msg, 'error');
      });
    }).catch(function (err) {
      var m = err && err.name === 'TypeError' ? 'connexion à ElevenLabs impossible (réseau ou CORS)' : (err && err.message ? err.message : String(err));
      setPanelStatus(m, 'error');
      logErr('test cle ElevenLabs ECHEC: ' + m);
    });
  }

  function saveSettings() {
    var ui = ensureUi();
    var prov = ls(LS.prov, 'gemini');
    var key = ui.panel.querySelector('#ocvKey').value.trim();
    var elevenKey = ui.panel.querySelector('#ocvElevenKey').value.trim();
    if (key) setLs(LS.key, key);
    if (elevenKey) setLs(LS.elevenKey, elevenKey);
    var model = ui.panel.querySelector('#ocvModel').value.trim() || DEFAULT_MODEL;
    setLs(LS.model, model);
    setLs(LS.lang, ui.panel.querySelector('#ocvLang').value);
    setLs(LS.auto, ui.panel.querySelector('#ocvAuto').checked ? '1' : '0');
    setLs(LS.sendKw, ui.panel.querySelector('#ocvSendKw').checked ? '1' : '0');
    var nom = prov === 'elevenlabs' ? 'ElevenLabs' : 'Gemini';
    var choisie = String(prov === 'elevenlabs' ? (elevenKey || ls(LS.elevenKey, '')) : (key || ls(LS.key, ''))).trim();
    if (!choisie) {
      setPanelStatus('Réglages enregistrés, mais aucune clé ' + nom + ' : la dictée échouera.', 'error');
      return;
    }
    ui.panel.style.display = 'none';
    showBubble('Réglages enregistrés.', 'ok', 2500);
  }

  var bubbleTimer = null;
  function showBubble(html, kind, hideAfter) {
    var ui = ensureUi();
    ui.bubble.innerHTML = html;
    ui.bubble.setAttribute('data-kind', kind || 'info');
    ui.bubble.style.display = 'block';
    if (bubbleTimer) { clearTimeout(bubbleTimer); bubbleTimer = null; }
    if (hideAfter) bubbleTimer = setTimeout(function () { ui.bubble.style.display = 'none'; }, hideAfter);
  }

  function setBtnState() {
    var ui = ensureUi();
    if (!ui.btn) return; // bouton en cours de remontage par React
    ui.btn.setAttribute('data-rec', st.recording ? '1' : '0');
    ui.btn.setAttribute('data-busy', st.busy ? '1' : '0');
    ui.btn.innerHTML = st.recording ? ICONS.stop : ICONS.mic;
  }

  /* ---------- enregistrement ---------- */
  function fmtTime(ms) {
    var s = Math.floor(ms / 1000);
    return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min ' + (s % 60) + ' s';
  }

  function toggleRecording() {
    if (st.busy) return;
    if (st.recording) stopRecording(); else startRecording();
  }

  function startRecording() {
    var ui = ensureUi();
    ui.panel.style.display = 'none';
    log('startRecording: demande acces micro');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      logErr('startRecording: getUserMedia indisponible');
      showBubble("L'enregistrement audio n'est pas disponible dans cette fenêtre.", 'error', 8000);
      return;
    }
    navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    }).then(function (stream) {
      st.stream = stream;
      var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', ''];
      var chosen = '';
      for (var i = 0; i < types.length; i++) {
        if (!types[i]) { chosen = ''; break; }
        if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) {
          chosen = types[i];
          break;
        }
      }
      var rec = chosen ? new MediaRecorder(stream, { mimeType: chosen, audioBitsPerSecond: 64000 }) : new MediaRecorder(stream);
      st.recorder = rec;
      st.chunks = [];
      rec.ondataavailable = function (e) { if (e.data && e.data.size) st.chunks.push(e.data); };
      rec.onerror = function (e) {
        log('erreur MediaRecorder', e);
        stopRecording();
      };
      rec.onstop = function () { finishRecording(); };
      rec.start(250);
      st.recording = true;
      st.startedAt = Date.now();
      setBtnState();
      st.tick = setInterval(function () {
        var ms = Date.now() - st.startedAt;
        showBubble('<span class="ocv-spin"></span>Enregistrement… ' + fmtTime(ms) +
          '<br>Cliquez sur le bouton pour arrêter et transcrire.', 'info');
        if (ms > MAX_MS) stopRecording();
      }, 500);
      showBubble('Enregistrement… 0 s', 'info');
      log('enregistrement démarré');
    }).catch(function (err) {
      st.stream = null;
      var name = err && err.name ? err.name : '';
      logErr('startRecording ECHEC: ' + name + ' - ' + (err && err.message ? err.message : ''));
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        showBubble('Accès au microphone refusé.<br>Autorisez-le via Windows → Paramètres → Confidentialité et sécurité → ' +
          'Microphone (applications de bureau), puis relancez Open Cowork.', 'error', 15000);
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        showBubble('Aucun microphone détecté sur cet ordinateur.', 'error', 12000);
      } else {
        showBubble("Impossible d'accéder au microphone : " + (err && err.message ? err.message : name), 'error', 12000);
      }
    });
  }

  function stopRecording() {
    if (st.tick) { clearInterval(st.tick); st.tick = null; }
    try {
      if (st.recorder && st.recorder.state !== 'inactive') st.recorder.stop();
    } catch (e) { log('arrêt impossible', e); }
  }

  /* ---------- transcription ---------- */
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function copyToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    return false;
  }

  var keyCache = null;
  function findGeminiKey(cfg) {
    if (!cfg || typeof cfg !== 'object') return '';
    var s = function (v) { return typeof v === 'string' && v.trim() ? v.trim() : ''; };
    var prof = cfg.profiles && cfg.profiles.gemini;
    if (prof && s(prof.apiKey)) return s(prof.apiKey);
    var sets = Array.isArray(cfg.configSets) ? cfg.configSets : [];
    for (var i = 0; i < sets.length; i++) {
      var set = sets[i] || {};
      var p = set.profiles && set.profiles.gemini;
      if (p && s(p.apiKey)) return s(p.apiKey);
      var isGem = set.provider === 'gemini' || /generativelanguage\.googleapis\.com/i.test(String(set.baseUrl || ''));
      if (isGem && s(set.apiKey)) return s(set.apiKey);
    }
    var activeGem = cfg.provider === 'gemini' || /generativelanguage\.googleapis\.com/i.test(String(cfg.baseUrl || ''));
    if (activeGem && s(cfg.apiKey)) return s(cfg.apiKey);
    return '';
  }

  function resolveKey() {
    var local = ls(LS.key, '').trim();
    if (local) return Promise.resolve(local);
    if (keyCache) return Promise.resolve(keyCache);
    var api = window.electronAPI;
    if (!api || !api.config || !api.config.get) return Promise.resolve('');
    return Promise.resolve(api.config.get()).then(function (cfg) {
      var found = findGeminiKey(cfg);
      if (found) {
        keyCache = found;
        log('clé Gemini récupérée depuis la configuration de l\'application');
      }
      return found;
    }).catch(function (e) {
      log('lecture de la configuration impossible', e);
      return '';
    });
  }

  function finishRecording() {
    st.recording = false;
    setBtnState();
    if (st.stream) {
      try { st.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      st.stream = null;
    }
    var mime = (st.recorder && st.recorder.mimeType) || 'audio/webm';
    var blob = new Blob(st.chunks || [], { type: mime });
    st.chunks = [];
    if (!blob.size) {
      showBubble('Aucun son enregistré.', 'error', 6000);
      return;
    }
    st.busy = true;
    setBtnState();
    showBubble('<span class="ocv-spin"></span>Transcription en cours…', 'info');
    var t0 = Date.now();
    log('transcription: envoi de ' + blob.size + ' octets (mime=' + mime + ')');
    transcribe(blob).then(function (text) {
      log('transcription OK en ' + (Date.now() - t0) + ' ms: "' + text + '"');
      // "envoiAuto" = case cochee dans le panneau (LS.sendKw '1').
      //  - case cochee : on insere, on retire le mot-cle eventuel, on ENVOIE.
      //  - case decochee : on insere seulement (envoi manuel).
      var autoSend = ls(LS.sendKw, '0') === '1';
      var inserted = ls(LS.auto, '1') === '1' ? insertText(text) : false;
      // On retire le mot-cle de fin (envoie/envoyer/en voie...) s'il est present,
      // uniquement pour nettoyer le texte ; l'envoi ne depend pas de sa presence.
      var kw = stripSendKeyword(text);
      var finalText = kw.hit ? kw.text : text;

      function writeInput(value) {
        var el = findInput();
        if (!el) return;
        // Contenteditable Lexical (DSH) : la propriete `value` n'existe pas.
        // On selectionne tout, puis on insere par la voie native du navigateur
        // (ou on supprime) pour que React/Lexical voient un vrai evenement.
        if (el.isContentEditable) {
          try { el.focus(); } catch (e) {}
          try {
            var r = document.createRange();
            r.selectNodeContents(el);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
            if (value) {
              if (!document.execCommand('insertText', false, value)) throw new Error('insertText refuse');
            } else {
              document.execCommand('delete', false, null);
            }
          } catch (e) {
            el.textContent = value || '';
            el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: value ? 'insertText' : 'deleteContentBackward' }));
          }
          return;
        }
        try {
          var proto = Object.getPrototypeOf(el);
          var d = Object.getOwnPropertyDescriptor(proto, 'value') ||
            Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
          if (d && d.set) d.set.call(el, value); else el.value = value;
        } catch (e) { el.value = value; }
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (!inserted) {
        // insertion desactivee dans les reglages : on copie dans le presse-papiers
        copyToClipboard(text);
        showBubble('Texte transcrit (copié dans le presse-papiers) :<br>« ' + escapeHtml(text) + ' »', 'ok', 9000);
      } else if (autoSend) {
        if (!finalText) {
          // rien d'autre que le mot-cle : on vide le champ, on n'envoie pas
          writeInput('');
          showBubble('Mot-cle seul, sans message : rien envoyé.', 'error', 6000);
        } else {
          // reecrire le champ sans le mot-cle de fin, puis envoyer
          writeInput(finalText);
          setTimeout(function () {
            if (submitChat()) showBubble('Message envoyé : « ' + escapeHtml(finalText) + ' »', 'ok', 5000);
            else {
              copyToClipboard(finalText);
              showBubble('Envoi auto impossible (bouton indisponible). Texte copié : « ' + escapeHtml(finalText) + ' »', 'error', 9000);
            }
          }, 300);
        }
      } else {
        // case decochee : envoi manuel
        showBubble('Texte inséré : « ' + escapeHtml(finalText) + ' »', 'ok', 5000);
      }
    }).catch(function (err) {
      var msg = err && err.message ? err.message : String(err);
      logErr('transcription ECHEC apres ' + (Date.now() - t0) + ' ms: ' + msg);
      if (msg === 'NO_KEY') {
        var nom = ls(LS.prov, 'gemini') === 'elevenlabs' ? 'ElevenLabs' : 'Gemini';
        showBubble('Aucune clé API ' + nom + '.<br>Faites un clic DROIT sur le micro pour en enregistrer une.',
          'error', 15000);
        togglePanel();
        setPanelStatus('Aucune clé API ' + nom + ' : collez-la puis cliquez sur « Enregistrer ».', 'error');
      } else {
        showBubble('Échec de la transcription : ' + escapeHtml(msg), 'error', 15000);
      }
    }).then(function () {
      st.busy = false;
      setBtnState();
    });
  }

  /* ---------- audio -> WAV 16 kHz mono ---------- */
  function encodeWav(samples, rate) {
    var len = samples.length;
    var buf = new ArrayBuffer(44 + len * 2);
    var view = new DataView(buf);
    var str = function (off, s) { for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    str(0, 'RIFF');
    view.setUint32(4, 36 + len * 2, true);
    str(8, 'WAVE');
    str(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    str(36, 'data');
    view.setUint32(40, len * 2, true);
    var off = 44;
    for (var i = 0; i < len; i++) {
      var s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  function toWav16k(blob) {
    var Ctx = window.AudioContext || window.webkitAudioContext;
    var Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctx || !Offline) return Promise.reject(new Error('API audio indisponible dans cette fenêtre.'));
    return blob.arrayBuffer().then(function (raw) {
      var ctx = new Ctx();
      return Promise.resolve(ctx.decodeAudioData(raw.slice(0))).then(function (decoded) {
        try { ctx.close(); } catch (e) {}
        var rate = 16000;
        var frames = Math.max(1, Math.ceil(decoded.duration * rate));
        var off = new Offline(1, frames, rate);
        var src = off.createBufferSource();
        src.buffer = decoded;
        src.connect(off.destination);
        src.start(0);
        return Promise.resolve(off.startRendering()).then(function (rendered) {
          return encodeWav(rendered.getChannelData(0), 16000);
        });
      });
    });
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onload = function () {
        var s = String(fr.result || '');
        resolve(s.slice(s.indexOf(',') + 1));
      };
      fr.onerror = function () { reject(new Error('lecture audio impossible')); };
      fr.readAsDataURL(blob);
    });
  }

  /* ---------- ElevenLabs Scribe v2 (batch) ----------
   * Le module produit deja un WAV 16 kHz mono, exactement ce que l'endpoint
   * batch attend. Contrat lu dans l'OpenAPI officiel : POST
   * /v1/speech-to-text, multipart file + model_id + language_code,
   * en-tete xi-api-key, reponse { text }. */
  var ELEVEN_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
  var ELEVEN_MODEL = 'scribe_v2';

  function transcribeEleven(blob) {
    var key = ls(LS.elevenKey, '').trim();
    if (!key) { logErr('transcribeEleven: aucune cle ElevenLabs'); return Promise.reject(new Error('NO_KEY')); }
    return toWav16k(blob).then(function (wav) {
      var fd = new FormData();
      fd.append('file', wav, 'audio.wav');
      fd.append('model_id', ELEVEN_MODEL);
      var lang = ls(LS.lang, 'fr');
      if (lang && lang !== 'auto') { fd.append('language_code', String(lang).slice(0, 2)); }
      // Pas de "(rires)" ni de "(musique)" : on ne veut que la parole dictee.
      fd.append('tag_audio_events', 'false');
      fd.append('temperature', '0');
      log('transcribeEleven: envoi de ' + wav.size + ' octets (' + ELEVEN_MODEL + ')');
      return fetch(ELEVEN_URL, {
        method: 'POST',
        headers: { 'xi-api-key': key },
        body: fd
      }).then(function (res) {
        return res.json().catch(function () { return null; }).then(function (json) {
          if (!res.ok) {
            var d = json && json.detail;
            var msg = typeof d === 'string' ? d : (d && d.message ? d.message : '');
            if (!msg) msg = json && json.error && json.error.message ? json.error.message : 'HTTP ' + res.status;
            if (res.status === 401 || res.status === 403) msg = 'clé refusée — ' + msg;
            else if (res.status === 429 || (d && d.status === 'quota_exceeded')) msg = 'quota épuisé — ' + msg;
            throw new Error('ElevenLabs : ' + msg);
          }
          var out = json && json.text ? String(json.text).trim() : '';
          if (!out) throw new Error('ElevenLabs : aucune parole detectee');
          return out;
        });
      });
    }).catch(function (err) {
      if (err && err.name === 'TypeError') throw new Error('connexion à ElevenLabs impossible (vérifiez l\'accès à Internet)');
      throw err;
    });
  }

  function transcribe(blob) {
    if (ls(LS.prov, 'gemini') === 'elevenlabs') { return transcribeEleven(blob); }
    return resolveKey().then(function (key) {
      if (!key) { logErr('transcribe: aucune cle Gemini (localStorage ni config app)'); throw new Error('NO_KEY'); }
      log('transcribe: cle trouvee (longueur ' + key.length + ')');
      return toWav16k(blob).then(function (wav) {
        return blobToBase64(wav).then(function (b64) {
          var model = resolveModel();
          var lang = ls(LS.lang, 'fr');
          log('transcribe: modele=' + model + ', langue=' + lang + ', audio=' + wav.size + ' octets');
          var instruction = lang === 'auto'
            ? 'Transcris mot pour mot cet enregistrement audio, exactement tel qu\'il est prononcé. ' +
              'Ne corrige rien, ne reformule rien, ne répète rien, n\'ajoute aucun commentaire ni ponctuation non prononcée. ' +
              'Ne traduis pas. Réponds uniquement par le texte transcrit.'
            : 'Transcris mot pour mot cet enregistrement audio en ' + (LANG_NAMES[lang] || 'français') + ', exactement tel qu\'il est prononcé. ' +
              'Ne corrige rien, ne reformule rien, ne répète rien, n\'ajoute aucun commentaire. ' +
              'Si un mot est prononcé dans une autre langue (par exemple « send »), écris-le tel quel sans le traduire. ' +
              'Réponds uniquement par le texte transcrit.';
          var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) +
            ':generateContent?key=' + encodeURIComponent(key);
          var body = {
            contents: [{
              role: 'user',
              parts: [{ text: instruction }, { inline_data: { mime_type: 'audio/wav', data: b64 } }]
            }],
            generationConfig: { temperature: 0, maxOutputTokens: 2048 }
          };
          return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          }).then(function (res) {
            return res.json().catch(function () { return null; }).then(function (json) {
              if (!res.ok) {
                var detail = json && json.error && json.error.message ? json.error.message : 'HTTP ' + res.status;
                throw new Error(detail);
              }
              var cand = json && json.candidates && json.candidates[0];
              var parts = (cand && cand.content && cand.content.parts) || [];
              var out = parts.map(function (p) { return p.text || ''; }).join('').trim();
              if (!out) throw new Error('aucune parole détectée dans l\'enregistrement');
              return out;
            });
          });
        });
      });
    }).catch(function (err) {
      if (err && err.name === 'TypeError') throw new Error('connexion au service impossible (vérifiez l\'accès à Internet)');
      throw err;
    });
  }

  /* ---------- insertion dans le champ de saisie du chat ---------- */
  function isVisible(el) {
    return !!(el && el.offsetParent !== null && !el.disabled && !el.readOnly);
  }

  // Le champ de saisie du chat est un <textarea> situe DANS un <form> qui
  // contient un bouton type="submit" (la fleche d'envoi). Cet ancrage est
  // robuste et INDEPENDANT DE LA LANGUE (contrairement au placeholder).
  function findChatFormArea(areas) {
    for (var i = areas.length - 1; i >= 0; i--) {
      var el = areas[i];
      var form = el.closest && el.closest('form');
      if (form && form.querySelector('button[type="submit"]')) return el;
    }
    return null;
  }

  function findInput() {
    // DSH Desktop : le champ du compositeur est un contenteditable, sans textarea.
    var editables = [].slice.call(document.querySelectorAll('[contenteditable="true"]')).filter(isVisible);
    if (editables.length) return editables[editables.length - 1];
    var all = [].slice.call(document.querySelectorAll('textarea'));
    var areas = all.filter(isVisible);
    if (!areas.length) areas = all;
    if (!areas.length) { log('findInput: aucun textarea sur la page'); return null; }
    if (!st._loggedInputs) {
      st._loggedInputs = true;
      log('findInput: ' + all.length + ' textarea (visibles: ' + areas.length + ') -> ' +
        areas.map(function (el) {
          return '[' + (el.placeholder || 'sans-placeholder') + '|rows=' + el.getAttribute('rows') + ']';
        }).join(' '));
    }
    // 1) PRIORITE : textarea dans le <form> de la barre de saisie (bouton submit).
    var inForm = findChatFormArea(areas);
    if (inForm) return inForm;
    // 2) notre ancre deja installee : le textarea juste avant
    var anchor = document.getElementById('ocVoiceAnchor');
    if (anchor && anchor.previousElementSibling && anchor.previousElementSibling.tagName === 'TEXTAREA') {
      return anchor.previousElementSibling;
    }
    // 3) champ du chat : rows=1 + placeholder de type "message" (toutes langues)
    var chat = areas.filter(function (el) {
      return el.getAttribute('rows') === '1' &&
        /message|mensaje|nachricht|消息|écri|ecri|write|ask|type|saisir/i.test(el.placeholder || '');
    });
    if (chat.length) return chat[chat.length - 1];
    // 4) heuristiques progressives
    var byRows = areas.filter(function (el) { return el.getAttribute('rows') === '1'; });
    if (byRows.length) return byRows[byRows.length - 1];
    var byPh = areas.filter(function (el) {
      return /message|mensaje|nachricht|消息|écri|ecri|write|ask|type|saisir/i.test(el.placeholder || '');
    });
    if (byPh.length) return byPh[byPh.length - 1];
    return areas[areas.length - 1];
  }

  function insertText(text) {
    var el = findInput();
    if (!el) return false;

    // Contenteditable (DSH Desktop) : execCommand passe par le chemin natif du
    // navigateur, donc React voit un vrai evenement "input" et garde l'editeur
    // et son etat interne synchronises. On place le curseur en fin de contenu.
    if (el.isContentEditable) {
      try { el.focus(); } catch (e) {}
      try {
        var portee = document.createRange();
        portee.selectNodeContents(el);
        portee.collapse(false);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(portee);
      } catch (e) { logWarn('insertText: selection de fin impossible', e); }
      var existant = (el.textContent || '').trim();
      var aInserer = existant ? ' ' + text : text;
      var fait = false;
      try { fait = document.execCommand('insertText', false, aInserer); } catch (e) { fait = false; }
      if (!fait) {
        // Repli : ecriture directe + evenement input (React lit le DOM).
        try {
          el.textContent = existant ? existant + ' ' + text : text;
          el.dispatchEvent(new InputEvent('input', { bubbles: true, data: aInserer, inputType: 'insertText' }));
        } catch (e) { logErr('insertText: ecriture directe impossible', e); return false; }
      }
      return true;
    }

    // Textarea classique : setter natif puis evenement input.
    var prev = el.value || '';
    var next = prev.trim() ? prev.replace(/\s+$/, '') + ' ' + text : text;
    try {
      var proto = Object.getPrototypeOf(el);
      var desc = Object.getOwnPropertyDescriptor(proto, 'value') ||
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      if (desc && desc.set) desc.set.call(el, next); else el.value = next;
    } catch (e) {
      el.value = next;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    try { el.focus(); } catch (e) {}
    return true;
  }

  /* ---------- envoi automatique par mot-cle ---------- */
  // Retire les accents et la ponctuation finale pour comparer au mot-cle.
  // Normalise pour comparaison : recoller "en voie" -> "envoie", retirer la
  // ponctuation finale, minuscules, sans accents.
  function normalizeForKw(s) {
    return String(s)
      .replace(SPLIT_KEYWORD_RE, 'envoie')   // recoller "en voie" -> "envoie"
      .replace(/[.,!?;:…"'’»«()\[\]]+$/g, '')
      .trim()
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  // True si le texte se termine par un mot-cle d'envoi. Retourne {hit, text}
  // ou text = le message sans le(s) mot(s)-cle(s) de fin (nettoye).
  // Tolerant aux cas reels observes : "Envoie. Envoie." (double), "en voie"
  // (decoupe), "envoie." (ponctuation), casse/accents.
  function stripSendKeyword(raw) {
    var text = String(raw || '').replace(SPLIT_KEYWORD_RE, 'envoie').trim();
    if (!text) return { hit: false, text: text };
    var punctTail = /[\s.,!?;:…"'’»«()\[\]]+/;
    var words = text.split(/\s+/).map(function (w) {
      return w.replace(SPLIT_KEYWORD_RE, 'envoie').replace(punctTail, '');
    }).filter(function (w) { return w.length > 0; });
    if (!words.length) return { hit: false, text: text };
    function isKw(w) {
      return SEND_KEYWORDS.indexOf(
        w.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) !== -1;
    }
    // On retire UNIQUEMENT des mots-cles en fin de texte (repete autant que
    // necessaire) : "Envoie. Envoie." -> vide, "phrase send" -> "phrase".
    // Aucun mot de contenu n'est jamais retire (securite).
    var n = words.length;
    var end = n;
    while (end > 0 && isKw(words[end - 1])) end--;
    if (end === n) return { hit: false, text: text }; // pas de mot-cle en fin
    return { hit: true, text: words.slice(0, end).join(' ').trim() };
  }

  // Clique le bouton d'envoi (fleche) du chat, si disponible et actif.
  function submitChat() {
    var btn = findSubmitButton();
    if (!btn || btn.disabled) { log('submitChat: bouton envoi indisponible/desactive'); return false; }
    try {
      btn.click();
      return true;
    } catch (e) { log('submitChat: clic impossible', e); return false; }
  }

  /* ---------- démarrage ---------- */
  var tries = 0;
  var VERSION = 2;
  function init() {
    tries++;
    var hasBody = !!document.body;
    var hasRoot = !!document.getElementById('root');
    var hasArea = !!document.querySelector('textarea, [contenteditable="true"]');
    if (!hasBody || (!hasRoot && !hasArea)) {
      if (tries === 1 || tries % 25 === 0) {
        log('init: attente du DOM (essai ' + tries + ', body=' + hasBody + ', root=' + hasRoot + ', textarea=' + hasArea + ')');
      }
      if (tries < 300) setTimeout(init, 400);
      else logErr('init: DOM jamais pret apres ' + tries + ' essais, abandon');
      return;
    }
    try {
      log('init: DOM pret (essai ' + tries + '), installation de l interface');
      ensureUi();
      setBtnState();
      mountAnchored();
      // recaler une fois le layout React completement stabilise
      [200, 600, 1200].forEach(function (t) {
        setTimeout(function () { if (st.anchored) mountAnchored(); }, t);
      });
      setLs('ocVoice.installed', new Date().toISOString());
      log('module de saisie vocale pret (v' + VERSION + ', ancre=' + st.anchored + ')');
    } catch (e) {
      logErr('init: initialisation impossible', e);
    }
  }

  // signaler la presence du module des que possible (WARN = persiste dans le fichier de logs)
  logWarn('module charge (v' + VERSION + '), electronAPI.logs.write=' +
      !!(window.electronAPI && window.electronAPI.logs && window.electronAPI.logs.write) +
      ', readyState=' + document.readyState);
  // s'assurer que les logs developpeur (niveaux INFO) sont actives pour le diagnostic
  try {
    var lapi = window.electronAPI && window.electronAPI.logs;
    if (lapi && lapi.isEnabled && lapi.setEnabled) {
      Promise.resolve(lapi.isEnabled()).then(function (res) {
        var on = (res && typeof res === 'object') ? res.enabled : res;
        if (!on) {
          return Promise.resolve(lapi.setEnabled(true)).then(function () {
            log('logs developpeur actives par le module vocal (INFO visible desormais)');
          });
        }
      }).catch(function () {});
    }
  } catch (e) {}

  // Points d'entree exposés à l'hôte : le bouton monté par React (slot
  // `conversation.input.activity`) s'attache ici ; le repli DOM s'en sert aussi.
  try {
    window.__ocVoice.toggle = toggleRecording;
    window.__ocVoice.panel = togglePanel;
    window.__ocVoice.attach = attachButton;
    window.__ocVoice.detach = detachButton;
  } catch (e) {}

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

    // ---------------------------------------------------------------------
    //  Intégration DSH : le bouton vit dans un emplacement rendu par React.
    //
    //  L'ancienne version insérait un <span> dans le groupe flex du composeur.
    //  React détruisait ce nœud inconnu à chaque réaffichage (envoi d'un
    //  message, changement de session) : le micro disparaissait. Un composant
    //  enregistré dans un slot est rendu PAR React : il survit aux rendus.
    // ---------------------------------------------------------------------
    var slotMonte = false

    function monterSlot(ctx) {
      if (slotMonte) return
      if (!ctx || !ctx.slots || typeof ctx.slots.inject !== 'function') return
      var React = require('react')

      function MicroButton() {
        var ref = React.useRef(null)
        React.useEffect(function () {
          if (ref.current) window.__ocVoice.attach(ref.current)
          return function () { if (ref.current) window.__ocVoice.detach(ref.current) }
        }, [])
        return React.createElement('button', {
          ref: ref,
          type: 'button',
          className: 'ocv-btn ocv-btn-inline',
          title: 'Saisie vocale — clic : enregistrer, clic droit : réglages',
          'aria-label': 'Saisie vocale (clic droit : réglages)',
          onClick: function (e) {
            e.preventDefault()
            e.stopPropagation()
            window.__ocVoice.toggle()
          },
          onContextMenu: function (e) {
            e.preventDefault()
            e.stopPropagation()
            window.__ocVoice.panel()
          }
        })
      }

      slotMonte = true
      ctx.slots.inject('conversation.input.activity', function () {
        return ctx.slots.register({ name: 'conversation.input.activity' }, MicroButton)
      })
    }

      // Le repli DOM est installé dès l'application ; si le service des slots
      // arrive ensuite, le bouton React prend le relais (attachButton).
      if (ctx && typeof ctx.inject === 'function') ctx.inject(['slots'], monterSlot)
      else monterSlot(ctx)
    }

    const inject = []

    exports.apply = apply
    exports.inject = inject
    return module.exports
  }
})
