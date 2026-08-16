// Browser wiring for the reveal system: DOM scanning, the scroll/resize-driven
// gate and rAF loop that decide when elements are near/in the viewport, and
// the text-reveal word-splitting prep. All decision logic lives in
// reveal-engine.ts — this file only does the browser-API plumbing around it.

import {
  applyRevealAction,
  decideRevealAction,
  effectiveDelay,
  expandedViewportRect,
  geometricIntersectionRatio,
  parseRevealConfig,
  type RevealConfig,
} from "./reveal-engine";

// How generously an element is watched *before* it needs a precise
// intersection check — see the doc comment on initScrollReveal for why this
// two-stage (coarse gate, then exact per-frame math) design exists at all.
const GATE_ROOT_MARGIN = "25% 0px";

const TEXT_REVEAL_STAGGER_MS = 40;

/**
 * For every `[data-animation="text-reveal"]` element, split its text into
 * words and wrap each word in its own `<span data-animation="fade-up">` so
 * it can be revealed through the normal per-element observer path. A single
 * space text node sits between spans so normal text flow (wrapping,
 * spacing) is preserved — `display` on the spans is a CSS concern, not
 * this file's.
 */
function prepareTextReveal(root: ParentNode): void {
  const containers = root.querySelectorAll<HTMLElement>('[data-animation="text-reveal"]');

  for (const container of containers) {
    if (container.dataset.textRevealPrepared === "true") continue;

    const words = (container.textContent ?? "").trim().split(/\s+/).filter(Boolean);
    container.textContent = "";

    words.forEach((word, index) => {
      const span = document.createElement("span");
      span.setAttribute("data-animation", "fade-up");
      span.textContent = word;
      container.appendChild(span);
      if (index < words.length - 1) {
        container.appendChild(document.createTextNode(" "));
      }
    });

    if (!container.hasAttribute("data-stagger")) {
      container.setAttribute("data-stagger", String(TEXT_REVEAL_STAGGER_MS));
    }
    container.dataset.textRevealPrepared = "true";
  }
}

/** The index of `el` among its parent's other `[data-animation]` children. */
function staggerIndex(el: Element, parent: Element): number {
  const siblings = Array.from(parent.children).filter((child) => child.hasAttribute("data-animation"));
  return siblings.indexOf(el);
}

/** Resolves the delay to apply to `el`, accounting for a staggered parent. */
function resolveDelay(el: Element, ownDelay: number): number {
  const parent = el.parentElement;
  if (!parent?.hasAttribute("data-stagger")) return ownDelay;

  const staggerMs = Number(parent.getAttribute("data-stagger"));
  const index = staggerIndex(el, parent);
  return effectiveDelay(ownDelay, index, Number.isFinite(staggerMs) ? staggerMs : 0);
}

/**
 * Sets up the whole scroll-reveal system: finds every `[data-animation]`
 * element (including ones freshly created by the text-reveal split),
 * assigns each its transition delay, and watches it for reveal/hide.
 *
 * Neither stage of this trusts a native IntersectionObserver's own
 * isIntersecting/intersectionRatio for its decision, for three reasons found
 * by testing this against real Chromium, not just reading the spec:
 *
 * 1. `intersectionRatio` is computed from the target's *rendered* area, and
 *    this site's `image-reveal` pre-reveal state uses `clip-path: inset(0 0
 *    100% 0)` — collapsing that rendered area to zero forever, so the ratio
 *    can never cross any threshold no matter how far the element scrolls
 *    into view.
 * 2. Even without clip-path, a single `threshold: 0` observer only fires
 *    when the target crosses the "any overlap at all" boundary. An element
 *    that's already partially onscreen at page load (e.g. a CTA link right
 *    at the fold) gets exactly one callback, at whatever ratio it started
 *    at; if that's under its configured threshold, no further callback ever
 *    arrives as it scrolls further into view, because it never re-crosses
 *    that boundary again.
 * 3. A native observer's callback itself only fires when *its own* (clipped)
 *    notion of the intersection ratio crosses a threshold between two
 *    samples — and for `image-reveal` elements, Chromium's clip-path
 *    collapse means that ratio is pinned near enough to 0 the whole time
 *    that a single instant scroll (an anchor jump, `scrollIntoView`, a
 *    programmatic scroll-to) can move an element from genuinely offscreen to
 *    covering most of the viewport without the observer ever calling back at
 *    all: verified in real Chromium by watching a fresh observer on
 *    `.eruption-sim` report exactly one entry (`isIntersecting: false`) both
 *    immediately before *and* immediately after a scroll that moved its true
 *    `getBoundingClientRect()` from fully offscreen to ~78% covering an
 *    844px viewport — no second entry ever arrived, so nothing watching only
 *    `entry.isIntersecting`/`entry.boundingClientRect` inside that callback
 *    could ever have caught it, no matter what it did with that data.
 *
 * So instead: a coarse gate (`syncGate`) decides whether each element is
 * *anywhere near* the viewport by comparing its live, unclipped
 * `getBoundingClientRect()` against a generously-margined viewport rect
 * (`geometricIntersectionRatio` / `expandedViewportRect`, both pure and
 * unaffected by clip-path — see the doc comment on `geometricIntersectionRatio`
 * in reveal-engine.ts). That gate re-runs once up front and again on every
 * `scroll`/`resize`, coalesced to at most once per animation frame — a real
 * DOM event, not a native observer's own (unreliable, for this content)
 * judgement of whether anything changed — so it can't silently skip the
 * single-jump case above. While an element is near, a single shared rAF loop
 * (`tick`) recomputes its exact intersection ratio every frame from the same
 * live geometry against its own *configured* threshold/rootMargin. That's
 * unaffected by all three issues above, at the cost of doing real per-frame
 * work only for elements plausibly nearby (reusing this codebase's existing
 * gated-loop convention — see scroll-effects.ts — for "don't run continuous
 * work for offscreen content"), and dropping non-replay elements out of both
 * the gate and the loop the moment they've revealed.
 */
export function initScrollReveal(root: ParentNode = document): void {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Reduced motion: content must be visible immediately, and we skip
  // setting up an observer/loop at all rather than creating one we'd never use.
  if (reducedMotion) {
    prepareTextReveal(root);
    for (const el of root.querySelectorAll("[data-animation]")) {
      applyRevealAction(el, "reveal");
    }
    return;
  }

  prepareTextReveal(root);

  const elements = Array.from(root.querySelectorAll<HTMLElement>("[data-animation]"));
  const hasBeenRevealed = new WeakMap<Element, boolean>();
  const configByElement = new WeakMap<Element, RevealConfig>();

  const active = new Set<Element>();
  let rafId: number | null = null;

  function tick(): void {
    if (active.size === 0) {
      rafId = null;
      return;
    }

    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;

    // Read every rect first, then apply every class change, so DOM writes
    // (which could invalidate a cached layout) never interleave with reads
    // still to come this frame.
    const decisions: Array<{ el: Element; isIntersecting: boolean }> = [];
    for (const el of active) {
      const config = configByElement.get(el);
      if (!config) continue;
      const rootRect = expandedViewportRect(config.rootMargin, viewportWidth, viewportHeight);
      const ratio = geometricIntersectionRatio(el.getBoundingClientRect(), rootRect);
      decisions.push({ el, isIntersecting: ratio >= config.threshold });
    }

    for (const { el, isIntersecting } of decisions) {
      const config = configByElement.get(el);
      if (!config) continue;
      const revealed = hasBeenRevealed.get(el) ?? false;
      const action = decideRevealAction(isIntersecting, revealed, config.replay);
      applyRevealAction(el, action);

      if (action === "reveal") {
        hasBeenRevealed.set(el, true);
        if (!config.replay) {
          active.delete(el);
        }
      } else if (action === "hide") {
        hasBeenRevealed.set(el, false);
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  function startLoop(): void {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  // See the doc comment above: this replaces a native IntersectionObserver's
  // own isIntersecting/intersectionRatio for the *gate* decision too, not
  // just tick()'s precise per-element one, and for the same clip-path
  // reasons. It re-checks every element's real geometry against the gate's
  // generous rootMargin, driven by actual scroll/resize events rather than
  // a native observer's own (unreliable, for this content) judgement of
  // whether anything worth reporting changed.
  function syncGate(): void {
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const gateRect = expandedViewportRect(GATE_ROOT_MARGIN, viewportWidth, viewportHeight);

    for (const el of elements) {
      const config = configByElement.get(el);
      if (!config) continue;

      // A non-replay element that's already revealed is done for good —
      // tick() has already dropped it from `active`, and it'll never need
      // to re-enter, so there's nothing left to gate here.
      if (hasBeenRevealed.get(el) && !config.replay) continue;

      const ratio = geometricIntersectionRatio(el.getBoundingClientRect(), gateRect);
      if (ratio > 0) {
        active.add(el);
        startLoop();
      } else {
        active.delete(el);
      }
    }
  }

  let gateSyncPending = false;
  function scheduleGateSync(): void {
    if (gateSyncPending) return;
    gateSyncPending = true;
    requestAnimationFrame(() => {
      gateSyncPending = false;
      syncGate();
    });
  }

  for (const el of elements) {
    const config = parseRevealConfig(el);
    configByElement.set(el, config);
    el.style.transitionDelay = `${resolveDelay(el, config.delay)}ms`;
  }

  // Establish initial state (elements already near the viewport at load)
  // before wiring up the events that keep it current.
  syncGate();
  window.addEventListener("scroll", scheduleGateSync, { passive: true });
  window.addEventListener("resize", scheduleGateSync);
}
