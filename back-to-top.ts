// "Back to top" button behaviour: shows `.back-to-top` once the page has
// scrolled past the hero, and scrolls back to the top on click.
//
// This is deliberately simpler than scroll-effects.ts's `gatedRaf` helper:
// gatedRaf exists to drive a continuous per-frame value (parallax offset,
// timeline progress) for one element while it's near the viewport. This is
// the opposite shape — a single boolean ("has the user scrolled past the
// hero?") that only needs to change on a plain `scroll` event, and the
// button lives outside any section, so there's nothing to gate with an
// IntersectionObserver. A `scroll` listener throttled to one check per
// animation frame is enough, and keeps the listener itself passive so it
// never blocks scrolling.

/**
 * Toggles `.is-visible` on `.back-to-top` once scroll position has passed
 * the hero section's height (falling back to one viewport height if `#hero`
 * isn't found, per this repo's existing convention — see volcano-scene.ts),
 * and scrolls smoothly back to the top on click. Respects
 * prefers-reduced-motion by scrolling instantly instead, matching
 * hero-cursor-glass.ts / volcano-scene.ts's existing branch on the same
 * media query.
 */
export function initBackToTop(): void {
  const found = document.querySelector<HTMLButtonElement>(".back-to-top");
  if (!found) return;
  const button: HTMLButtonElement = found;

  const hero = document.querySelector<HTMLElement>("#hero");

  function pastThreshold(): boolean {
    const threshold = hero ? hero.getBoundingClientRect().height : window.innerHeight;
    return window.scrollY > threshold;
  }

  let ticking = false;
  function onScroll(): void {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      button.classList.toggle("is-visible", pastThreshold());
      ticking = false;
    });
  }

  // Set the initial state in case the page loads mid-scroll (e.g. a
  // back-navigation that restores scroll position), rather than waiting for
  // the first scroll event.
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  button.addEventListener("click", () => {
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reducedMotion ? "instant" : "smooth" });
  });
}
