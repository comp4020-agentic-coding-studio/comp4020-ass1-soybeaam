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
// page lifetime) that eases the glass's position toward the raw pointer
// target each frame — a framerate-independent exponential lerp (see `dt` and
// TRACK_EASE_RATE below) — rather than snapping straight to it, so the drop
// reads as something with a little weight and trailing lag rather than glued
// to the cursor. That's the same "inertia" feel GSAP's InertiaPlugin gives
// cursor-follow effects in this genre (see the vertex3d.asia research notes
// in RESEARCH.md) approximated with a plain lerp instead of a physics
// library. The same loop tracks how fast the eased position itself is
// moving, normalizes that to roughly 0–1, and writes it as `--cursor-speed`
// (CSS scales the glass up when it's high) and remaps it into the SVG
// filter's feDisplacementMap `scale` attribute, so the refraction visibly
// intensifies — like a droplet wobbling — the faster the cursor moves, and
// settles back to a gentle idle ripple once it slows down. On top of that
// smooth base scale, a sudden burst of movement also spikes a decaying
// ripple term additively into the same `scale` value (see `rippleAmount`
// below), fading back out over a few hundred milliseconds rather than
// snapping back instantly, so quick flicks read as a ripple radiating
// outward instead of a permanent change in distortion.

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Tracks the pointer over `#hero` and eases `.hero-cursor-glass` toward it
 * (an exponential lerp with a little trailing weight, not a 1:1 snap),
 * writing the eased position (relative to `#hero`'s own box) as `--cursor-x`
 * / `--cursor-y` custom properties in raw pixels with no unit — the CSS side
 * owns turning those into an actual position and handles the blur/gradient/
 * fade look. Also writes `--cursor-speed` (roughly 0–1, normalized pointer
 * speed) and drives the `#hero-glass-distort` SVG filter's displacement
 * scale from that value, plus an additive decaying "ripple" spike on the
 * same scale when a burst of fast movement is detected.
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

  // Tracking ease: expressed as a rate (not a flat per-frame fraction) so the
  // catch-up speed stays consistent regardless of frame rate — each frame we
  // move `1 - exp(-TRACK_EASE_RATE * dt)` of the remaining distance to the
  // pointer target. At 60fps that works out to roughly a 0.15–0.2 lerp
  // factor per frame, tuned by feel for "a bit of weight trailing the
  // cursor" without reading as sluggish. No overshoot by design (this is a
  // plain ease toward a moving target, not a spring) — that's deliberate:
  // per this repo's convention, springs are for things that should read as
  // lively/bouncy, and a cursor follower shouldn't overshoot past the
  // pointer.
  const TRACK_EASE_RATE = 12;
  const MAX_DT = 1 / 30; // matches this repo's convention of clamping dt so a
  // backgrounded tab doesn't snap the ease on return.
  const SPEED_PX_PER_MS_AT_FULL = 2; // speed that reads as "fast", normalizes to 1
  const DISTORT_SCALE_IDLE = 35;
  const DISTORT_SCALE_FAST = 85;

  // Ripple: a burst of movement (a sudden jump in normalized speed, e.g. a
  // fast flick) adds to `rippleAmount`, which then decays exponentially back
  // toward 0 every frame regardless of continued movement — so it reads as a
  // one-off ripple radiating outward rather than a sustained boost. Sustained
  // fast movement is already covered by the smooth idle/fast interpolation
  // above; this is purely the additive "spike" on top of that.
  const RIPPLE_TRIGGER_DELTA = 0.08; // speed jump (0–1) needed to count as a "burst"
  const RIPPLE_BOOST = 45; // extra feDisplacementMap scale units at peak ripple
  const RIPPLE_DECAY_TAU = 0.12; // seconds; ~4 tau (~480ms) to fade to near-zero

  let targetX = 0;
  let targetY = 0;
  let posX = 0;
  let posY = 0;
  let speed = 0; // smoothed, normalized 0–1
  let prevNormalizedSpeed = 0;
  let rippleAmount = 0; // decaying 0–1 ripple spike, additive on top of `speed`
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

    // Exponential lerp toward the target: the fraction of the remaining
    // distance covered this frame depends on dt, so the trailing feel is the
    // same at 60Hz or 144Hz rather than snapping faster on high-refresh
    // displays.
    const ease = 1 - Math.exp(-TRACK_EASE_RATE * dt);
    const prevX = posX;
    const prevY = posY;
    posX += (targetX - posX) * ease;
    posY += (targetY - posY) * ease;

    // Speed is measured from how far the eased position itself travelled
    // this frame (not the raw pointer deltas), so it reflects the glass's
    // own motion — smoothed a little further so it doesn't flicker frame to
    // frame.
    const movedPxPerMs = dt > 0 ? Math.hypot(posX - prevX, posY - prevY) / (dt * 1000) : 0;
    const normalizedSpeed = clamp(movedPxPerMs / SPEED_PX_PER_MS_AT_FULL, 0, 1);
    speed += (normalizedSpeed - speed) * clamp(dt * 10, 0, 1);

    // Ripple: a sudden jump in normalized speed (a burst, e.g. a fast flick)
    // tops up rippleAmount; every frame it also decays exponentially back
    // toward 0, so a burst reads as a brief additive spike rather than a
    // lasting change.
    const speedJump = normalizedSpeed - prevNormalizedSpeed;
    if (speedJump > RIPPLE_TRIGGER_DELTA) {
      rippleAmount = clamp(rippleAmount + speedJump, 0, 1);
    }
    rippleAmount *= Math.exp(-dt / RIPPLE_DECAY_TAU);
    prevNormalizedSpeed = normalizedSpeed;

    glass.style.setProperty("--cursor-x", String(posX));
    glass.style.setProperty("--cursor-y", String(posY));
    glass.style.setProperty("--cursor-speed", String(speed));
    const baseScale = DISTORT_SCALE_IDLE + speed * (DISTORT_SCALE_FAST - DISTORT_SCALE_IDLE);
    distort?.setAttribute("scale", String(baseScale + rippleAmount * RIPPLE_BOOST));

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
    // Snap straight to the entry point rather than easing in from wherever
    // the last session left off, so the drop doesn't glide across the whole
    // hero the first time the pointer arrives.
    posX = targetX;
    posY = targetY;
    speed = 0;
    prevNormalizedSpeed = 0;
    rippleAmount = 0;
    glass.classList.add("is-active");
    start();
  });

  hero.addEventListener("pointermove", updateTarget);

  hero.addEventListener("pointerleave", () => {
    glass.classList.remove("is-active");
    stop();
  });
}
