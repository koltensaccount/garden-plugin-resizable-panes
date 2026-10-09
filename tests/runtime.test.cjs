const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../assets/resizable-panes.js"), "utf8");

function boot(enabled = true, stored = {}, width = 1440, paneMode = {}) {
  const observed = [];
  const frames = [];
  const timers = [];
  const listeners = {};
  const documentListeners = {};
  const pane = { getBoundingClientRect: () => ({ width: 250, height: paneMode.height === undefined ? 800 : paneMode.height }) };
  const content = { classList: { contains: () => false } };
  const splitters = new Map();
  const classes = new Set();
  const variables = new Map();
  const body = {
    style: { setProperty() {} },
    classList: { add(...names) { names.forEach(name=>classes.add(name)); }, remove(...names) { names.forEach(name=>classes.delete(name)); }, toggle(name, force) { if(force)classes.add(name);else classes.delete(name); } },
    appendChild(el) { splitters.set(el.className.split(" ")[1], el); }
  };
  const document = {
    addEventListener(name, callback) { documentListeners[name] = callback; },
    body,
    readyState: "complete",
    documentElement: { style: { setProperty(key,value) { variables.set(key,value); } } },
    querySelector(selector) {
      if (selector === ".filetree-wrapper" || selector.includes("#page-panel")) return pane;
      if (selector.includes("main.content")) return content;
      return splitters.get(selector.slice(1)) || null;
    },
    querySelectorAll: selector => selector === '.dg-rp-splitter' ? [...splitters.values()].filter(el=>el.className.startsWith('dg-rp-splitter ')) : [],
    createElement: () => ({
      events: {},
      setAttribute() {},
      addEventListener(name, callback) { this.events[name] = callback; },
      remove() { splitters.delete(this.className.split(" ")[1]); }
    })
  };
  const window = {
    DG_RESIZABLE_PANES: { enabled },
    innerWidth: width,
    addEventListener(name, fn) { listeners[name] = fn; },
    removeEventListener(name) { delete listeners[name]; },
    requestAnimationFrame(fn) { frames.push(fn); },
    setTimeout(fn) { timers.push(fn); }
  };
  vm.runInNewContext(source, {
    document, window,
    getComputedStyle: () => ({ flexDirection: paneMode.direction || "row", display: paneMode.display || "flex" }),
    requestAnimationFrame: window.requestAnimationFrame,
    localStorage: {
      getItem(key) { return stored[key] || null; },
      setItem(key, value) { stored[key] = value; }
    },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(target, options) { observed.push({ target, options, callback: this.callback }); }
    }
  });
  return { observed, frames, timers, listeners, documentListeners, body, splitters, stored, window, classes, variables };
}

test('late password unlock reallocates the revealed panel without resize or pane mutations', () => {
  const mode={height:0,display:'none'};
  const runtime=boot(true,{},1600,mode);
  runtime.frames.shift()();
  runtime.timers.forEach(fn=>fn());
  while(runtime.frames.length)runtime.frames.shift()();
  assert.equal(runtime.variables.get('--dg-rp-right-effective-width'),'0px');
  mode.height=800;mode.display='flex';
  assert.equal(typeof runtime.documentListeners['dg:note-unlocked'],'function');
  runtime.documentListeners['dg:note-unlocked']();
  runtime.documentListeners['dg:note-unlocked']();
  assert.equal(runtime.frames.length,1,'Unlock updates are batched');
  runtime.frames.shift()();
  assert.equal(runtime.variables.get('--dg-rp-right-effective-width'),'300px');
  assert(runtime.splitters.has('dg-rp-right-splitter'));
  const mainRight=parseFloat(runtime.variables.get('--dg-rp-left-effective-width'))+parseFloat(runtime.variables.get('--dg-rp-gap'))+parseFloat(runtime.variables.get('--dg-rp-content-width'));
  const panelLeft=1600-parseFloat(runtime.variables.get('--dg-rp-right-effective-width'));
  assert(mainRight<=panelLeft-24,'Revealed panel has its own space');
});

test('desktop panel allocation does not depend on positive height or horizontal flex direction', () => {
  const runtime=boot(true,{},1600,{height:0,direction:'column'});
  runtime.frames.shift()();
  assert(runtime.classes.has('dg-rp-right-managed'));
  assert(runtime.splitters.has('dg-rp-right-splitter'));
  assert.equal(runtime.variables.get('--dg-rp-right-effective-width'),'300px');
});

test('core sheet boundary disables custom geometry even when computed flex direction is row', () => {
  const runtime=boot(true,{},1401);runtime.frames.shift()();
  assert(runtime.classes.has('dg-rp-active'));
  assert(runtime.splitters.has('dg-rp-right-splitter'));
  for(const width of [1400,1200,1001,1000,390]){
    runtime.window.innerWidth=width;runtime.listeners.resize();runtime.frames.shift()();
    assert(!runtime.classes.has('dg-rp-active'));
    assert(!runtime.classes.has('dg-rp-right-managed'));
    assert.equal(runtime.splitters.size,0);
    assert.equal(runtime.variables.get('--dg-rp-right-effective-width'),'0px');
    assert.equal(runtime.variables.get('--dg-rp-right-gap'),'0px');
  }
  runtime.window.innerWidth=1401;runtime.listeners.resize();runtime.frames.shift()();
  assert(runtime.classes.has('dg-rp-active'));
  assert(runtime.splitters.has('dg-rp-right-splitter'));
});

test("layout never observes its own mutations and visibility updates are batched", () => {
  const runtime = boot();
  assert.equal(runtime.observed.length, 2);
  for (const observation of runtime.observed) {
    assert.notEqual(observation.target, runtime.body);
    assert.equal(observation.options.subtree, undefined);
    observation.callback();
    observation.callback();
  }
  assert.equal(runtime.frames.length, 1);
  runtime.frames.shift()();
  assert.equal(runtime.splitters.size, 2);
  assert.equal(runtime.frames.length, 0);
  runtime.timers.forEach(fn => fn());
  runtime.listeners.resize();
  assert.equal(runtime.frames.length, 1);
  runtime.frames.shift()();
  assert.equal(runtime.frames.length, 0);
});

test("disabled runtime leaves the page alone", () => {
  const runtime = boot(false);
  assert.equal(runtime.frames.length, 0);
  assert.equal(runtime.observed.length, 0);
  assert.equal(runtime.timers.length, 0);
});

test("releasing at minimum saves the collapsed pane and allows button reopening", () => {
  const runtime = boot();
  runtime.frames.shift()();
  const splitter = runtime.splitters.get("dg-rp-left-splitter");
  splitter.events.mousedown({ type: "mousedown", button: 0, clientX: 260, preventDefault() {} });
  runtime.listeners.mousemove({ clientX: 200, preventDefault() {} });
  assert.equal(runtime.splitters.has("dg-rp-left-splitter"), false);
  assert.equal(typeof runtime.listeners.mousemove, "function");
  assert.equal(runtime.stored["dgResizablePanes.leftClosed"], undefined);
  runtime.listeners.mouseup();
  assert.equal(runtime.stored["dgResizablePanes.leftClosed"], "true");
  assert.equal(runtime.listeners.mousemove, undefined);
  const persisted = boot(true, runtime.stored);
  persisted.frames.shift()();
  assert.equal(persisted.splitters.has("dg-rp-left-splitter"), false);
  persisted.splitters.get("dg-rp-restore-left").events.click();
  assert.equal(persisted.splitters.has("dg-rp-left-splitter"), true);
  assert.equal(persisted.stored["dgResizablePanes.leftClosed"], "false");
});

for (const side of ["left", "right"]) {
  test(side + " pane can snap closed and reopen repeatedly during the same drag", () => {
    const runtime = boot();
    runtime.frames.shift()();
    runtime.splitters.get("dg-rp-" + side + "-splitter").events.mousedown({ type: "mousedown", button: 0, clientX: 500, preventDefault() {} });
    const collapsedX = side === "left" ? 420 : 620;
    const reopenedX = side === "left" ? 540 : 460;
    for (let attempt = 0; attempt < 2; attempt++) {
      runtime.listeners.mousemove({ clientX: collapsedX, preventDefault() {} });
      assert.equal(runtime.splitters.has("dg-rp-" + side + "-splitter"), false);
      assert.equal(runtime.stored["dgResizablePanes." + side + "Closed"], undefined);
      runtime.listeners.mousemove({ clientX: reopenedX, preventDefault() {} });
      assert.equal(runtime.splitters.has("dg-rp-" + side + "-splitter"), true);
    }
    runtime.listeners.mouseup();
    assert.equal(runtime.stored["dgResizablePanes." + side + "Closed"], "false");
    assert.equal(runtime.listeners.mousemove, undefined);
  });
}
