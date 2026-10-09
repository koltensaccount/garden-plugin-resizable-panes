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
  if (query.has('panelCase')) return pagePanelFixture(query.get('panelCase'));
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

function pagePanelFixture(kind) {
  const peer = process.env.DG_TOC_SETTINGS_DIR ? '<link rel="stylesheet" href="/peer-toc/styles/toc-settings.css"><script>window.DG_TOC_SETTINGS={noteSpacing:"Wide"};</script><script defer src="/peer-toc/assets/toc-settings.js"></script>' : '';
  const toc = ['pdf-toc', 'toc-only'].includes(kind) ? '<div class="toc"><div class="toc-container"><nav><ol><li><a href="#section">Section</a></li></ol></nav></div></div>' : '';
  const backlinks = kind !== 'toc-only' ? '<div class="backlinks"><div class="backlink-title">Pages mentioning this page</div><div class="backlink-list"><div class="backlink-card"><span class="no-backlinks-message">No other pages mentions this page</span></div></div></div>' : '';
  const graph = kind === 'graph-backlinks' ? '<div class="graph"><div id="link-graph" style="height:250px;border:1px solid gray;box-sizing:border-box">Graph fixture</div></div>' : '';
  const panel = kind !== 'no-panel' ? `<aside><div class="page-panel-backdrop"></div><div class="sidebar" id="page-panel"><div class="page-panel-header"><button class="page-panel-close">Close</button></div><div class="sidebar-container">${graph}${toc}${backlinks}</div></div></aside><button class="page-panel-toggle">On this page</button>` : '';
  const content = kind.startsWith('pdf') ? '<iframe class="pdf-embed" src="/fixture.pdf" title="Embedded PDF"></iframe>' : '<p>Ordinary Markdown note without a TOC.</p>';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width">
    <link rel="stylesheet" href="/styles/_core.fixture.css"><style>
    body{--background-primary:#fff;--background-secondary:#eee;--text-normal:#111;--text-muted:#555;--background-modifier-border:#ccc;--dg-toc-buffer:80px}
    .pdf-embed{width:100%;height:450px;border:0}#embedded-content{width:73px;margin:5px;padding:0}
    .page-panel-toggle{display:none;position:fixed;bottom:10px;right:50px}@media(max-width:1400px){.page-panel-toggle{display:block}}
    </style>${manifest.styles.map(f=>`<link rel="stylesheet" href="/${f}">`).join('')}
    <script>window.DG_RESIZABLE_PANES={};</script>${manifest.scripts.map(f=>`<script defer src="/${f}"></script>`).join('')}${peer}
    </head><body><div class="filetree-wrapper"><nav class="filetree-sidebar">Garden</nav></div>
    <main class="content">${content}<div class="content" id="embedded-content">Nested content</div></main>${panel}
    <script>
    const toggle=document.querySelector('.page-panel-toggle');
    function setOpen(open){document.querySelector('#page-panel')?.classList.toggle('is-open',open);document.body.classList.toggle('page-panel-open',open)}
    toggle?.addEventListener('click',()=>setOpen(!document.body.classList.contains('page-panel-open')));
    document.querySelector('.page-panel-close')?.addEventListener('click',()=>setOpen(false));
    matchMedia('(max-width:1400px)').addEventListener('change',e=>{if(!e.matches)setOpen(false)})
    </script></body></html>`;
}

test("browser feature, keyboard, repeat initialization and responsive safety", { timeout: 60000 }, async () => {
  assert(chrome, "Install Chrome/Edge or set CHROME_PATH");
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith('/peer-toc/') && process.env.DG_TOC_SETTINGS_DIR) {
      const file=path.join(process.env.DG_TOC_SETTINGS_DIR,url.pathname.slice('/peer-toc/'.length));
      res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/css');res.end(fs.readFileSync(file));
    } else if (url.pathname === '/styles/_core.fixture.css') {
      res.setHeader('Content-Type','text/css');
      res.end(fs.readFileSync(process.env.DG_UPSTREAM_CSS || path.join(root,'tests/fixtures/page-panel.css')));
    } else if (url.pathname === '/fixture.pdf') {
      // A real, minimal one-page PDF; no network or OS viewer dependency.
      const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>'];
      let pdf='%PDF-1.4\n', offsets=[0];
      objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});
      const xref=Buffer.byteLength(pdf);
      pdf+='xref\n0 4\n0000000000 65535 f \n'+offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
      res.setHeader('Content-Type','application/pdf');res.end(pdf);
    } else if (url.pathname.startsWith("/styles/_theme.")) {
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
    if (id === 'resizable-panes') {
      await page.evaluate(()=>localStorage.clear());
      async function checkPanelGeometry() {
        const geometry = await page.evaluate(() => {
          const main=document.querySelector('main.content'),panel=document.querySelector('#page-panel'),pdf=document.querySelector('.pdf-embed');
          const box=el=>el&&({left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width});
          const text=[];
          for(const el of document.querySelectorAll('.backlink-title,.no-backlinks-message,.backlink-card a')){const range=document.createRange();range.selectNodeContents(el);for(const rect of range.getClientRects())text.push({left:rect.left,right:rect.right});}
          return {main:box(main),panel:box(panel),pdf:box(pdf),text,gap:parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dg-rp-gap')),nested:getComputedStyle(document.querySelector('#embedded-content')).width,container:box(document.querySelector('#page-panel .sidebar-container')),overflow:document.querySelector('#page-panel .sidebar-container')?.scrollWidth-document.querySelector('#page-panel .sidebar-container')?.clientWidth};
        });
        assert.equal(geometry.nested,'73px','Nested .content must not inherit main geometry');
        if(geometry.panel){
          assert(geometry.main.right <= geometry.panel.left-geometry.gap+1,'Main ends before managed panel gap');
          assert(geometry.container.left>=geometry.panel.left-1 && geometry.container.right<=geometry.panel.right+1,'Sidebar container fits selected pane');
          assert(geometry.overflow<=1,'No clipping or horizontal overflow disguises bad containment');
          for(const rect of geometry.text)assert(rect.left>=geometry.panel.left-1&&rect.right<=geometry.panel.right+1,'Backlink text stays in its allocated pane');
        }
        if(geometry.pdf)assert(geometry.pdf.left>=geometry.main.left-1&&geometry.pdf.right<=geometry.main.right+1,'PDF stays inside main, not under panel');
        return geometry;
      }
      for (const kind of ['pdf-backlinks','markdown-backlinks','pdf-toc','toc-only','graph-backlinks','no-panel']) {
        await page.setViewportSize({width:1600,height:900});
        await page.goto(base+'/?panelCase='+kind);
        await page.waitForFunction(()=>document.body.classList.contains('dg-rp-active'));
        assert.equal(await page.locator('.toc-container').count(),['pdf-toc','toc-only'].includes(kind)?1:0);
        if(kind!=='no-panel')assert.equal(await page.locator('.sidebar-container').evaluate(el=>getComputedStyle(el).paddingLeft),process.env.DG_TOC_SETTINGS_DIR&&['pdf-toc','toc-only'].includes(kind)?'36px':'0px','Only TOC Settings owns desktop TOC buffer');
        const widths=kind==='pdf-backlinks'?[1600,1401,1400,1200,1001,1000,390]:[1600,1200];
        for(const width of widths){
          await page.setViewportSize({width,height:900});await page.waitForTimeout(width<=1400?300:80);
          if(width>1400){
            const geometry=await checkPanelGeometry();
            if(process.env.DG_REPORT_LAYOUT&&kind==='pdf-backlinks'){
              console.log('PDF/backlinks geometry',width,JSON.stringify(geometry));
            }
            assert.equal(await page.locator('.dg-rp-right-splitter').count(),kind==='no-panel'?0:1);
          }
          else{
            assert.equal(await page.locator('.dg-rp-splitter').count(),0);
            assert.equal(await page.locator('body').evaluate(el=>el.classList.contains('dg-rp-active')),false);
            assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--dg-rp-right-effective-width').trim()),'0px');
            if(kind!=='no-panel'){
              const panel=page.locator('#page-panel');
              const css=await panel.evaluate(el=>{const s=getComputedStyle(el);return {direction:s.flexDirection,visibility:s.visibility,max:s.maxWidth,min:s.minWidth,transform:s.transform};});
              assert.equal(css.direction,'column');assert.equal(css.visibility,'hidden');assert.equal(css.min,'0px');assert.equal(css.max,width>=760?'720px':'none');assert.notEqual(css.transform,'none');
              await page.locator('.page-panel-toggle').click();await page.waitForTimeout(300);
              const opened=await panel.evaluate(el=>({transform:getComputedStyle(el).transform,visibility:getComputedStyle(el).visibility,width:el.getBoundingClientRect().width,left:el.getBoundingClientRect().left}));
              assert.equal(opened.transform,'none');assert.equal(opened.visibility,'visible');assert(Math.abs(opened.width-Math.min(width,720))<1,'Core sheet width is not a custom pane width');
              assert(Math.abs(opened.left-(width-opened.width)/2)<1);
              assert.equal(await page.locator('.sidebar-container').evaluate(el=>getComputedStyle(el).paddingLeft),'20px','Core sheet padding unchanged');
              await page.locator('.page-panel-close').click();await page.waitForTimeout(300);
            }
          }
        }
      }
      await page.setViewportSize({width:1600,height:900});await page.goto(base+'/?panelCase=pdf-backlinks');
      const right=page.locator('.dg-rp-right-splitter');await right.focus();await page.keyboard.press('Home');await checkPanelGeometry();
      assert.equal(await right.getAttribute('aria-valuenow'),'200');
      await page.locator('.backlink-card').evaluate(el=>{const link=document.createElement('a');link.textContent='https://example.com/'+ 'longpath'.repeat(25);el.replaceChildren(link);});
      await checkPanelGeometry();
      await right.focus();await page.keyboard.press('End');await checkPanelGeometry();
      assert.equal(await right.getAttribute('aria-valuenow'),await right.getAttribute('aria-valuemax'));
      await page.locator('#dg-reading-width-control').click();await page.locator('#dg-reading-width').fill('640');await page.locator('.dg-rp-width-dialog button[type="submit"]').click();
      const limited=await checkPanelGeometry();assert(limited.main.width<=641);
      await right.focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('.dg-rp-restore-right').getAttribute('aria-label'),'Open page panel');
      await page.setViewportSize({width:1400,height:900});await page.waitForTimeout(80);await page.locator('.page-panel-toggle').click();await page.waitForTimeout(300);
      assert.equal(await page.locator('#page-panel').isVisible(),true,'Desktop collapsed state cannot hide the core sheet');
      await page.locator('.page-panel-close').click();await page.setViewportSize({width:1600,height:900});await page.waitForTimeout(80);
      await page.locator('.dg-rp-restore-right').click();await checkPanelGeometry();
      await page.locator('#dg-reading-width-control').click();await page.locator('.dg-rp-width-reset').click();await page.locator('.dg-rp-width-dialog button[type="submit"]').click();await checkPanelGeometry();
      assert.deepEqual(errors,[]);
    }
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
