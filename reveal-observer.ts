// Browser wiring for the reveal system: DOM scanning, IntersectionObserver
// setup, and the text-reveal word-splitting prep. All decision logic lives in
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
 * This does *not* trust a single IntersectionObserver's own
 * isIntersecting/intersectionRatio for the decision, for two reasons found
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
 *
 * So instead: one coarse, generously-margined IntersectionObserver decides
 * only whether an element is *anywhere near* the viewport (cheap, and reuses
 * this codebase's existing gated-rAF-loop convention — see scroll-effects.ts
 * — for "don't run continuous work for offscreen content"). While an element
 * is near, a single shared rAF loop recomputes its exact intersection ratio
 * every frame from live `getBoundingClientRect()` against its own
 * *configured* threshold/rootMargin (via `geometricIntersectionRatio` /
 * `expandedViewportRect`, both pure and unaffected by clip-path). That's
 * unaffected by either issue above, at the cost of doing real per-frame work
 * only for elements plausibly nearby, and dropping non-replay elements out
 * of both the gate and the loop the moment they've revealed.
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
          gate.unobserve(el);
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

  const gate = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target;
        if (entry.isIntersecting) {
          active.add(el);
          startLoop();
        } else {
          active.delete(el);
        }
      }
    },
    { rootMargin: GATE_ROOT_MARGIN },
  );

  for (const el of elements) {
    const config = parseRevealConfig(el);
    configByElement.set(el, config);
    el.style.transitionDelay = `${resolveDelay(el, config.delay)}ms`;
    gate.observe(el);
  }
}
