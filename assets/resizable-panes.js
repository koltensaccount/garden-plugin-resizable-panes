(function () {
  "use strict";

  var config = Object.assign(
    {
      enabled: true,
      defaultLeftWidth: 260,
      defaultRightWidth: 300,
      minPaneWidth: 200,
      maxViewportPercent: 40,
      mainMinWidth: 560,
      paneGap: 24,
      persistWidths: true
    },
    window.DG_RESIZABLE_PANES || {}
  );

  if (!config.enabled) return;

  var STORAGE_LEFT = "dgResizablePanes.leftWidth";
  var STORAGE_RIGHT = "dgResizablePanes.rightWidth";
  var MOBILE_BREAKPOINT = 1000;

  var state = {
    leftClosed: readClosed("left"),
    rightClosed: readClosed("right"),
    leftWidth: readNumber(STORAGE_LEFT, asNumber(config.defaultLeftWidth, 260)),
    rightWidth: readNumber(STORAGE_RIGHT, asNumber(config.defaultRightWidth, 300)),
    activeDrag: null,
    startX: 0,
    startLeft: 0,
    startRight: 0
  };

  function readClosed(side) {
    if (!config.persistWidths) return false;
    try { return localStorage.getItem("dgResizablePanes." + side + "Closed") === "true"; }
    catch (_) { return false; }
  }

  function saveClosed() {
    if (!config.persistWidths) return;
    try {
      localStorage.setItem("dgResizablePanes.leftClosed", String(state.leftClosed));
      localStorage.setItem("dgResizablePanes.rightClosed", String(state.rightClosed));
    } catch (_) {}
  }

  function asNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
  }

  function readNumber(key, fallback) {
    if (!config.persistWidths) return fallback;
    try {
      var value = Number(localStorage.getItem(key));
      return Number.isFinite(value) && value > 0 ? value : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeNumber(key, value) {
    if (!config.persistWidths) return;
    try {
      localStorage.setItem(key, String(Math.round(value)));
    } catch (_) {}
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getEls() {
    return {
      left: document.querySelector(".filetree-wrapper"),
      right: document.querySelector("#page-panel.sidebar, .sidebar#page-panel"),
      content: document.querySelector("main.content, .content")
    };
  }

  function hasVisibleBox(el) {
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getLimits(leftExists, rightExists) {
    var minPane = asNumber(config.minPaneWidth, 200);
    var mainMin = asNumber(config.mainMinWidth, 560);
    var gap = asNumber(config.paneGap, 24);
    var maxRatio = clamp(asNumber(config.maxViewportPercent, 40), 5, 80) / 100;
    var paneCount = (leftExists ? 1 : 0) + (rightExists ? 1 : 0);
    var viewportMax = Math.floor(window.innerWidth * maxRatio);
    var spaceBound = paneCount > 0
      ? Math.floor((window.innerWidth - mainMin - gap * 2) / paneCount)
      : viewportMax;

    return {
      minPane: minPane,
      maxPane: Math.max(minPane, Math.min(viewportMax, spaceBound)),
      mainMin: mainMin,
      gap: gap
    };
  }

  function canUseResizableLayout(leftExists, rightExists, content) {
    if (!content || content.classList.contains("canvas-page")) return false;
    if (window.innerWidth < MOBILE_BREAKPOINT) return false;

    var limits = getLimits(leftExists, rightExists);
    var paneMinimums = (leftExists ? limits.minPane : 0) + (rightExists ? limits.minPane : 0);
    var gapSpace = limits.gap * 2;
    return window.innerWidth >= paneMinimums + limits.mainMin + gapSpace;
  }

  function enforceBounds(leftExists, rightExists) {
    var limits = getLimits(leftExists, rightExists);

    if (leftExists) {
      state.leftWidth = clamp(state.leftWidth, limits.minPane, limits.maxPane);
    }

    if (rightExists) {
      state.rightWidth = clamp(state.rightWidth, limits.minPane, limits.maxPane);
    }

    var left = leftExists ? state.leftWidth : 0;
    var right = rightExists ? state.rightWidth : 0;
    var gapSpace = limits.gap * 2;
    var availableMain = window.innerWidth - left - right - gapSpace;

    if (availableMain < limits.mainMin) {
      var deficit = limits.mainMin - availableMain;
      var leftCanGive = leftExists ? Math.max(0, state.leftWidth - limits.minPane) : 0;
      var rightCanGive = rightExists ? Math.max(0, state.rightWidth - limits.minPane) : 0;
      var totalCanGive = leftCanGive + rightCanGive;

      if (totalCanGive > 0) {
        state.leftWidth -= deficit * (leftCanGive / totalCanGive);
        state.rightWidth -= deficit * (rightCanGive / totalCanGive);
      }

      if (leftExists) {
        state.leftWidth = clamp(state.leftWidth, limits.minPane, limits.maxPane);
      }

      if (rightExists) {
        state.rightWidth = clamp(state.rightWidth, limits.minPane, limits.maxPane);
      }
    }

    return limits;
  }

  function ensureSplitter(className, label, side) {
    var existing = document.querySelector("." + className);
    if (existing) return existing;

    var splitter = document.createElement("div");
    splitter.className = "dg-rp-splitter " + className;
    splitter.setAttribute("role", "separator");
    splitter.setAttribute("aria-label", label);
    splitter.setAttribute("aria-orientation", "vertical");
    splitter.addEventListener("mousedown", function (event) {
      beginDrag(event, side);
    });
    splitter.addEventListener("touchstart", function (event) {
      beginDrag(event, side);
    }, { passive: false });
    document.body.appendChild(splitter);
    return splitter;
  }

  function removeSplitters() {
    document.querySelectorAll(".dg-rp-splitter").forEach(function (el) {
      el.remove();
    });
  }

  function updateRestore(side, visible) {
    var className = "dg-rp-restore-" + side;
    var button = document.querySelector("." + className);
    if (!visible) {
      if (button) button.remove();
      return;
    }
    if (button) return;
    button = document.createElement("button");
    button.type = "button";
    button.className = "dg-rp-restore " + className;
    button.title = side === "left" ? "Open navigation pane" : "Open table of contents pane";
    button.setAttribute("aria-label", button.title);
    button.innerHTML = '<i data-lucide="panel-' + side + '-open"></i><span aria-hidden="true">' + (side === "left" ? "&rsaquo;" : "&lsaquo;") + '</span>';
    button.addEventListener("click", function () {
      state[side + "Closed"] = false;
      document.body.classList.remove("dg-rp-" + side + "-closed");
      saveClosed();
      applyLayout();
    });
    document.body.appendChild(button);
    if (window.lucide) window.lucide.createIcons();
  }

  function applyLayout() {
    var els = getEls();
    var leftExists = !state.leftClosed && hasVisibleBox(els.left);
    var rightExists = !state.rightClosed && hasVisibleBox(els.right);

    // A collapsed pane has no box, but still belongs to this desktop layout.
    if (!els.left && !els.right) return;

    if (!canUseResizableLayout(leftExists, rightExists, els.content)) {
      endDrag();
      document.body.classList.remove("dg-rp-active");
      removeSplitters();
      updateRestore("left", false);
      updateRestore("right", false);
      return;
    }

    var limits = enforceBounds(leftExists, rightExists);

    document.documentElement.style.setProperty("--dg-rp-left-width", Math.round(state.leftWidth) + "px");
    document.documentElement.style.setProperty("--dg-rp-right-width", Math.round(state.rightWidth) + "px");
    document.documentElement.style.setProperty("--dg-rp-left-effective-width", leftExists ? Math.round(state.leftWidth) + "px" : "0px");
    document.documentElement.style.setProperty("--dg-rp-right-effective-width", rightExists ? Math.round(state.rightWidth) + "px" : "0px");
    document.documentElement.style.setProperty("--dg-rp-gap", Math.round(limits.gap) + "px");
    document.documentElement.style.setProperty("--dg-rp-left-gap", Math.round(limits.gap) + "px");
    document.documentElement.style.setProperty("--dg-rp-right-gap", Math.round(limits.gap) + "px");
    document.documentElement.style.setProperty("--dg-rp-main-min-width", Math.round(limits.mainMin) + "px");

    document.body.classList.add("dg-rp-active");
    document.body.classList.toggle("dg-rp-left-closed", state.leftClosed);
    document.body.classList.toggle("dg-rp-right-closed", state.rightClosed);
    updateRestore("left", !!els.left && state.leftClosed);
    updateRestore("right", !!els.right && state.rightClosed);

    if (leftExists) {
      ensureSplitter("dg-rp-left-splitter", "Resize left navigation pane", "left");
    } else {
      var leftSplitter = document.querySelector(".dg-rp-left-splitter");
      if (leftSplitter) leftSplitter.remove();
    }

    if (rightExists) {
      ensureSplitter("dg-rp-right-splitter", "Resize right sidebar pane", "right");
    } else {
      var rightSplitter = document.querySelector(".dg-rp-right-splitter");
      if (rightSplitter) rightSplitter.remove();
    }
  }

  function pointX(event) {
    if (event.touches && event.touches[0]) return event.touches[0].clientX;
    if (event.changedTouches && event.changedTouches[0]) return event.changedTouches[0].clientX;
    return event.clientX;
  }

  function beginDrag(event, side) {
    if (event.type === "mousedown" && event.button !== 0) return;
    event.preventDefault();

    state.activeDrag = side;
    state.startX = pointX(event);
    state.startLeft = state.leftWidth;
    state.startRight = state.rightWidth;

    document.body.classList.add("dg-rp-dragging");

    window.addEventListener("mousemove", onDrag, { passive: false });
    window.addEventListener("mouseup", endDrag, { passive: true });
    window.addEventListener("touchmove", onDrag, { passive: false });
    window.addEventListener("touchend", endDrag, { passive: true });
    window.addEventListener("touchcancel", endDrag, { passive: true });
    window.addEventListener("blur", endDrag);
  }

  function onDrag(event) {
    if (!state.activeDrag) return;
    event.preventDefault();

    var els = getEls();
    var limits = getLimits(hasVisibleBox(els.left), hasVisibleBox(els.right));
    var x = pointX(event);

    var side = state.activeDrag;
    var width = side === "left" ? state.startLeft + x - state.startX : state.startRight - x + state.startX;
    if (width <= limits.minPane) {
      state[side + "Closed"] = true;
      endDrag();
    } else state[side + "Width"] = clamp(width, limits.minPane, limits.maxPane);

    applyLayout();
  }

  function endDrag() {
    if (!state.activeDrag) return;

    state.activeDrag = null;
    document.body.classList.remove("dg-rp-dragging");

    writeNumber(STORAGE_LEFT, state.leftWidth);
    writeNumber(STORAGE_RIGHT, state.rightWidth);
    saveClosed();

    window.removeEventListener("mousemove", onDrag);
    window.removeEventListener("mouseup", endDrag);
    window.removeEventListener("touchmove", onDrag);
    window.removeEventListener("touchend", endDrag);
    window.removeEventListener("touchcancel", endDrag);
    window.removeEventListener("blur", endDrag);
  }

  function boot() {
    var queued = false;
    function scheduleApply() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () {
        queued = false;
        applyLayout();
      });
    }

    scheduleApply();
    window.addEventListener("resize", scheduleApply, { passive: true });
    window.addEventListener("load", scheduleApply, { once: true });

    // Observe only pane visibility. Watching body would observe our own writes.
    var observer = new MutationObserver(scheduleApply);
    var els = getEls();
    [els.left, els.right].forEach(function (pane) {
      if (pane) observer.observe(pane, {
        attributes: true,
        attributeFilter: ["class", "style", "hidden"]
      });
    });
    [50, 150, 350, 800, 1500].forEach(function (delay) {
      window.setTimeout(scheduleApply, delay);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
