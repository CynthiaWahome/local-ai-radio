# The Last Broadcast — brand kit

## Identity

**The Last Broadcast** is the working game name. **Channel 00** is its fictional radio station. **Five questions. No acceptable answers.** is the primary tagline. **An interactive radio nightmare** is the descriptor.

Mood: ominous late-night analogue radio; confident typography; a trace of signal damage; no pumpkins, witches, skull mascots or religious symbolism. Let the script carry the comedy. The interface and cover can look entirely serious.

The mark is an original stylized microphone in a broken transmission ring. It remains recognizable when the title is absent. Wordmark cuts suggest a damaged signal while preserving letter shapes.

## Files

| Asset | File | Use |
|---|---|---|
| Cinematic cover | `artwork/cinematic-cover.png` | Generated poster artwork / DEV cover option |
| DEV vector cover | `banners/devto-cover-vector.svg` / PNG | Editable high-resolution alternative |
| README banner | `banners/readme-banner.svg` / PNG | Repository heading |
| Social card | `banners/social-card.svg` / PNG | Link preview; SVG is 1200×630 |
| UI concept | `banners/ui-concept.svg` / PNG | Visual implementation reference, labelled synthetic |
| Horizontal logos | `logos/logo-horizontal-on-dark.svg`, `...on-light.svg` | Header and documentation |
| Stacked title | `logos/wordmark-stacked-on-dark.svg`, `...on-light.svg` | Title screen, cover typography |
| Symbol | `logos/signal-mark.svg`, `signal-mark-tile.svg` | Avatar, app icon, small brand presence |
| Editable title | `logos/logo-editable-text.svg` | Live text editing after installing the font |
| Favicon | `icons/favicon.svg`, `favicon.ico` | Browser icon |
| PNG icons | 16/32/48/64/192/512/1024; Apple 180 | Platform icon starting points |
| Tokens | `tokens.css`, `palette.json` | Frontend variables and local fonts |

The default wordmarks are outlined SVGs and do not need fonts installed. The editable-text variant does. PNGs are transparent unless the design contains an intentional dark tile/background. The light-background horizontal logo intentionally keeps its dark microphone tile for a clean silhouette.

## Palette

Void #0B0C0F, Console #171A20, Dial #262B32, Bone #F2E8D5, Ash #B6B1A8, Signal #FF665A, Oxblood #8E2633, Phosphor #B8D7B0.

Use Bone on Void/Console for primary copy. Use Ash for secondary copy. Signal is appropriate for active/focus highlights on the dark backgrounds; dark Oxblood is a large filled button colour with Bone text rather than small red text on black. Refer to the contrast report for intended pairs.

## Typography and spacing

Install the bundled DejaVu fonts or load them locally with the included CSS. Display lettering may be tall, condensed and selectively cut. Captions and input labels stay plain. Use a minimum clear space around the mark of approximately one fifth of its width; do not place a texture across it. Keep the title aspect ratio intact.

For an in-app header, a 36–48px symbol plus a short title is enough. Do not cram the whole stacked poster into a 32px navigation bar. Avoid rotating the favicon or adding fake film grain over small controls.

## Implementation snippets

```html
<link rel="icon" type="image/svg+xml" href="/brand/icons/favicon.svg">
<link rel="icon" sizes="any" href="/brand/icons/favicon.ico">
<link rel="apple-touch-icon" href="/brand/icons/apple-touch-icon.png">
```

Adjust paths to where the assets actually live. For a README, copy the banner into a committed `docs/assets/` directory and reference that relative path so it works for other users.

## Artwork provenance

The cinematic poster was generated with the built-in image-generation tool using the prompt preserved in `ARTWORK_PROMPT.txt`. It is a raster artwork, not an editable layered source or proof of a finished game. The SVG identity, covers and UI concept were authored separately as vector graphics. Do not claim the image tool is the qualifying open-weight gameplay runtime.

This is a working identity; no claim is made that the title has been cleared as a unique trademark. Third-party font and model terms remain separate from your application's chosen source licence. See `ASSET_NOTICES.md` for included files.
