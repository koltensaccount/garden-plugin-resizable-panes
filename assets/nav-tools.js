(function () {
  "use strict";
  if (window.DGNavTools) return;
  var queued = false;
  var observing = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      var nav = document.querySelector('.filetree-sidebar');
      var footer = document.querySelector('.dg-nav-tools-footer');
      if (!footer) return;
      var wrapper = nav && nav.closest('.filetree-wrapper');
      var rect = wrapper && wrapper.getBoundingClientRect();
      var hidden = !nav || !rect || !rect.width || !rect.height || rect.right <= 0 || rect.left >= innerWidth || getComputedStyle(wrapper).visibility === 'hidden' || document.body.classList.contains('dg-rp-left-closed');
      var parent = hidden ? document.body : nav;
      if (footer.parentNode !== parent) parent.appendChild(footer);
      footer.classList.toggle('dg-nav-tools-fallback', hidden);
    });
  }
  window.DGNavTools = {
    version: 1,
    mount: function (id, control) {
      var existing = document.getElementById(id);
      if (existing) return existing;
      var nav = document.querySelector(".filetree-sidebar");
      var footer;
      if (nav) {
        nav.classList.add("dg-nav-tools");
        var content = nav.querySelector(":scope > .dg-nav-tools-content");
        if (!content) {
          content = document.createElement("div");
          content.className = "dg-nav-tools-content";
          while (nav.firstChild) content.appendChild(nav.firstChild);
          nav.appendChild(content);
        }
        footer = document.querySelector('.dg-nav-tools-footer');
        if (!footer) {
          footer = document.createElement("div");
          footer.className = "dg-nav-tools-footer";
          nav.appendChild(footer);
        }
      } else {
        footer = document.querySelector(".dg-nav-tools-fallback");
        if (!footer) {
          footer = document.createElement("div");
          footer.className = "dg-nav-tools-footer dg-nav-tools-fallback";
          document.body.appendChild(footer);
        }
      }
      control.id = id;
      footer.appendChild(control);
      if (!observing) {
        observing = true;
        window.addEventListener('resize', schedule, {passive:true});
        var observer = new MutationObserver(schedule);
        observer.observe(document.body, {attributes:true, attributeFilter:['class']});
        if (nav) {
          observer.observe(nav, {attributes:true, attributeFilter:['class','style','hidden']});
          var wrapper = nav.closest('.filetree-wrapper');
          if (wrapper) observer.observe(wrapper, {attributes:true, attributeFilter:['class','style','hidden']});
        }
      }
      schedule();
      return control;
    }
  };
})();
