# Resizable Panes for Digital Garden

Drag the edges of the left navigation and right TOC panes. Widths are bounded
to reserve space for readable note content and optionally persist per browser.
On small screens and canvas pages, the garden's standard layout is used.

The right pane includes a 20px inner buffer in addition to the content gap.
Install TOC Settings to configure this buffer in the garden plugin menu.

Drag a pane to its minimum width to close it. Keep holding and reverse the
drag to reopen it immediately. Releasing the drag saves the final state; a
small screen-edge button reopens a closed pane afterward. Collapsed states persist alongside widths when persistence is
enabled. On mobile, the garden's regular navigation remains available.

This is a **garden site plugin**, installed through the Digital Garden plugin
menu in Obsidian. It is not a standalone Obsidian plugin. It requires a garden
template and Digital Garden version with garden plugin support.

## Create a GitHub repository

Open a terminal in this folder and run:

```sh
git init -b main
git add .
git commit -m "Initial resizable panes plugin"
gh repo create garden-plugin-resizable-panes --public --source=. --remote=origin --push
```

The last command requires GitHub CLI and an authenticated account. Alternatively,
create an empty public repository on GitHub, then add its remote and push.
The required `garden-plugin.json` is already at the repository root; no build
step or dependency installation is needed.

## Install and configure

In Obsidian's Digital Garden settings, open the garden plugin menu and paste
your new repository URL into **Install from GitHub**. The installer copies the
plugin into the garden and records it in the plugin registry. Use the installed
plugin's settings to enable it, set pane boundaries and defaults, and toggle
width persistence. Publish/redeploy the garden after changing settings.

For development against a local garden clone:

```sh
npm run install:garden -- /path/to/my-digital-garden
```

This copies the runtime files and preserves the garden's plugin registry and
settings. The garden loader discovers the manifest automatically.

## Validate and release

```sh
npm run check
npm test
```

Update `version` in `garden-plugin.json` and `package.json`, commit, and push.
The installer prefers the latest GitHub release, falling back to the default
branch when there are no releases. If using releases, publish a new release
for every update. Use the garden plugin menu to install updates.

Saved widths override default widths. To reset them for a site, remove
`dgResizablePanes.leftWidth` and `dgResizablePanes.rightWidth` from that site's
browser localStorage. Browser storage failures are handled without stopping
the layout.

## Implementation

`assets/resizable-panes.js` handles resizing and persistence;
`styles/resizable-panes.css` contains layout and overflow rules;
`templates/config.njk` injects the configured settings.
The runtime observes only pane visibility attributes and batches updates into
animation frames, avoiding recursive updates caused by its own body classes.
