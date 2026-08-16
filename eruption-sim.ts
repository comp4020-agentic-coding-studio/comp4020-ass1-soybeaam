import { gatedRaf } from "./scroll-effects";

// Interactive cross-section + surface diagram for #underground-process. This
// is a small state machine, to simulate a real physics model.
//
// The chamber is always assumed genuinely full: `--eruption-pressure` (the
// custom property styles.css scales the conduit/chamber fill and its glow
// by, plus the read-only pressure metric) is set to 1 once at load and never
// changes, and the volcano starts — and stays — in the continuous-eruption
// state (`.is-erupting`/`.is-erupting-continuous`, looped forever by
// styles.css) from the moment the page loads. There is no manual pressure
// dial and no pressure ramp to wait out.
//
// What the user actually drives is how *explosive* that permanent eruption
// looks: the viscosity and gas-content sliders, together with the selected
// eruption style, feed both the existing eruption-rate/VEI/column-height
// metrics (recomputed live on every input, via computeVei/
// computeColumnHeightKm below) and — new — the canvas ember-particle layer's
// launch velocity, particle count, effective gravity, and spread (see
// computeExplosivity and createParticleBurst). Real volcanology direction:
// gas content is the primary driver of explosivity (a gas-poor melt just
// flows), and viscosity amplifies that only in proportion to how much gas is
// actually there to trap and then violently release — so a low-viscosity,
// low-gas effusive setting throws few or no particles, while high gas and
// high viscosity together (a stiff, gas-choked plug) throws a lot, fast, and
// wide. Because every one of these reads its inputs live rather than at some
// past "trigger" moment, dragging viscosity/gas or switching style reshapes
// the ongoing eruption immediately, with no re-trigger needed.
//
// "Trigger eruption" no longer arms anything (the chamber's already always
// full) — it fires one extra, immediate pulse of particles on top of the
// continuous stream, a satisfying nudge rather than a no-op. "Reset volcano"
// restores viscosity/gas/style to their defaults (pressure was never
// something it needs to touch, since it stays maxed either way).

type EruptionStyleName = "effusive" | "hawaiian" | "strombolian" | "vulcanian" | "plinian";

interface EruptionStyleDef {
  /** 0–1, written to --style-intensity to scale the burst's travel distance. */
  intensity: number;
  baseVei: number;
  /** m³/s at neutral (0%) gas/viscosity. */
  baseRate: number;
  description: string;
}

const STYLES: Record<EruptionStyleName, EruptionStyleDef> = {
  effusive: {
    intensity: 0,
    baseVei: 0,
    baseRate: 5,
    description: "Gentle, continuous lava effusion with almost no explosivity — long-lived shield-building flows.",
  },
  hawaiian: {
    intensity: 0.35,
    baseVei: 1,
    baseRate: 15,
    description: "Low-viscosity basalt erupts as fountains and rivers of lava, with only mild explosivity.",
  },
  strombolian: {
    intensity: 0.6,
    baseVei: 2,
    baseRate: 8,
    description: "Rhythmic, separate bursts of gas-charged lava blast a few hundred metres into the air every few minutes.",
  },
  vulcanian: {
    intensity: 0.8,
    baseVei: 3,
    baseRate: 20,
    description: "Short, violent explosions blast dense ash and blocks from a viscous, gas-choked plug.",
  },
  plinian: {
    intensity: 1,
    baseVei: 5,
    baseRate: 50,
    description: "Sustained, high-velocity blasts drive a towering ash column tens of kilometres into the sky — the most explosive style.",
  },
};

const MAX_VEI = 8;

function isEruptionStyleName(value: string | undefined): value is EruptionStyleName {
  return !!value && value in STYLES;
}

// Shared by updateMetrics() and computeColumnHeightKm()/computeExplosivity()
// below so the "gas-choked, viscous plug is more explosive" bump only lives
// in one place. Module-level (not nested in initEruptionSimulator) because
// createParticleBurst's physics needs it too.
function computeVei(style: EruptionStyleDef, viscosity: number, gas: number): number {
  return Math.min(MAX_VEI, style.baseVei + (gas > 70 && viscosity > 70 ? 1 : 0));
}

// Column height is derived from the same style/viscosity/gas inputs as the
// rest of the metrics, scaled by the style's --style-intensity (0 for
// effusive's ground-hugging flows, 1 for plinian's towering column) and
// nudged up by gas content, which drives how far the ejecta actually
// travels. Shown live in the metrics panel now that the eruption itself is
// permanent rather than only while a scripted burst is mid-flight.
function computeColumnHeightKm(style: EruptionStyleDef, viscosity: number, gas: number): number {
  const vei = computeVei(style, viscosity, gas);
  return style.intensity * (2 + vei * 4) * (1 + gas / 200);
}

/**
 * 0 (no ejecta at all — a gentle effusive flow) to 1 (maximum, Plinian-scale
 * violence) — the single number the particle physics below scales launch
 * velocity, particle count, effective gravity, and spread off. Ties directly
 * into the existing VEI machinery rather than a parallel formula:
 * `computeVei` already folds in the style baseline plus the "gas trapped in
 * a stiff, viscous plug is more explosive" bump (gas>70 && viscosity>70).
 * This continuous version applies the same real-volcanology direction
 * smoothly across the whole 0–100 range instead of only at that one corner —
 * gas content is the primary driver of explosivity (a runny, gas-poor melt
 * just flows), and viscosity amplifies it only in proportion to how much gas
 * is actually there to trap and then violently release.
 */
function computeExplosivity(style: EruptionStyleDef, viscosity: number, gas: number): number {
  const veiFraction = computeVei(style, viscosity, gas) / MAX_VEI;
  const gasFraction = gas / 100;
  const trappedGasFraction = (viscosity / 100) * gasFraction;
  const raw = veiFraction * (0.45 + 0.55 * gasFraction) + trappedGasFraction * 0.35;
  return Math.min(1, Math.max(0, raw));
}

// ---------------------------------------------------------------------------
// Canvas particle physics ("glowing red" ember burst)
//
// A second, independent rendering layer on top of the existing CSS-driven
// ejecta circles above: real per-particle projectile motion (spawn angle +
// speed, gravity integrated frame-to-frame) instead of a scripted keyframe,
// scaled entirely by computeExplosivity(style, viscosity, gas) above rather
// than dedicated sliders, so the existing viscosity/gas/style controls
// visibly reshape the burst rather than just scaling one fixed animation.
// Lives entirely in its own rAF loop, gated the same way scroll-effects.ts's
// gatedRaf and reveal-observer.ts's tick() are — started only once something
// needs drawing, stopped the moment nothing does — so this never runs as a
// background loop for the rest of the page's life.
// ---------------------------------------------------------------------------

/** Vent mouth in the SVG's 300×400 viewBox space — the conduit's top edge. */
const VENT_X_MIN_SVG = 133;
const VENT_X_MAX_SVG = 167;
const VENT_Y_SVG = 150;
// Roughly the mountain's ground line (see .eruption-sim-crust's path) — past
// this a falling ember reads as having landed, so it's culled rather than
// drawn falling through solid rock.
const GROUND_Y_SVG = 260;
const VIEWBOX_WIDTH_SVG = 300;
const VIEWBOX_HEIGHT_SVG = 400;

const MAX_LIVE_PARTICLES = 1000;
// How often a continuous (chamber-full) eruption throws a fresh wave of
// particles, and what fraction of the particle-count slider each wave spawns
// — sized so a wave feels like a steady stream rather than one huge burst
// repeated, per PARTICLE_WAVE_INTERVAL_MS.
const PARTICLE_WAVE_INTERVAL_MS = 300;
const PARTICLE_WAVE_FRACTION = 0.2;
// requestAnimationFrame delta-time is clamped to this many seconds so
// returning to a backgrounded tab (a huge single dt) can't fling every live
// particle through several seconds of motion in one jump — the same spirit
// as the dt clamp called out in this codebase's other frame loops.
const MAX_FRAME_DT_S = 0.05;
// Under reduced motion, a static frozen-mid-arc frame stands in for the
// animated burst (see createParticleBurst's doc comment) — this is how far
// through each particle's simulated lifetime that frozen snapshot is taken.
const REDUCED_MOTION_FREEZE_FRACTION = 0.32;
const REDUCED_MOTION_PARTICLE_CAP = 90;

// Launch speed and effective gravity both interpolate across their own SVG-
// unit range by `computeExplosivity` (0–1), not a dedicated slider. Ranges
// picked from the ballistic apex-height/round-trip-time formulas
// (h = v0y²/(2g), t = 2·v0y/g) so that even the most explosive corner
// (max speed, min gravity) completes its arc within a particle's `life`
// instead of rocketing off the top of the ~300×400-unit canvas and sitting
// there invisible for the rest of its lifespan.
const SPEED_MIN_SVG = 40;
const SPEED_MAX_SVG = 260;
const GRAVITY_MIN_SVG = 220;
const GRAVITY_MAX_SVG = 950;
// The most particles a fully Plinian, gas-saturated eruption throws in one
// continuous "budget" (see currentParticleCount) — a wave spawns
// PARTICLE_WAVE_FRACTION of this every PARTICLE_WAVE_INTERVAL_MS, same shape
// as the old particle-count slider, just computed instead of dragged.
const PARTICLE_COUNT_MAX = 380;

interface EmberParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
}

interface EruptionState {
  style: EruptionStyleDef;
  viscosity: number;
  gas: number;
}

/**
 * Owns the `.eruption-sim-particles` canvas: sizing/DPR, the particle pool,
 * and its own rAF loop. Returns null if the canvas isn't there or 2D context
 * creation fails, so the caller can no-op the same way this file already
 * no-ops when other expected elements are missing.
 *
 * `getEruptionState` is read live (not snapshotted at burst time) so
 * dragging the viscosity/gas sliders or switching eruption style takes
 * effect immediately — including mid-flight for particles already airborne
 * and for each new wave of the permanent, continuous stream.
 */
function createParticleBurst(
  canvas: HTMLCanvasElement,
  reducedMotion: boolean,
  getEruptionState: () => EruptionState,
): {
  start: () => void;
  burst: () => void;
} | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let cssWidth = 0;
  let cssHeight = 0;
  let particles: EmberParticle[] = [];
  let lastFrameTime = 0;
  // Starts already "due" so the very first visible frame spawns a wave
  // immediately rather than waiting a full PARTICLE_WAVE_INTERVAL_MS —
  // matches the eruption being permanent/continuous from page load rather
  // than something the user arms and waits on.
  let continuousWaveElapsedMs = PARTICLE_WAVE_INTERVAL_MS;
  let hasStaticFrame = false;

  function resizeCanvas(): void {
    const rect = canvas.getBoundingClientRect();
    cssWidth = rect.width;
    cssHeight = rect.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(cssHeight * dpr));
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // rAF-coalesced resize, mirroring reveal-observer.ts's scheduleGateSync —
  // a real `resize` event decides whether anything needs recomputing, but
  // the (potentially expensive, backing-store-reallocating) work itself only
  // happens once per frame no matter how many resize events land in it.
  let resizePending = false;
  function scheduleResize(): void {
    if (resizePending) return;
    resizePending = true;
    requestAnimationFrame(() => {
      resizePending = false;
      resizeCanvas();
      // A frozen reduced-motion frame is drawn in CSS-pixel space, so it
      // goes stale on resize; the live loop instead recomputes every frame
      // anyway, so it doesn't need this.
      if (hasStaticFrame) drawStaticFrame();
    });
  }
  window.addEventListener("resize", scheduleResize);
  resizeCanvas();

  function svgXToCanvas(xSvg: number): number {
    return (xSvg / VIEWBOX_WIDTH_SVG) * cssWidth;
  }
  function svgYToCanvas(ySvg: number): number {
    return (ySvg / VIEWBOX_HEIGHT_SVG) * cssHeight;
  }

  // How many particles the current viscosity/gas/style state is "worth" —
  // shared by the continuous wave-spawn cadence in loop(), the reduced-
  // motion static frame's particle cap, and the manual burst() pulse, so all
  // three agree on what "explosive" means. Rounds down to 0 for a genuinely
  // gas-poor, low-viscosity effusive setting — real basaltic effusion throws
  // no ballistic ejecta at all, just a flow (see .eruption-sim-flow), so the
  // canvas layer should go quiet rather than force a minimum.
  function currentParticleCount(): number {
    const { style, viscosity, gas } = getEruptionState();
    return Math.round(computeExplosivity(style, viscosity, gas) * PARTICLE_COUNT_MAX);
  }

  /**
   * Builds one particle's spawn state — used both by the live loop (pushed
   * into `particles`) and by the reduced-motion static frame (simulated
   * forward analytically to one frozen instant, never pushed anywhere). Kept
   * as a single source of truth so both paths agree on what viscosity/gas/
   * style mean.
   *
   * Direction, all folded into one launch: higher overall explosivity (see
   * computeExplosivity — driven primarily by gas content, amplified by
   * viscosity trapping it) is a faster base launch speed; on top of that
   * aggregate, per-particle texture keeps it looking organic rather than
   * uniform — viscosity still dampens individual launches and narrows the
   * spread cone a little (sluggish, clumpy magma), gas still adds launch-to-
   * launch speed variance and widens the cone (chaotic, gas-charged magma).
   * This mirrors the direction applyEjectaMotion already established for the
   * CSS ejecta layer above, so the two layers read as one coherent system
   * rather than two unrelated ones.
   */
  function makeParticle(): EmberParticle {
    const { style, viscosity, gas } = getEruptionState();
    const explosivity = computeExplosivity(style, viscosity, gas);
    const ventXSvg = VENT_X_MIN_SVG + Math.random() * (VENT_X_MAX_SVG - VENT_X_MIN_SVG);
    const x = svgXToCanvas(ventXSvg);
    const y = svgYToCanvas(VENT_Y_SVG);

    // Canvas pixels per SVG unit — horizontal and vertical agree because the
    // wrapper's `aspect-ratio: 3 / 4` locks the canvas to the SVG viewBox's
    // own 300:400 ratio, so either axis's scale works for converting a
    // scalar (speed, gravity) rather than a position.
    const pxPerSvgUnit = cssWidth / VIEWBOX_WIDTH_SVG;

    const baseSpeedSvg = SPEED_MIN_SVG + (SPEED_MAX_SVG - SPEED_MIN_SVG) * explosivity;
    const viscosityDamp = 1 - (viscosity / 100) * 0.2;
    const gasVarianceFraction = (gas / 100) * 0.35;
    const speedSvg = baseSpeedSvg * viscosityDamp * (1 + (Math.random() * 2 - 1) * gasVarianceFraction);
    const speedPx = Math.max(6, speedSvg) * pxPerSvgUnit;

    // Gas content is the primary driver of spread (more dissolved gas means
    // a more chaotic, wider-angled blast), dampened a little by viscosity
    // (stiffer magma still tends to hold a tighter jet even once it lets go).
    const baseConeDeg = 18 + 38 * (gas / 100);
    const coneDeg = Math.max(6, baseConeDeg * (1 - (viscosity / 100) * 0.3));
    const angleRad = (((Math.random() * 2 - 1) * coneDeg) * Math.PI) / 180;

    const vx = Math.sin(angleRad) * speedPx;
    const vy = -Math.cos(angleRad) * speedPx;

    const life = 1.1 + Math.random() * 1.0;
    // Base size in SVG units, scaled to canvas pixels the same way position
    // and speed are, so it stays proportionate at any viewport width — sized
    // up a little for more explosive eruptions for visual variety.
    const sizeSvg = 2 + explosivity * 4.5 + (speedSvg / SPEED_MAX_SVG) * 1.5;
    const size = sizeSvg * pxPerSvgUnit;

    return { x, y, vx, vy, age: 0, life, size };
  }

  function gravityAccelPx(): number {
    const { style, viscosity, gas } = getEruptionState();
    const explosivity = computeExplosivity(style, viscosity, gas);
    // More explosive eruptions get a lower effective gravity, so a
    // Plinian-scale blast reads as a tall, hang-time-heavy column rather than
    // a stubby lob — the inverse of speed's direction above, both driven by
    // the same explosivity number.
    const gravityAccelSvg = GRAVITY_MAX_SVG - (GRAVITY_MAX_SVG - GRAVITY_MIN_SVG) * explosivity;
    return gravityAccelSvg * (cssHeight / VIEWBOX_HEIGHT_SVG);
  }

  /**
   * One ember's radial-gradient glow. `lifeFrac` (0 = just spawned, 1 = dead)
   * drives both colour and fade: it starts white/yellow-hot at the core and
   * cools toward deep red as it ages, fading to fully transparent right at
   * the end of life, so an ember reads as cooling rather than just shrinking.
   */
  function drawEmber(x: number, y: number, size: number, lifeFrac: number): void {
    const alpha = Math.max(0, 1 - lifeFrac);
    if (alpha <= 0) return;
    // 1 = freshly spawned (hottest/whitest), 0 = end of life (deep red) —
    // cools a little faster than the alpha fade so a particle visibly reddens
    // before it vanishes, rather than fading out still white-hot.
    const heat = Math.max(0, 1 - lifeFrac * 1.3);
    const coreR = Math.round(150 + 105 * heat);
    const coreG = Math.round(20 + 235 * heat);
    const coreB = Math.round(10 + 215 * heat);
    const radius = Math.max(1.5, size);

    const gradient = ctx!.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${coreR}, ${coreG}, ${coreB}, ${alpha})`);
    gradient.addColorStop(0.4, `rgba(255, 90, 20, ${alpha * 0.85})`);
    gradient.addColorStop(0.75, `rgba(180, 20, 10, ${alpha * 0.5})`);
    gradient.addColorStop(1, "rgba(120, 10, 10, 0)");

    ctx!.fillStyle = gradient;
    ctx!.beginPath();
    ctx!.arc(x, y, radius, 0, Math.PI * 2);
    ctx!.fill();
  }

  /** One physics + draw step, given how many seconds (unclamped) have
   * elapsed since the previous step. Spawns a fresh wave once
   * PARTICLE_WAVE_INTERVAL_MS has accumulated (a genuinely gas-poor,
   * low-viscosity/effusive setting rounds `currentParticleCount()` to 0 and
   * so spawns nothing, matching real effusive eruptions — see its doc
   * comment), then integrates and draws every live particle.
   */
  function stepAndDraw(dtRawS: number): void {
    const dtS = Math.min(dtRawS, MAX_FRAME_DT_S);

    continuousWaveElapsedMs += dtRawS * 1000;
    if (continuousWaveElapsedMs >= PARTICLE_WAVE_INTERVAL_MS) {
      continuousWaveElapsedMs = 0;
      const waveCount = Math.round(currentParticleCount() * PARTICLE_WAVE_FRACTION);
      for (let i = 0; i < waveCount && particles.length < MAX_LIVE_PARTICLES; i++) {
        particles.push(makeParticle());
      }
    }

    const gAccel = gravityAccelPx();
    const groundYCanvas = svgYToCanvas(GROUND_Y_SVG);

    ctx!.clearRect(0, 0, cssWidth, cssHeight);
    ctx!.globalCompositeOperation = "lighter";

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += gAccel * dtS;
      p.x += p.vx * dtS;
      p.y += p.vy * dtS;
      p.age += dtS;
      const lifeFrac = p.age / p.life;
      const fellPastGround = p.vy > 0 && p.y > groundYCanvas + 60;
      if (lifeFrac >= 1 || p.y > cssHeight + 60 || fellPastGround) {
        particles.splice(i, 1);
        continue;
      }
      drawEmber(p.x, p.y, p.size, lifeFrac);
    }

    ctx!.globalCompositeOperation = "source-over";
  }

  // gatedRaf (scroll-effects.ts) owns starting/stopping this per-frame
  // callback itself, via an IntersectionObserver on the canvas — so this
  // physics loop only ever spends a frame while `.eruption-sim-particles` is
  // anywhere near the viewport, the same reasoning as volcano-scene.ts's
  // render loop (never animate something nobody can see), and never runs at
  // all under reduced motion (see the static-frame path below instead).
  // `lastFrameTime` resets to 0 whenever the loop restarts after being
  // stopped (a fresh gatedRaf `start()`), so the first frame back always
  // reports 0 elapsed rather than however long the section was off-screen —
  // MAX_FRAME_DT_S's clamp inside stepAndDraw would catch a huge gap anyway,
  // but this avoids even a single clamped-but-still-large jump.
  if (!reducedMotion) {
    gatedRaf(canvas, () => {
      const now = performance.now();
      const dtRawS = lastFrameTime === 0 ? 0 : (now - lastFrameTime) / 1000;
      lastFrameTime = now;
      stepAndDraw(dtRawS);
    });
  }

  /**
   * Reduced-motion stand-in for the animated burst: renders every particle
   * frozen at the same fraction of its own simulated lifetime (computed
   * analytically — no velocity integration loop needed for a single instant)
   * instead of animating them, and never starts a loop at all. Follows this
   * codebase's established "skip the loop entirely under reduced motion"
   * convention (see reveal-observer.ts's initScrollReveal).
   */
  function drawStaticFrame(): void {
    ctx!.clearRect(0, 0, cssWidth, cssHeight);
    ctx!.globalCompositeOperation = "lighter";
    const gAccel = gravityAccelPx();
    const count = Math.min(currentParticleCount(), REDUCED_MOTION_PARTICLE_CAP);
    for (let i = 0; i < count; i++) {
      const p = makeParticle();
      const t = p.life * REDUCED_MOTION_FREEZE_FRACTION;
      const x = p.x + p.vx * t;
      const y = p.y + p.vy * t + 0.5 * gAccel * t * t;
      const lifeFrac = t / p.life;
      drawEmber(x, y, p.size, lifeFrac);
    }
    ctx!.globalCompositeOperation = "source-over";
    hasStaticFrame = true;
  }

  /**
   * Called once at init (kicking off the permanent, continuous stream) and
   * again every time viscosity/gas/style changes, so the reshaped eruption
   * is reflected immediately. Under full motion this is a no-op — gatedRaf's
   * loop above already reads getEruptionState() live on every spawn/frame —
   * but under reduced motion, re-drawing the static frame is the only way a
   * parameter change becomes visible at all.
   */
  function start(): void {
    if (reducedMotion) drawStaticFrame();
  }

  /**
   * "Trigger eruption"'s extra, immediate pulse on top of the permanent
   * stream — floored at a small minimum so the button always does something
   * visible even at a near-effusive setting, since (unlike the ambient
   * stream, which is allowed to genuinely go quiet) a manual button press
   * with no visible effect reads as broken rather than realistic.
   */
  function burst(): void {
    if (reducedMotion) {
      drawStaticFrame();
      return;
    }
    const count = Math.max(12, currentParticleCount());
    for (let i = 0; i < count && particles.length < MAX_LIVE_PARTICLES; i++) {
      particles.push(makeParticle());
    }
  }

  return { start, burst };
}

/**
 * Wires up `.eruption-sim` in #underground-process. The chamber is
 * permanently full from the moment this runs: `--eruption-pressure` is set
 * to 1 once, `.is-erupting`/`.is-erupting-continuous` go on once, and
 * neither is ever removed — there is no pressure ramp, no dormant state, and
 * no re-trigger requirement. Viscosity, gas content, and the five
 * eruption-style tabs drive the eruption-rate/VEI/column-height metrics
 * (updateMetrics(), recomputed on every input) and the canvas ember-particle
 * layer (see createParticleBurst/computeExplosivity) live, so the ongoing
 * eruption reshapes itself immediately as those change rather than needing
 * "Trigger eruption" pressed again. "Trigger eruption" instead fires one
 * extra pulse of particles on top of the permanent stream; "Reset volcano"
 * restores viscosity/gas/style to their defaults. No-ops if any expected
 * element is missing, matching this codebase's other init functions (e.g.
 * initBackToTop, initHeroCursorGlass).
 */
export function initEruptionSimulator(): void {
  const container = document.querySelector<HTMLElement>(".eruption-sim");
  const viscositySlider = document.querySelector<HTMLInputElement>("#eruption-viscosity");
  const viscosityReadout = document.querySelector<HTMLOutputElement>("#eruption-viscosity-readout");
  const gasSlider = document.querySelector<HTMLInputElement>("#eruption-gas");
  const gasReadout = document.querySelector<HTMLOutputElement>("#eruption-gas-readout");
  const resetButton = document.querySelector<HTMLButtonElement>("#eruption-reset");
  const eruptButton = document.querySelector<HTMLButtonElement>("#eruption-erupt");
  const styleTabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".eruption-sim-style-tab"));
  const styleDesc = document.querySelector<HTMLElement>("#eruption-style-desc");
  const status = document.querySelector<HTMLElement>("#eruption-status");
  const metricPressure = document.querySelector<HTMLElement>("#metric-pressure");
  const metricRate = document.querySelector<HTMLElement>("#metric-rate");
  const metricVei = document.querySelector<HTMLElement>("#metric-vei");
  const metricViscosity = document.querySelector<HTMLElement>("#metric-viscosity");
  const metricGas = document.querySelector<HTMLElement>("#metric-gas");
  const metricColumnHeight = document.querySelector<HTMLElement>("#metric-column-height");

  // The canvas ember-particle layer is a separate concern from the rest of
  // this function's required elements above: if it's missing, the particle
  // system just no-ops (see particleSystem below) rather than taking down
  // the whole simulator, matching this file's existing "return early only
  // when something truly required is missing" convention.
  const particlesCanvas = document.querySelector<HTMLCanvasElement>(".eruption-sim-particles");

  if (
    !container ||
    !viscositySlider ||
    !viscosityReadout ||
    !gasSlider ||
    !gasReadout ||
    !resetButton ||
    !eruptButton ||
    styleTabs.length === 0 ||
    !styleDesc ||
    !status ||
    !metricPressure ||
    !metricRate ||
    !metricVei ||
    !metricViscosity ||
    !metricGas ||
    !metricColumnHeight
  ) {
    return;
  }

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let activeStyle: EruptionStyleName = "effusive";

  // Reads viscosity/gas/style live at call time, not once at construction —
  // see createParticleBurst's doc comment for why that matters for both the
  // manual burst pulse and every wave of the permanent, continuous stream.
  const particleSystem = particlesCanvas
    ? createParticleBurst(particlesCanvas, reducedMotion, () => ({
        style: STYLES[activeStyle],
        viscosity: Number(viscositySlider.value),
        gas: Number(gasSlider.value),
      }))
    : null;

  // Eruption-rate, VEI, and column height all depend on viscosity, gas, and
  // the active style, so all three are recomputed together whenever any of
  // those changes — this is also what makes the permanent eruption "reshape
  // live" rather than needing a re-trigger, since it's called from every
  // slider/tab handler below as well as once at init.
  function updateMetrics(): void {
    const style = STYLES[activeStyle];
    const viscosity = Number(viscositySlider!.value);
    const gas = Number(gasSlider!.value);

    const rate = (style.baseRate * (1 + gas / 100)) / (1 + viscosity / 150);
    metricRate!.textContent = `${Math.round(rate * 10) / 10} m³/s`;

    metricVei!.textContent = String(computeVei(style, viscosity, gas));
    metricViscosity!.textContent = `${viscosity}%`;
    metricGas!.textContent = `${gas}%`;

    const columnHeightKm = computeColumnHeightKm(style, viscosity, gas);
    metricColumnHeight!.textContent = `${columnHeightKm.toFixed(1)} km`;
  }

  // Shared by the initial sync and every tab click: switches which style is
  // "active" everywhere that matters — the CSS hook (data-eruption-style),
  // the burst's travel-distance scale (--style-intensity), the tab button
  // states, and the metrics/particle physics that depend on it.
  function applyStyle(name: EruptionStyleName): void {
    activeStyle = name;
    const style = STYLES[name];
    container!.dataset.eruptionStyle = name;
    container!.style.setProperty("--style-intensity", String(style.intensity));
    styleDesc!.textContent = style.description;
    for (const tab of styleTabs) {
      const isActive = tab.dataset.style === name;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-pressed", String(isActive));
    }
    updateMetrics();
    particleSystem?.start();
  }

  // Higher viscosity reads as a slower, thicker trickle — styles.css animates
  // the flow with `animation-duration: var(--flow-duration, …)`, so writing
  // this custom property takes effect immediately, including mid-eruption,
  // with no need to touch any other logic.
  function applyFlowDuration(viscosity: number): void {
    container!.style.setProperty("--flow-duration", `${(1.1 * (1 + viscosity / 100)).toFixed(2)}s`);
  }

  // Higher gas reads as faster, more frequent fuming — the inverse shape of
  // flow duration above, since more gas should shorten the puff cycle rather
  // than lengthen it.
  function applyFumeDuration(gas: number): void {
    container!.style.setProperty("--fume-duration", `${(3.6 / (1 + gas / 100)).toFixed(2)}s`);
  }

  // Ties the explosive ejecta/smoke burst's speed and travel distance to the
  // same viscosity/gas sliders that already feed the eruption-rate/VEI
  // metrics — mirrors applyFlowDuration's viscosity-only treatment of the
  // effusive dribble above, but folds in gas too since an explosive burst
  // reads as more energetic with more gas, not just less viscous. `net`
  // collapses both into one -1..1 axis (gassy+runny at +1, thick+gas-poor at
  // -1) so duration and distance move together in the same direction off a
  // single computation. Written as --ejecta-duration (styles.css's
  // eruption-ejecta-burst reads it directly; eruption-smoke-burst derives
  // its own duration proportionally from it) and --ejecta-distance-scale
  // (multiplies both keyframes' translate distances). Kept subtle —
  // duration stays within ~1–2.5s, distance scale within ~0.7–1.4x — so the
  // direction (more gas → faster/farther, more viscosity → slower/shorter)
  // reads clearly without turning into a wild swing.
  function applyEjectaMotion(viscosity: number, gas: number): void {
    const net = (gas - viscosity) / 100;
    const duration = Math.min(2.5, Math.max(1, 1.75 - net * 0.75));
    const distanceScale = Math.min(1.4, Math.max(0.7, 1 + net * 0.35));
    container!.style.setProperty("--ejecta-duration", `${duration.toFixed(2)}s`);
    container!.style.setProperty("--ejecta-distance-scale", distanceScale.toFixed(2));
  }

  viscositySlider.addEventListener("input", () => {
    viscosityReadout.textContent = `${viscositySlider.value}%`;
    applyFlowDuration(Number(viscositySlider.value));
    applyEjectaMotion(Number(viscositySlider.value), Number(gasSlider.value));
    updateMetrics();
    particleSystem?.start();
  });

  gasSlider.addEventListener("input", () => {
    gasReadout.textContent = `${gasSlider.value}%`;
    applyFumeDuration(Number(gasSlider.value));
    applyEjectaMotion(Number(viscositySlider.value), Number(gasSlider.value));
    updateMetrics();
    particleSystem?.start();
  });

  for (const tab of styleTabs) {
    tab.addEventListener("click", () => {
      const name = tab.dataset.style;
      if (!isEruptionStyleName(name)) return;
      applyStyle(name);
    });
  }

  // No longer arms or checks pressure (the chamber's always full) — just an
  // extra, immediate pulse of particles layered on top of the permanent
  // stream, so the button still does something rather than being a no-op.
  eruptButton.addEventListener("click", () => {
    particleSystem?.burst();
  });

  // Restores viscosity/gas/style to their defaults; pressure was never
  // something it needs to touch, since the chamber stays permanently full
  // either way.
  resetButton.addEventListener("click", () => {
    viscositySlider.value = "30";
    gasSlider.value = "30";
    viscosityReadout.textContent = "30%";
    gasReadout.textContent = "30%";
    applyFlowDuration(30);
    applyFumeDuration(30);
    applyEjectaMotion(30, 30);
    applyStyle("effusive");
  });

  // Initial sync: the markup ships plausible static defaults, but this
  // computes and renders the real values for the default slider/style state
  // before any interaction — and, for the style, also sets --style-intensity
  // on the container, which styles.css's burst keyframe otherwise falls back
  // to reading as 1 (correct for plinian, wrong for effusive's 0) until a
  // tab is clicked. The chamber is set to permanently full and the
  // continuous-eruption classes go on once here and are never removed —
  // see this function's doc comment above.
  container.style.setProperty("--eruption-pressure", "1");
  metricPressure.textContent = "100%";
  container.classList.add("is-erupting", "is-erupting-continuous");
  status.textContent = "Erupting continuously — chamber full";
  applyStyle(activeStyle);
  applyFlowDuration(Number(viscositySlider.value));
  applyFumeDuration(Number(gasSlider.value));
  applyEjectaMotion(Number(viscositySlider.value), Number(gasSlider.value));
  particleSystem?.start();
}
