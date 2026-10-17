# DeepSeek Harness — French interface

**A multi-language delta patch for the DeepSeek Harness UI.** It adds French **without
removing** Chinese or English, and the engine accepts **any language**: French is just one pack
shipped with the repository.

[French README](README.md) · [How it works](docs/comment-ca-marche.md) ·
[Add a language](docs/ajouter-une-langue.md) · [Multi-language design](docs/multilingue.md)

> The detailed documentation is in French. This page is the English summary.

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
