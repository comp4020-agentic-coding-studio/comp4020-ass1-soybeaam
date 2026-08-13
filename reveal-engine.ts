// Pure reveal-engine logic: parsing, delay math, and the reveal/hide/none
// decision. No IntersectionObserver, no requestAnimationFrame, no window or
// document globals — everything here takes already-obtained Elements as
// arguments, so it can be unit-tested directly under Vitest/jsdom without
// mocking any browser APIs.

export const ANIMATIONS = [
  "fade-up",
  "fade-down",
  "fade-left",
  "fade-right",
  "fade",
  "scale",
  "text-reveal",
  "image-reveal",
] as const;

export type RevealAnimation = (typeof ANIMATIONS)[number];

export interface RevealConfig {
  animation: RevealAnimation;
  delay: number;
  replay: boolean;
  threshold: number;
  rootMargin: string;
}

export type RevealAction = "reveal" | "hide" | "none";

const DEFAULT_DELAY = 0;
const DEFAULT_THRESHOLD = 0.15;
const DEFAULT_ROOT_MARGIN = "0px 0px -10% 0px";

function isRevealAnimation(value: string | null): value is RevealAnimation {
  return value !== null && (ANIMATIONS as readonly string[]).includes(value);
}

/**
 * Reads an element's reveal configuration from its `data-*` attributes.
 * `data-animation` is required — throws if it's missing or not one of the
 * known animation names.
 */
export function parseRevealConfig(el: Element): RevealConfig {
  const animationAttr = el.getAttribute("data-animation");
  if (!isRevealAnimation(animationAttr)) {
    throw new Error(
      `parseRevealConfig: element is missing a valid data-animation attribute (got ${JSON.stringify(animationAttr)}). Expected one of: ${ANIMATIONS.join(", ")}.`,
    );
  }

  const delayAttr = el.getAttribute("data-delay");
  const delay = delayAttr !== null && delayAttr !== "" ? Number(delayAttr) : DEFAULT_DELAY;

  const replay = el.getAttribute("data-replay") === "true";

  const thresholdAttr = el.getAttribute("data-threshold");
  const threshold =
    thresholdAttr !== null && thresholdAttr !== "" ? Number(thresholdAttr) : DEFAULT_THRESHOLD;

  const rootMarginAttr = el.getAttribute("data-root-margin");
  const rootMargin = rootMarginAttr !== null && rootMarginAttr !== "" ? rootMarginAttr : DEFAULT_ROOT_MARGIN;

  return {
    animation: animationAttr,
    delay: Number.isFinite(delay) ? delay : DEFAULT_DELAY,
    replay,
    threshold: Number.isFinite(threshold) ? threshold : DEFAULT_THRESHOLD,
    rootMargin,
  };
}

/**
 * A child's effective reveal delay: its own delay plus its position in a
 * staggered container, multiplied by the container's per-item stagger.
 */
export function effectiveDelay(ownDelay: number, index: number, staggerMs: number): number {
  return ownDelay + index * staggerMs;
}

/**
 * Pure decision: given whether an element currently intersects the
 * viewport, whether it has already been revealed once before, and whether
 * it's allowed to replay, decide what should happen to it now.
 */
export function decideRevealAction(
  isIntersecting: boolean,
  hasBeenRevealed: boolean,
  replay: boolean,
): RevealAction {
  if (isIntersecting) {
    return hasBeenRevealed ? "none" : "reveal";
  }
  if (hasBeenRevealed && replay) {
    return "hide";
  }
  return "none";
}

/**
 * Applies a reveal decision to an element. The only DOM mutation the reveal
 * system performs is toggling a single class — all animation is CSS-driven.
 */
export function applyRevealAction(el: Element, action: RevealAction): void {
  if (action === "reveal") {
    el.classList.add("is-revealed");
  } else if (action === "hide") {
    el.classList.remove("is-revealed");
  }
}

/** A plain, structural stand-in for DOMRectReadOnly so this stays pure and testable with plain objects. */
export interface Rect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

/**
 * What fraction of `target`'s own area overlaps `root`.
 *
 * This exists instead of reading `IntersectionObserverEntry.intersectionRatio`
 * directly because that ratio is computed from the target's *rendered*
 * (clipped) area. A pre-reveal state built from `clip-path` — this site's
 * `image-reveal` uses `clip-path: inset(0 0 100% 0)` before it's revealed —
 * clips the element to zero visible area, so the native ratio is stuck at 0
 * forever and never crosses any threshold, no matter how far the element
 * scrolls into view: verified by comparing a plain element against one with
 * that clip-path applied in the same scroll test, in real Chromium. Working
 * from `boundingClientRect` (the target's unclipped layout box, still
 * accounts for CSS transforms) sidesteps that entirely and also protects any
 * other animation that clips or scales its pre-reveal state to near-nothing.
 *
 * reveal-observer.ts uses this for a *continuously recomputed* ratio (via a
 * gated rAF loop, not IntersectionObserver's own ratio) for a second, separate
 * reason: a native observer configured with a single `threshold: 0` only
 * fires when the target crosses the "any overlap at all" boundary. An
 * element that's already partially overlapping the viewport at page load
 * (e.g. a call-to-action sitting right at the fold) gets exactly one
 * callback, at whatever ratio it happened to start at — if that's below the
 * configured reveal threshold, no further callback ever arrives as the user
 * scrolls it further into view, because it never re-crosses the 0 boundary.
 * Recomputing this ratio every frame from live geometry sidesteps that too.
 */
export function geometricIntersectionRatio(target: Rect, root: Rect): number {
  const top = Math.max(target.top, root.top);
  const left = Math.max(target.left, root.left);
  const bottom = Math.min(target.bottom, root.bottom);
  const right = Math.min(target.right, root.right);
  if (bottom <= top || right <= left) return 0;

  const targetArea = target.width * target.height;
  if (targetArea <= 0) return 0;

  return ((bottom - top) * (right - left)) / targetArea;
}

interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Resolves one `rootMargin` component (e.g. `"-10%"` or `"12px"`) against the given axis size, in pixels. */
function resolveMarginComponent(raw: string, axisSize: number): number {
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value)) return 0;
  return raw.trim().endsWith("%") ? (value / 100) * axisSize : value;
}

/**
 * Parses an IntersectionObserver-style `rootMargin` string into concrete
 * pixel insets for a given viewport size. `rootMargin` follows the same 1–4
 * value shorthand as the CSS `margin` property (top, right, bottom, left —
 * missing values repeat from the opposite side). Percentages resolve against
 * the viewport's height for the top/bottom components and its width for
 * left/right, per the IntersectionObserver spec (not CSS's own margin
 * convention, which always resolves percentages against width).
 */
export function parseRootMargin(rootMargin: string, viewportWidth: number, viewportHeight: number): Insets {
  const parts = rootMargin.trim().split(/\s+/).filter(Boolean);
  const [top = "0px", right = top, bottom = top, left = right] = parts;

  return {
    top: resolveMarginComponent(top, viewportHeight),
    right: resolveMarginComponent(right, viewportWidth),
    bottom: resolveMarginComponent(bottom, viewportHeight),
    left: resolveMarginComponent(left, viewportWidth),
  };
}

/**
 * The effective root rectangle IntersectionObserver would use for a given
 * `rootMargin` against the current viewport: the viewport expanded (positive
 * margin) or contracted (negative margin) on each edge.
 */
export function expandedViewportRect(rootMargin: string, viewportWidth: number, viewportHeight: number): Rect {
  const insets = parseRootMargin(rootMargin, viewportWidth, viewportHeight);
  const top = -insets.top;
  const left = -insets.left;
  const bottom = viewportHeight + insets.bottom;
  const right = viewportWidth + insets.right;
  return { top, left, bottom, right, width: right - left, height: bottom - top };
}
