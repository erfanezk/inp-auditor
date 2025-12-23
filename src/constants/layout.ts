// Based on: https://gist.github.com/paulirish/5d52fb081b3570c81e3a
// Properties and methods that force layout/reflow when read

export const LAYOUT_READ_PROPERTIES = [
  "offsetWidth",
  "offsetHeight",
  "offsetTop",
  "offsetLeft",
  "offsetParent",
  "clientWidth",
  "clientHeight",
  "clientLeft",
  "clientTop",
  "getBoundingClientRect",
  "getClientRects",
  "scrollWidth",
  "scrollHeight",
  "scrollTop",
  "scrollLeft",
  "computedRole",
  "computedName",
  "innerText",
  "scrollX",
  "scrollY",
  "innerHeight",
  "innerWidth",
  "getComputedStyle",
] as const;

export const LAYOUT_READ_VISUAL_VIEWPORT = ["height", "width", "offsetTop", "offsetLeft"] as const;

export const LAYOUT_READ_DOCUMENT = [
  "scrollingElement", // Only forces style
  "elementFromPoint",
] as const;

export const LAYOUT_READ_MOUSE_EVENT = ["layerX", "layerY", "offsetX", "offsetY"] as const;

export const LAYOUT_READ_RANGE = ["getClientRects", "getBoundingClientRect"] as const;

export const LAYOUT_WRITE_STYLE_PROPERTIES = [
  "width",
  "height",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "border",
  "borderWidth",
  "borderTop",
  "borderRight",
  "borderBottom",
  "borderLeft",
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
] as const;

export const LAYOUT_WRITE_DOM_METHODS = [
  "appendChild",
  "removeChild",
  "insertBefore",
  "replaceChild",
  "innerHTML",
  "innerText",
  "textContent",
] as const;

export const LAYOUT_WRITE_SCROLL_METHODS = [
  "scrollBy",
  "scrollTo",
  "scrollIntoView",
  "scrollIntoViewIfNeeded",
] as const;

export const LAYOUT_WRITE_FOCUS_METHODS = ["focus", "select"] as const;

export const LAYOUT_WRITE_SCROLL_PROPERTIES = ["scrollTop", "scrollLeft"] as const;
