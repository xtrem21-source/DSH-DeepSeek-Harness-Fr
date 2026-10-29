# DeepSeek Harness — French interface

**French interface for DeepSeek Harness, in two methods.** The **archive delta patch** adds
French **without removing** Chinese or English, and its engine accepts **any language**; the
**profile pack** additionally adds the **microphone** (Gemini / Groq / ElevenLabs) and the **Clear Blue
theme** (dark mode), without touching the archive.

[French README](README.md) · [How it works](docs/comment-ca-marche.md) ·
[Add a language](docs/ajouter-une-langue.md) · [Multi-language design](docs/multilingue.md)

> The detailed documentation is in French. This page is the English summary.

---

## Two methods in this repository

| | **Method 1 — delta patch of the archive** | **Method 2 — profile pack** |
|---|---|---|
| Where | `src/`, `scripts/`, `locales/` (this README) | [`pack-desktop/`](pack-desktop/LISEZ-MOI.txt) |
| What is modified | 3 internal files of `app.asar` | the DSH profile (`~\.dsh\profiles\desktop`) |
| Languages | any pack in `locales/`, selector in the app | French shipped, FR / EN switch |
| Microphone | — | dictation button (Gemini, Groq or ElevenLabs) |
| Theme | — | Clear Blue (dark mode) |
| Install | `npm ci`, then `scripts\Appliquer-le-patch.cmd` | unzip, double-click `patcher.bat` |
| Rollback | `scripts\Restaurer-l-original.cmd` | `pack-desktop\restaurer.bat` |

Both methods can coexist: they do not touch the same files. The profile pack does not modify
`app.asar` (microphone permission is already native in the targeted version).

### Method 2 — profile pack (`pack-desktop/`)

Full French interface, microphone button and Clear Blue theme, without repacking the archive.

1. Download **`DSH-Desktop-Patch-FR-windows-x64-1.1.1.zip`** (repository root) and extract it,
   or clone the repository and open `pack-desktop/`.
2. Close DeepSeek Harness, then double-click **`patcher.bat`**.
3. Reopen the app: the interface is in French, the microphone sits right of the send arrow
   (left click to dictate, right click for the API key).

> **Version.** Tested on **DeepSeek Harness 0.2.1-rc.3** (nightly channel). The pack is expected
> to keep working after an app update as long as the plugin structure does not change; **this is
> not guaranteed**. If it stops working, run `patcher.bat` again and check on screen; if it fails,
> `restaurer.bat` restores the profile to its previous state.

The pack ships French, but the mechanism only knows dictionaries: strings live in
`patch/plugins/dsh-fr-locale/fr/*.json` (47 files, 2,098 strings) plus the correction table
`_correctifs.json` (454 entries, 28 rules). `node outils/assembler-fr.mjs` rebuilds
`lib/client.js`. For another language: duplicate the folder, change `LANGUE` (`id`, `label`,
`fallback`) in the generator, translate the values, regenerate. Details (FR):
[docs/pack-desktop.md](docs/pack-desktop.md).

---

## What it does

| Item | Delta |
|---|---|
| Archive replaced | **No** — 3 internal files patched, the 121 MB archive is kept |
| Languages | 中文, English, plus the pack locale, all available |
| Default locale | configurable (`fr` by default) |
| When translations apply | only when the active locale has a pack |
| App update | re-apply if the structure anchors still exist |
| Compatibility failure | the archive is **not** replaced; the script stops |
| Backup | taken before any write |
| Rollback | `scripts\Restaurer-l-original.cmd` |

The French pack covers **2,155 web strings** and **165 Electron shell keys**, plus reasoning
effort labels.

## Requirements

- **Windows** for the provided PowerShell scripts (the Node engine runs anywhere).
- **Node.js 20.19+**.
- **DeepSeek Harness closed**, including the notification-area icon.

## Install

```powershell
git clone https://github.com/xtrem21-source/DSH-DeepSeek-Harness-Fr.git
cd DSH-DeepSeek-Harness-Fr
npm ci
npm test
```

Then, with the app closed:

```text
scripts\Appliquer-le-patch.cmd
```

Reopen the app: the language selector offers **Français**, French is the default, and
**English** / **中文** remain available.

### Command line

```powershell
node src/patch.mjs --app "<dir>\resources\app.asar" --out "$env:TEMP\patch.asar" --default fr
node src/patch.mjs --verify "<dir>\resources\app.asar" --default fr
node src/patch.mjs --status "<dir>\resources\app.asar"
node src/patch.mjs --list
```

## Add a language

The engine only knows **codes**; it contains no French word.

1. Copy `locales/template/` to `locales/<code>/`.
2. Fill `meta.json` (`code`, `label`, `fallback`, `direction`, `effort`).
3. Translate `web.json` (English source → translation) and `shell.json` (key → translation).
4. `npm run verify:packs` — `{placeholder}` parity is checked.
5. `node src/patch.mjs --app <asar> --out <copy> --default <code>`.

## Limits

- Anchors-based, not archive-hash-based: a new app version may move them.
- An automatic update may overwrite the patch; re-apply or restore first.
- One locale set per archive.
- RTL languages (`ar`, `fa`, `he`): strings are translated, layout stays LTR.

Tested against **DeepSeek Harness 0.2.0-rc.2**.

## Legal

Independent project, not affiliated with DeepSeek. No application binary is distributed. Patch
code is MIT; translated strings derive from the UI and remain their authors' property. See
[NOTICE.md](NOTICE.md).

## License

[MIT](LICENSE) for the code.
