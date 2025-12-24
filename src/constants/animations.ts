export const JAVASCRIPT_ANIMATION_PATTERNS = [
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "setInterval",
  "setTimeout", // Use setTimeout for animation
];

export const CSS_ANIMATION_PATTERNS = ["animation", "transition", "@keyframes", "transform"];

export const NON_COMPOSITED_CSS_PROPERTIES = [
  "width",
  "height",
  "left",
  "top",
  "right",
  "bottom",
  "margin",
  "padding",
  "border",
  "background-position",
  "font-size",
  "line-height",
  "position",
];

export const COMPOSITED_CSS_PROPERTIES = [
  "opacity",
  "transform",
  "filter",
  "backdrop-filter",
  "perspective",
  "scale",
  "rotate",
  "translate",
];
