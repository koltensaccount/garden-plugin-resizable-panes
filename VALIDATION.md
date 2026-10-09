# Validation

## Version 1.1.4 Unlock Handoff

2026-10-09: a focused regression reproduces a panel hidden by Note Lock until after every startup timer has completed. Released 1.1.3 has no `dg:note-unlocked` listener and fails this test. The fix listens to Note Lock's existing document event and batches layout recalculation on the next animation frame, without observing body/root writes. The test verifies right width changes from 0 to 300 px, the splitter returns, and the computed main edge leaves the configured 24 px gap, without a resize or pane-attribute mutation. Runtime tests and syntax/manifest checks pass. User visual confirmation is pending; Note Lock and core were not changed.

## Version 1.1.3 Follow-up

The user's live screenshot still overlapped after 1.1.2; the earlier fixture did not establish that the live bug was fixed. Desktop allocation now uses panel presence/display and the 1400px boundary, not measured positive height or flex direction. A focused unit regression covers a zero-height, column-flex desktop panel with visible overflowing children. Runtime tests and syntax/manifest checks were run; visual confirmation on the user's page is pending. No PDF, core or TOC Settings changes.

Version 1.1.2 validated on 2026-10-08, Node 22.23.3 and Google Chrome 154 (Playwright).

## Standalone

`npm ci`, `npm run check`, `npm test`: 7 tests passed, none skipped. Existing mouse snap/reopen, keyboard controls, reading-width persistence, responsive and initialization tests are retained.

## Page-panel regression

The existing browser harness now covers an actual PDF iframe with backlinks and no TOC at 1600, 1401, 1400, 1200, 1001, 1000 and 390 px. Other focused cases cover ordinary Markdown/backlinks without TOC, PDF/TOC/backlinks, TOC only, graph/backlinks and no page panel. Desktop assertions measure main/panel/PDF rectangles, the intended gap, every backlink text fragment and sidebar scroll width; containment is not accepted merely because overflow is clipped. Minimum/maximum right widths, long unbroken links, collapse/reopen across the sheet boundary, and reading width enabled/reset are exercised. Nested `.content` remains at its own 73 px width.

Tests pass with the committed focused upstream-contract fixture and with the complete compiled `digital-garden-base.scss` from current upstream commit `80a33ffa6cb198ecf733e5944b4a60510970e3b0` substituted using `DG_UPSTREAM_CSS`. A further run loads unchanged TOC Settings 1.1.0 using `DG_TOC_SETTINGS_DIR`: no-TOC pages retain native zero left padding; TOC pages retain that plugin's configured 36 px desktop buffer; core sheet padding remains 20 px. Closed/open sheet widths, positioning, visibility and transforms are checked after native transitions. No upstream or TOC Settings source was changed; no broad plugin matrix was rerun.

The same new regressions fail against released v1.1.1: nested `.content` becomes 992 px instead of 73 px, and custom geometry incorrectly stays active at the core sheet boundary.

Measured desktop PDF/backlinks geometry: at 1600 px, main/PDF right edge is 1276 px and panel left edge is 1300 px; at 1401 px, those edges are 1077 px and 1101 px. Both preserve the configured 24 px gap, with zero sidebar horizontal overflow. An optional native-PDF screenshot capture timed out locally and was not used as evidence; the successful runs assert iframe and text geometry, not the PDF viewer's internal rendering. PDF rendering/width rules were not changed.

## Previous upstream integration

Initial release validation used upstream Digital Garden commit `80a33ffa6cb198ecf733e5944b4a60510970e3b0` and registry commit `ed1b497a4cd584721edf51e7c1a3ef9481229818`. Each of the six reading/layout plugins was installed and built individually on Node 22. No core source modifications were required.

Every nonempty subset of the six reading/layout plugins (63) was browser-tested against the actual compiled upstream page at 1800, 1100 and 390 px widths. The harness selects emitted runtime scripts/styles while preserving current core markup and configuration slots; it does not rebuild all 63 combinations separately. Checks cover responsive overflow, native right-sheet compatibility, single footer ownership, repeated initialization, folded-target navigation and complete print visibility. Six permutations of Appearance, Print and Resizable initialization passed; removing the Appearance contribution left the other controls usable.

Eight separate stress scenarios passed: left-only, right-only, no panes, both collapsed across reading-width classes; reversible mouse snap and synthetic browser TouchEvents with preferred-width restoration; fold/TOC/progress/print cancellation; canvas; no headings. Console errors and uncaught page errors were asserted absent in final subset and stress runs.

`TZ=UTC npm test` in upstream: 390 tests passed. Without UTC, upstream's two date expectations fail in America/Chicago (388 pass); core was not changed to hide this timezone issue.

## Screenshot

`screenshot.png` is a real screenshot captured from this current upstream test garden with synthetic public demonstration notes, not a generated/mock illustration.

## Limits

Chromium/Edge was exercised, not Firefox/WebKit or physical touch hardware. Native browser `dialog`, modern layout CSS and optional relative OKLCH are used; unsupported relative colors fall back to the theme accent. Accent contrast is checked against the primary background, not every possible third-party theme surface. Current core uses full-document navigation; disabling/uninstalling is supported through rebuild and page reload, not a hot-unload API. Third-party navigation replacements may require integration checks.
