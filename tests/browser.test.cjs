const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright-core");
const root = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "garden-plugin.json")));
const chrome = process.env.CHROME_PATH || ["/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].find(file => fs.existsSync(file));
const configNames = { "resizable-panes": "DG_RESIZABLE_PANES", "toc-settings": "DG_TOC_SETTINGS", "reading-progress": "DG_READING_PROGRESS", "theme-toggle": "DG_THEME_TOGGLE", "clean-print": "DG_CLEAN_PRINT" };

function fixture(url) {
  const query = new URL(url, "http://localhost").searchParams;
  const defaults = Object.fromEntries((manifest.settings || []).map(setting => [setting.key, setting.default]));
  if (manifest.id === "reading-progress") defaults.resumeReading = true;
  if (manifest.id === "theme-toggle" && query.has("remember")) defaults.rememberMode = query.get("remember") !== "false";
  const config = configNames[manifest.id] ? `<script>window.${configNames[manifest.id]}=${JSON.stringify(defaults)};</script>` : "";
  const lock = manifest.id === "note-lock" ? require("../index.js").createResolver({ defaultPassword: "browser fixture only", notePasswords: "{}" })("/", true) : null;
  const lockHead = lock ? `<script type="application/json" id="dg-note-lock-config">${lock}</script><script>document.documentElement.classList.add('dg-note-locked');</script>` : "";
  const body = query.has("canvas") ? "canvas-page" : "";
  const nav = query.has("noNav") ? "" : '<div><div class="filetree-wrapper"><nav class="filetree-sidebar"><h2>Compatibility Garden</h2><a href="/second/">Another note</a></nav></div></div>';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Fixture note</title><link rel="stylesheet" href="/styles/_theme.test.css"><style>
  body{margin:0;background:var(--background-primary);color:var(--text-normal);font-family:Arial;--dg-content-font-size:18px;--dg-content-line-height:1.5;--dg-toc-font-size:16px;--dg-toc-max-height:70vh;--dg-toc-item-padding:4px 0;--dg-toc-indent:14px;--background-modifier-border:#777;--text-muted:#888}
  .filetree-wrapper{position:fixed;left:0;top:0;width:260px;height:100vh;display:flex;background:var(--background-secondary);z-index:10}.filetree-sidebar{width:100%;height:100%;box-sizing:border-box;padding:20px;display:flex;flex-direction:column}.sidebar{position:fixed;right:0;top:0;width:300px;height:100vh;display:flex;flex-direction:row}.sidebar-container{width:100%;padding:20px;box-sizing:border-box}.toc-container{max-height:var(--dg-toc-max-height);overflow:auto;font-size:var(--dg-toc-font-size)}.toc-container li{padding:var(--dg-toc-item-padding)}main.content{margin:0 324px 0 284px;max-width:700px;font-size:var(--dg-content-font-size);line-height:var(--dg-content-line-height);padding-top:30px}button,input,select{font:inherit}button{cursor:pointer}dialog::backdrop{background:#0006}
  @media(max-width:1400px){.sidebar{flex-direction:column;width:100%;bottom:0;top:auto;max-height:80vh;visibility:hidden;transform:translateY(100%)}.sidebar.is-open{visibility:visible;transform:none}.toc-container{max-height:none}main.content{margin-right:20px}.filetree-wrapper{width:250px}}
  @media(max-width:999px){.filetree-wrapper{display:none}main.content{margin:20px}}
  </style>${(manifest.styles || []).map(file => `<link rel="stylesheet" href="/${file}">`).join("")}${config}${lockHead}${(manifest.scripts || []).map(file => `<script defer src="/${file}"></script>`).join("")}</head><body class="theme-dark">${nav}<main class="content ${body}"><header><h1>Fixture note</h1></header><h1 id="chapter">Chapter</h1><p>Introductory text <a href="https://example.com/reference">Reference</a>.</p><h2 id="first">First section</h2><p id="first-body">${"Readable paragraphs fill this section and make progress measurable. ".repeat(100)}</p><h3 id="nested">Nested heading</h3><p id="nested-body">Nested section text.</p><h2 id="second">Second section</h2><p>${"Second section content and conclusions. ".repeat(90)}</p><details><summary>Details</summary><p>Extra information</p></details><img loading="lazy" alt="Fixture" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBqkAAAAASUVORK5CYII="></main><aside><div class="sidebar" id="page-panel"><div class="sidebar-container"><div class="toc-title-container">Contents</div><div class="toc-container"><nav class="toc"><ol><li><a href="#chapter">Chapter</a><ol><li><a href="#first">First section</a><ol><li><a href="#nested">Nested heading</a></li></ol></li><li><a href="#second">Second section</a></li></ol></li></ol></nav></div></div></div></aside><script>
  function coreActive(){const links=[...document.querySelectorAll('.toc-container a')];let current=links[0];for(const link of links){if(document.getElementById(link.hash.slice(1)).getBoundingClientRect().top<=100)current=link;}links.forEach(link=>link.classList.toggle('toc-active',link===current));}window.addEventListener('scroll',coreActive,{passive:true});coreActive();window.print=()=>{window.printInvocations=(window.printInvocations||0)+1;};</script></body></html>`;
}

test("browser feature, keyboard, repeat initialization and responsive safety", { timeout: 60000 }, async () => {
  assert(chrome, "Install Chrome/Edge or set CHROME_PATH");
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/styles/_theme.")) {
      res.setHeader("Content-Type", "text/css");
      const single = url.searchParams.get("single");
      const dark = '.theme-dark{--background-primary:#151719;--background-secondary:#202428;--text-normal:#f4f4f4;--interactive-accent:#8fbbaa;--text-accent:#8fbbaa;--text-on-accent:#111}';
      const light = '.theme-light{--background-primary:#fafafa;--background-secondary:#eeeeee;--text-normal:#171717;--interactive-accent:#367662;--text-accent:#367662;--text-on-accent:#fff}';
      res.end(single === 'light' ? light : single === 'dark' ? dark : dark + light);
    } else if (/^\/(assets|styles)\//.test(url.pathname)) {
      const file = path.join(root, url.pathname);
      res.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : "text/css");
      res.end(fs.readFileSync(file));
    } else { res.setHeader("Content-Type", "text/html"); res.end(fixture(req.url).replace('/styles/_theme.test.css', '/styles/_theme.test.css?single=' + (url.searchParams.get('single') || ''))); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base);
    const id = manifest.id;
    if (id === "heading-folding") {
      const fold = page.locator('#first > .dg-fold-button');
      await fold.focus(); await page.keyboard.press("Space");
      assert.equal(await fold.getAttribute("aria-expanded"), "false");
      assert.equal(await page.locator("#first-body").isVisible(), false);
      assert.equal(await page.locator("#second").isVisible(), true);
      await page.locator('.toc-container a[href="#nested"]').click();
      assert.equal(await page.locator("#nested").isVisible(), true);
      await fold.click();
      await page.emulateMedia({ media: "print" });
      assert.equal(await page.locator("#first-body").isVisible(), true);
      await page.emulateMedia({ media: "screen" });
      assert.equal(await fold.getAttribute("aria-expanded"), "false");
    } else if (id === "resizable-panes") {
      const separator = page.locator('.dg-rp-left-splitter');
      await separator.focus(); const before = Number(await separator.getAttribute("aria-valuenow"));
      await page.keyboard.press("ArrowRight");
      assert.equal(Number(await separator.getAttribute("aria-valuenow")), before + 10);
      await page.locator("#dg-reading-width-control").click();
      await page.locator("#dg-reading-width").fill("640");
      assert.equal(await page.locator(".dg-rp-width-dialog output").textContent(), "640 px");
      await page.locator('.dg-rp-width-dialog button[type="submit"]').click();
      assert((await page.locator("main.content").boundingBox()).width <= 641);
      await page.reload();
      assert((await page.locator("main.content").boundingBox()).width <= 641);
    } else if (id === "toc-settings") {
      const branch = page.locator(".dg-toc-branch").first();
      await branch.click(); assert.equal(await branch.getAttribute("aria-expanded"), "false");
      await page.locator("#second").scrollIntoViewIfNeeded();
      await page.waitForTimeout(80);
      assert.equal(await page.locator(".toc-container a.toc-active").count(), 1);
    } else if (id === "reading-progress") {
      assert.match(await page.locator(".dg-reading-meta").textContent(), /min read/);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(300);
      assert.equal(await page.locator(".dg-reading-progress").getAttribute("aria-valuenow"), "100");
    } else if (id === "theme-toggle") {
      await page.locator("#dg-appearance-control").click();
      await page.locator('[role="switch"]').uncheck();
      assert.equal(await page.locator("body").evaluate(body => body.classList.contains("theme-light")), true);
      assert(await page.locator(".dg-appearance-swatch").count() > 3);
      await page.locator(".dg-appearance-swatch").nth(1).click();
      const contrast = await page.evaluate(() => window.DGAppearanceColors.contrast(getComputedStyle(document.body).getPropertyValue("--text-accent"), getComputedStyle(document.body).getPropertyValue("--background-primary")));
      assert(contrast >= 4.5, "Accent contrast " + contrast);
      await page.locator('[name="size"]').fill("22");
      assert.equal(await page.locator("main.content").evaluate(el => getComputedStyle(el).fontSize), "22px");
    } else if (id === "clean-print") {
      await page.keyboard.press("Control+p");
      await page.locator('[name="preset"]').selectOption("Large Text");
      assert.equal(await page.locator('[name="textSize"]').inputValue(), "14");
      await page.locator('[name="linkUrls"]').check();
      await page.locator(".dg-print-submit").click();
      await page.waitForFunction(() => window.printInvocations === 1);
      assert.equal(await page.locator('details').evaluate(el => el.open), true);
      assert.equal(await page.locator("a[data-dg-print-url]").count(), 1);
      await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
      assert.equal(await page.locator('details').evaluate(el => el.open), false);
      assert.equal(await page.locator("a[data-dg-print-url]").count(), 0);
      assert.equal(await page.locator("img").getAttribute("loading"), "lazy");
    } else if (id === "note-lock") {
      await page.locator("#dg-note-lock-password").fill("wrong");
      await page.locator(".dg-note-lock-submit").click();
      await page.waitForFunction(() => document.getElementById("dg-note-lock-status").textContent.includes("did not match"));
      await page.locator("#dg-note-lock-password").fill("browser fixture only");
      await page.locator(".dg-note-lock-submit").click();
      await page.waitForFunction(() => !document.documentElement.classList.contains("dg-note-locked"));
    }
    for (const file of manifest.scripts || []) await page.addScriptTag({ url: base + "/" + file });
    assert(await page.locator(".dg-nav-tools-footer").count() <= 1);
    if (id === "heading-folding") assert.equal(await page.locator("#first > .dg-fold-button").count(), 1);
    for (const width of [1100, 390]) {
      await page.setViewportSize({ width, height: 844 }); await page.waitForTimeout(80);
      if (id === "resizable-panes") assert.equal(await page.locator(".dg-rp-right-splitter").count(), 0);
      if (id === "toc-settings") assert.equal(await page.locator(".toc-container").evaluate(el => getComputedStyle(el).maxHeight), "none");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, "Horizontal overflow at " + width);
    }
    assert.deepEqual(errors, []);
    await page.goto(base + "/?noNav");
    if (["resizable-panes", "theme-toggle", "clean-print"].includes(id)) assert.equal(await page.locator(".dg-nav-tools-fallback").count(), 1);
    await page.goto(base + "/?canvas");
    if (["resizable-panes", "reading-progress", "heading-folding", "clean-print"].includes(id)) assert.equal(await page.locator(".dg-rp-splitter,.dg-reading-progress,.dg-fold-button,.dg-print-dialog").count(), 0);
    if (id === 'theme-toggle') {
      await page.setViewportSize({width:1600,height:900});
      for (const mode of ['light', 'dark']) {
        await page.goto(base + '/?single=' + mode);
        await page.locator('#dg-appearance-control').click();
        assert.equal(await page.locator('.dg-appearance-mode').isVisible(), false);
        assert(await page.locator('body').evaluate((body, mode) => body.classList.contains('theme-' + mode), mode));
      }
      await page.evaluate(() => { localStorage.setItem('dgAppearanceReading.preferences', '{bad'); localStorage.setItem('dgThemeToggle.mode', 'light'); });
      await page.goto(base + '/?remember=false');
      assert(await page.locator('body').evaluate(body => body.classList.contains('theme-dark')));
      await page.locator('#dg-appearance-control').click();
      await page.locator('[name="size"]').fill('24');
      await page.locator('.dg-appearance-reset').click();
      assert.equal(await page.locator('body').evaluate(el => el.style.getPropertyValue('--dg-content-font-size')), '');
    }
    if (id === 'heading-folding') {
      await page.goto(base);
      await page.locator('#nested > .dg-fold-button').click();
      await page.locator('#first > .dg-fold-button').click();
      await page.locator('#first > .dg-fold-button').click();
      assert.equal(await page.locator('#nested-body').isVisible(), false, 'Nested closed state survives parent fold');
      await page.evaluate(() => { const heading = document.createElement('h2'); heading.id='dynamic'; heading.textContent='Dynamic'; const text = document.createElement('p'); text.textContent='Dynamic content'; document.querySelector('main.content').append(heading,text); });
      await page.waitForSelector('#dynamic > .dg-fold-button');
      assert.equal(await page.locator('#dynamic > .dg-fold-button').count(), 1);
    }
    if (id === 'reading-progress') {
      await page.setViewportSize({width:1600,height:900});
      await page.goto(base);
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight / 2));
      await page.waitForTimeout(350);
      assert(await page.evaluate(() => JSON.parse(localStorage.getItem('dgReadingProgress.position:/')).fraction > 0.03));
      await page.reload();
      await page.evaluate(() => scrollTo(0, 0));
      await page.locator('.dg-reading-meta button').click();
      await page.waitForTimeout(80);
      assert(await page.evaluate(() => scrollY > 0));
    }
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
