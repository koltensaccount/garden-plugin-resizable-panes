const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../assets/resizable-panes.js"), "utf8");

function boot(enabled = true, stored = {}) {
  const observed = [];
  const frames = [];
  const timers = [];
  const listeners = {};
  const pane = { getBoundingClientRect: () => ({ width: 250, height: 800 }) };
  const content = { classList: { contains: () => false } };
  const splitters = new Map();
  const body = {
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild(el) { splitters.set(el.className.split(" ")[1], el); }
  };
  const document = {
    body,
    readyState: "complete",
    documentElement: { style: { setProperty() {} } },
    querySelector(selector) {
      if (selector === ".filetree-wrapper" || selector.includes("#page-panel")) return pane;
      if (selector.includes("main.content")) return content;
      return splitters.get(selector.slice(1)) || null;
    },
    querySelectorAll: () => [],
    createElement: () => ({
      events: {},
      setAttribute() {},
      addEventListener(name, callback) { this.events[name] = callback; },
      remove() { splitters.delete(this.className.split(" ")[1]); }
    })
  };
  const window = {
    DG_RESIZABLE_PANES: { enabled },
    innerWidth: 1440,
    addEventListener(name, fn) { listeners[name] = fn; },
    removeEventListener(name) { delete listeners[name]; },
    requestAnimationFrame(fn) { frames.push(fn); },
    setTimeout(fn) { timers.push(fn); }
  };
  vm.runInNewContext(source, {
    document, window,
    getComputedStyle: () => ({ flexDirection: "row" }),
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
  return { observed, frames, timers, listeners, body, splitters, stored };
}

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
