# LaTeX Math for PI WEB

A browser-only PI WEB plugin that renders LaTeX in conversations and the Files Markdown preview. It uses the shared Markdown extension API and bundles KaTeX, its stylesheet, and fonts locally. Rendering makes no third-party requests and does not modify saved messages or files.

| Delimiters | Example | Layout |
| --- | --- | --- |
| `$…$` | `$e^{i\pi}+1=0$` | Inline |
| `\(…\)` | `\(\frac{1}{2}\)` | Inline |
| `$$…$$` | `$$\sum_{i=1}^n i$$` | Display |
| `\[…\]` | `\[\int_0^1 x^2\,dx\]` | Display |

Display formulas can span lines. For best results, put display equations on their own lines. Inline dollars must touch the formula on both sides; use `\$` for a literal dollar when the text could be mistaken for math. Code stays literal. Incomplete equations are left to Markdown, and unsupported or invalid TeX falls back to readable source.

## Install from npm

Requires PI WEB browser plugin API v5 with `markdown-rendering@1` (tested on PI WEB `1.202611.4`).

1. Open **Settings → Pi packages** and install `npm:pi-web-math`.
2. Check **Settings → PI WEB plugins** for **LaTeX Math**, enabled by default.
3. Reload the browser. No session-daemon restart is needed.

## Build from source

Use Node.js 24+ and npm:

```sh
npm ci
npm run build
plugin_dir="${PI_WEB_DATA_DIR:-$HOME/.pi-web}/plugins"
mkdir -p "$plugin_dir"
ln -s "$PWD" "$plugin_dir/math"
```

Reload the browser. The plugin is enabled by default; check **Settings → PI WEB plugins** for **LaTeX Math**. No daemon restart is needed. To disable it, use Settings and reload, or remove just the symlink. Rebuild and reload to pick up changes.

Open [`examples/math.md`](examples/math.md) in **Files → Preview** to see all four delimiters. Run `npm test` for the tokenizer and renderer tests, or `npm pack` to build a distributable archive with the browser assets.
