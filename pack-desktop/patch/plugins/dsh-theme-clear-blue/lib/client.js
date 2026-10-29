// Thème Clear Blue — portage du pack Reasonix Studio « official-clear-blue ».
// Source : reasonix-studio-host.exe, builtin/official-clear-blue.json.
// Le thème DSH est un jeu de jetons --dsw-* : on remplace l'échelle neutre
// (teintée bleu) et l'échelle bleue, puis les alias qui ne dérivent pas d'elle.
window.__ModuleLoader__.load({
  id: "dsh-theme-clear-blue",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" })

    const ID = "dsh-theme-clear-blue"
    const CSS = `
/* --- Clear Blue : palette sombre ------------------------------------- */
body[data-ds-dark-theme] {
  --dsw-static-neutral-bluish-00:#FFFFFF;
  --dsw-static-neutral-bluish-50:#F2F6FC;
  --dsw-static-neutral-bluish-60:#EFF4FA;
  --dsw-static-neutral-bluish-75:#EAF0F8;
  --dsw-static-neutral-bluish-100:#E3EBF6;
  --dsw-static-neutral-bluish-150:#DCE5F1;
  --dsw-static-neutral-bluish-200:#D3DDEA;
  --dsw-static-neutral-bluish-300:#BCC9DA;
  --dsw-static-neutral-bluish-400:#A0AFBF;
  --dsw-static-neutral-bluish-500:#7A8798;
  --dsw-static-neutral-bluish-600:#566274;
  --dsw-static-neutral-bluish-700:#39485D;
  --dsw-static-neutral-bluish-750:#2B394C;
  --dsw-static-neutral-bluish-800:#253142;
  --dsw-static-neutral-bluish-850:#202B3A;
  --dsw-static-neutral-bluish-875:#1D2634;
  --dsw-static-neutral-bluish-900:#1A2330;
  --dsw-static-neutral-bluish-950:#151B24;
  --dsw-static-neutral-bluish-1000:#0E131A;
  --dsw-alias-bg-base:#151B24;
  --dsw-alias-bg-layer-1:#1A2330;
  --dsw-alias-bg-layer-2:#253142;
  --dsw-alias-bg-layer-3:#202B3A;
  --dsw-alias-border-l1:#2B394C;
  --dsw-alias-border-l2:#39485D;
  --dsw-alias-border-l3:#39485D;
  --dsw-alias-border-l4:#4A5B73;
  --dsw-static-blue-50:#EEF3FC;
  --dsw-static-blue-75:#E4EDFB;
  --dsw-static-blue-100:#D6E3F9;
  --dsw-static-blue-300:#A6C5FF;
  --dsw-static-blue-400:#8FB8F4;
  --dsw-static-blue-450:#6FA3F7;
  --dsw-static-blue-500:#4F86E8;
  --dsw-static-blue-600:#356AD2;
  --dsw-static-blue-800:#285BBC;
  --dsw-static-blue-900:#1F4A9E;
  --dsw-static-blue-950:#172554;
}

/* --- Clear Blue : palette claire ------------------------------------- */
:root, body {
  --dsw-static-neutral-bluish-00:#FFFFFF;
  --dsw-static-neutral-bluish-50:#F5F7FA;
  --dsw-static-neutral-bluish-60:#F7F9FB;
  --dsw-static-neutral-bluish-75:#F0F3F7;
  --dsw-static-neutral-bluish-100:#E8EDF3;
  --dsw-static-neutral-bluish-150:#E4E9F0;
  --dsw-static-neutral-bluish-200:#DCE2EA;
  --dsw-static-neutral-bluish-300:#C9D3E0;
  --dsw-static-neutral-bluish-400:#A0AFBF;
  --dsw-static-neutral-bluish-500:#7A8798;
  --dsw-static-neutral-bluish-600:#637083;
  --dsw-static-neutral-bluish-700:#566274;
  --dsw-static-neutral-bluish-750:#3A4657;
  --dsw-static-neutral-bluish-800:#2C3848;
  --dsw-static-neutral-bluish-850:#202936;
  --dsw-static-neutral-bluish-875:#1C2532;
  --dsw-static-neutral-bluish-900:#182231;
  --dsw-static-neutral-bluish-950:#141C28;
  --dsw-static-neutral-bluish-1000:#0F1620;
  --dsw-alias-bg-base:#F5F7FA;
  --dsw-alias-bg-layer-1:#FFFFFF;
  --dsw-alias-bg-layer-2:#F0F3F7;
  --dsw-alias-bg-layer-3:#FFFFFF;
  --dsw-alias-border-l1:#E8EDF3;
  --dsw-alias-border-l2:#DCE2EA;
  --dsw-alias-border-l3:#DCE2EA;
  --dsw-alias-border-l4:#C9D3E0;
  --dsw-static-blue-50:#EEF3FC;
  --dsw-static-blue-75:#E4EDFB;
  --dsw-static-blue-100:#D6E3F9;
  --dsw-static-blue-300:#A6C5FF;
  --dsw-static-blue-400:#8FB8F4;
  --dsw-static-blue-450:#6FA3F7;
  --dsw-static-blue-500:#4F86E8;
  --dsw-static-blue-600:#356AD2;
  --dsw-static-blue-800:#285BBC;
  --dsw-static-blue-900:#1F4A9E;
  --dsw-static-blue-950:#172554;
}
`

    function installer() {
      if (document.getElementById(ID)) return
      var el = document.createElement("style")
      el.id = ID
      // !important sur chaque jeton : le thème de DSH est appliqué par des
      // feuilles injectées par le paquet ui-theme, et l'ordre de chargement
      // n'est pas garanti. Sans cela, nos valeurs peuvent perdre à spécificité
      // égale et l'interface garde la palette d'origine.
      el.textContent = CSS.replace(/(--[a-z0-9-]+:[^;]+);/gi, "$1 !important;")
      ;(document.head || document.documentElement).appendChild(el)
      try { console.info("[theme] Clear Blue applique") } catch (e) {}
    }

    function apply(ctx) {
      installer()
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", installer, { once: true })
      }
      if (ctx && ctx.effect) {
        ctx.effect(() => () => {
          var el = document.getElementById(ID)
          if (el) el.remove()
        })
      }
    }

    exports.apply = apply
    exports.inject = []
    return module.exports
  }
})
