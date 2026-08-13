// Continuous scroll-fraction effects: timeline progress and parallax. These
// are separate from the one-shot reveal system in reveal-engine.ts /
// reveal-observer.ts — they run every frame while their element is near the
// viewport, rather than firing once. Nothing here listens for `scroll`
// events; a coarse IntersectionObserver gates a requestAnimationFrame loop
// instead, so scrolling itself is never blocked.

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Runs `onFrame` on every animation frame while `el` is anywhere near the
 * viewport (a generous rootMargin so the loop starts slightly early and
 * stops slightly late, rather than at the exact edge), and stops the loop
 * the moment it isn't. Returns a teardown function.
 */
function gatedRaf(el: Element, onFrame: () => void): () => void {
  let rafId: number | null = null;

  function loop(): void {
    onFrame();
    rafId = requestAnimationFrame(loop);
  }

  function start(): void {
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function stop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) start();
        else stop();
      }
    },
    { rootMargin: "20% 0px" },
  );
  observer.observe(el);

  return () => {
    stop();
    observer.disconnect();
  };
}

/**
 * Drives `--timeline-progress` on `#process .timeline-line-fill` as the
 * `#process` section scrolls past the vertical centre of the viewport, so
 * the CSS-drawn line can track scroll position.
 */
export function initTimelineProgress(): void {
  const section = document.querySelector<HTMLElement>("#process");
  const fill = document.querySelector<HTMLElement>("#process .timeline-line-fill");
  if (!section || !fill) return;

  gatedRaf(section, () => {
    const rect = section.getBoundingClientRect();
    if (rect.height === 0) return;
    const viewportCenterY = window.innerHeight / 2;
    const progress = clamp((viewportCenterY - rect.top) / rect.height, 0, 1);
    fill.style.setProperty("--timeline-progress", String(progress));
  });
}

/**
 * Applies a small scroll-linked vertical offset to every `[data-parallax]`
 * element, scaled by its own `data-parallax` factor.
 *
 * Coordination with the reveal system: these elements also carry
 * `data-animation` (image-reveal), and reveal-observer.ts drives their
 * pre-reveal `transform` via CSS classes. To avoid the two systems fighting
 * over the same `transform` property, the parallax offset is only written
 * once `.is-revealed` is present on the element — i.e. the reveal owns
 * `transform` until the element has revealed, and parallax owns it after.
 * That's simpler than a wrapper element (which would change these
 * elements' position in their parent and risk breaking layout CSS not yet
 * written for `.showcase-media`), at the cost of the parallax offset
 * starting to apply right as the reveal transition is still settling.
 */
export function initParallax(): void {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  const elements = document.querySelectorAll<HTMLElement>("[data-parallax]");
  for (const el of elements) {
    const factor = Number(el.getAttribute("data-parallax"));
    if (!Number.isFinite(factor)) continue;

    gatedRaf(el, () => {
      if (!el.classList.contains("is-revealed")) return;
      const rect = el.getBoundingClientRect();
      const elementCenterY = rect.top + rect.height / 2;
      const viewportCenterY = window.innerHeight / 2;
      const offset = (viewportCenterY - elementCenterY) * factor;
      el.style.transform = `translateY(${offset}px)`;
    });
  }
}
