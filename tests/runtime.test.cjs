const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../assets/resizable-panes.js"), "utf8");

function boot(enabled = true) {
  const observed = [];
  const frames = [];
  const timers = [];
  const listeners = {};
  const pane = { getBoundingClientRect: () => ({ width: 250, height: 800 }) };
  const content = { classList: { contains: () => false } };
  const splitters = new Map();
  const body = {
    classList: { add() {}, remove() {} },
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
    createElement: () => ({ setAttribute() {}, addEventListener() {} })
  };
  const window = {
    DG_RESIZABLE_PANES: { enabled },
    innerWidth: 1440,
    addEventListener(name, fn) { listeners[name] = fn; },
    requestAnimationFrame(fn) { frames.push(fn); },
    setTimeout(fn) { timers.push(fn); }
  };
  vm.runInNewContext(source, {
    document, window,
    requestAnimationFrame: window.requestAnimationFrame,
    localStorage: { getItem() { throw new Error("Storage blocked"); } },
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe(target, options) { observed.push({ target, options, callback: this.callback }); }
    }
  });
  return { observed, frames, timers, listeners, body, splitters };
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
