(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DirectionCEntryDrag = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function pointerToUnitPosition(event, rect) {
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    };
  }

  function create(options) {
    if (!options || typeof options.getRect !== "function" || typeof options.onPosition !== "function") {
      throw new Error("getRect and onPosition are required");
    }
    let dragging = false;

    function apply(event) {
      options.onPosition(pointerToUnitPosition(event, options.getRect()));
    }

    return Object.freeze({
      down(event) {
        if (event.button !== 0) return false;
        dragging = true;
        apply(event);
        if (typeof event.preventDefault === "function") event.preventDefault();
        return true;
      },
      move(event) {
        if (!dragging) return false;
        apply(event);
        if (typeof event.preventDefault === "function") event.preventDefault();
        return true;
      },
      up() {
        const wasDragging = dragging;
        dragging = false;
        return wasDragging;
      },
      isDragging() { return dragging; }
    });
  }

  return Object.freeze({ pointerToUnitPosition, create });
});
