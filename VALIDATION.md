# Validation

Validated on 2026-10-07, Node 22.23.3 and Microsoft Edge 153 (Playwright).

## Standalone

`npm ci`, `npm run check`, `npm test`: 6 tests passed, none skipped. Tests include real Chromium interactions on focused fixtures, syntax/manifest checks and any existing Node unit coverage. Native printing is stubbed; no OS print dialog opens.

## Current upstream integration

Upstream Digital Garden commit `80a33ffa6cb198ecf733e5944b4a60510970e3b0`, registry commit `ed1b497a4cd584721edf51e7c1a3ef9481229818`. Each of seven plugins was installed and built individually, then all seven built together: eight successful `npm run build` executions on Node 22. No core source modifications were required.

Every nonempty subset of the six reading/layout plugins (63) was browser-tested against the actual compiled upstream page at 1800, 1100 and 390 px widths. The harness selects emitted runtime scripts/styles while preserving current core markup and configuration slots; it does not rebuild all 63 combinations separately. Checks cover responsive overflow, native right-sheet compatibility, single footer ownership, repeated initialization, folded-target navigation and complete print visibility. Six permutations of Appearance, Print and Resizable initialization passed; removing the Appearance contribution left the other controls usable. Note Lock additionally passed the all-seven protected-note unlock flow.

Eight separate stress scenarios passed: left-only, right-only, no panes, both collapsed across reading-width classes; reversible mouse snap and synthetic browser TouchEvents with preferred-width restoration; fold/TOC/progress/print cancellation; canvas; no headings. Console errors and uncaught page errors were asserted absent in final subset and stress runs, including the protected-note flow.

`TZ=UTC npm test` in upstream: 390 tests passed. Without UTC, upstream's two date expectations fail in America/Chicago (388 pass); core was not changed to hide this timezone issue. Generated search/Atom outputs retain the public fixture and exclude the protected fixture; `xmllint --noout dist/feed.xml` passes.

## Screenshot

`screenshot.png` is a real screenshot captured from this current upstream test garden with synthetic public demonstration notes, not a generated/mock illustration.

## Limits

Chromium/Edge was exercised, not Firefox/WebKit or physical touch hardware. Native browser `dialog`, modern layout CSS and optional relative OKLCH are used; unsupported relative colors fall back to the theme accent. Accent contrast is checked against the primary background, not every possible third-party theme surface. Current core uses full-document navigation; disabling/uninstalling is supported through rebuild and page reload, not a hot-unload API. Third-party navigation replacements may require integration checks. No security boundary is provided by Note Lock.
