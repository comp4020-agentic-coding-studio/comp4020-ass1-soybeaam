// Cursor-tracking glass highlight for #hero's .hero-cursor-glass, styled as a
// water-drop lens (see the backdrop-filter + #hero-glass-distort SVG filter
// in styles.css/index.html). Mouse-only: coarse-pointer/no-hover devices
// (touch) get no listeners at all, since a tap has no hover-then-leave to
// animate and would otherwise leave the glass stuck at a stray position.
// prefers-reduced-motion also opts out entirely on the JS side (the CSS
// handles its own reduced-motion fallback, but the two approaches shouldn't
// both be live at once).
//
// Unlike the old 1:1 version, this now runs a small pointer-gated rAF loop
// (started on pointerenter, stopped on pointerleave — never for the whole
// page lifetime) that springs the glass's position toward the raw pointer
// target rather than snapping straight to it, so the drop reads as something
// with a little weight and lag rather than glued to the cursor. The same
// loop tracks how fast the spring itself is moving, normalizes that to
// roughly 0–1, and writes it as `--cursor-speed` (CSS scales the glass up
// when it's high) and remaps it into the SVG filter's feDisplacementMap
// `scale` attribute, so the refraction visibly intensifies — like a droplet
// wobbling — the faster the cursor moves, and settles back to a gentle idle
// ripple once it slows down.

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Tracks the pointer over `#hero` and spring-eases `.hero-cursor-glass`
 * toward it, writing the eased position (relative to `#hero`'s own box) as
 * `--cursor-x` / `--cursor-y` custom properties in raw pixels with no unit —
 * the CSS side owns turning those into an actual position and handles the
 * blur/gradient/fade look. Also writes `--cursor-speed` (roughly 0–1,
 * normalized pointer speed) and drives the `#hero-glass-distort` SVG
 * filter's displacement scale from the same value.
 */
export function initHeroCursorGlass(): void {
  const found = document.querySelector<HTMLElement>("#hero");
  const foundGlass = found?.querySelector<HTMLElement>(".hero-cursor-glass");
  if (!found || !foundGlass) return;
  const hero: HTMLElement = found;
  const glass: HTMLElement = foundGlass;

  // Mouse-only enhancement: skip on touch/coarse-pointer devices entirely.
  if (!matchMedia("(pointer: fine)").matches) return;

  // Matches initVolcanoScene's reducedMotion check — don't attach any
  // listeners under reduced motion, so there's no pointer-driven motion to
  // reduce in the first place.
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) return;

  const distort = document.querySelector<SVGFEDisplacementMapElement>(
    "#hero-glass-distort feDisplacementMap",
  );

  // Spring constants: high stiffness relative to damping so the drop catches
  // up quickly without the wild overshoot a lower damping would give — a
  // gentle lag rather than a lively bounce, in keeping with a droplet's
  // actual weight.
  const STIFFNESS = 180;
  const DAMPING = 26;
  const MAX_DT = 1 / 30; // matches this repo's convention of clamping dt so a
  // backgrounded tab doesn't snap the spring on return.
  const SPEED_PX_PER_MS_AT_FULL = 2; // speed that reads as "fast", normalizes to 1
  const DISTORT_SCALE_IDLE = 35;
  const DISTORT_SCALE_FAST = 85;

  let targetX = 0;
  let targetY = 0;
  let posX = 0;
  let posY = 0;
  let velX = 0;
  let velY = 0;
  let speed = 0; // smoothed, normalized 0–1
  let lastFrameTime = 0;
  let rafId: number | null = null;

  function updateTarget(event: PointerEvent): void {
    const rect = hero.getBoundingClientRect();
    targetX = event.clientX - rect.left;
    targetY = event.clientY - rect.top;
  }

  function step(now: number): void {
    const dt = lastFrameTime === 0 ? MAX_DT : Math.min((now - lastFrameTime) / 1000, MAX_DT);
    lastFrameTime = now;

    // Damped spring: acceleration pulls toward the target and velocity is
    // continuously bled off, so the glass eases in and settles rather than
    // oscillating around the pointer.
    const accelX = (targetX - posX) * STIFFNESS - velX * DAMPING;
    const accelY = (targetY - posY) * STIFFNESS - velY * DAMPING;
    velX += accelX * dt;
    velY += accelY * dt;
    const prevX = posX;
    const prevY = posY;
    posX += velX * dt;
    posY += velY * dt;

    // Speed is measured from how far the spring itself travelled this frame
    // (not the raw pointer deltas), so it reflects the glass's own motion —
    // smoothed a little further so it doesn't flicker frame to frame.
    const movedPxPerMs = dt > 0 ? Math.hypot(posX - prevX, posY - prevY) / (dt * 1000) : 0;
    const normalizedSpeed = clamp(movedPxPerMs / SPEED_PX_PER_MS_AT_FULL, 0, 1);
    speed += (normalizedSpeed - speed) * clamp(dt * 10, 0, 1);

    glass.style.setProperty("--cursor-x", String(posX));
    glass.style.setProperty("--cursor-y", String(posY));
    glass.style.setProperty("--cursor-speed", String(speed));
    distort?.setAttribute("scale", String(DISTORT_SCALE_IDLE + speed * (DISTORT_SCALE_FAST - DISTORT_SCALE_IDLE)));

    rafId = requestAnimationFrame(step);
  }

  function start(): void {
    if (rafId === null) {
      lastFrameTime = 0;
      rafId = requestAnimationFrame(step);
    }
  }

  function stop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  hero.addEventListener("pointerenter", (event) => {
    updateTarget(event);
    // Snap straight to the entry point rather than springing in from
    // wherever the last session left off, so the drop doesn't glide across
    // the whole hero the first time the pointer arrives.
    posX = targetX;
    posY = targetY;
    velX = 0;
    velY = 0;
    glass.classList.add("is-active");
    start();
  });

  hero.addEventListener("pointermove", updateTarget);

  hero.addEventListener("pointerleave", () => {
    glass.classList.remove("is-active");
    stop();
  });
}
