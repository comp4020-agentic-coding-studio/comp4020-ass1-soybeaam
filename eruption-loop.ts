// Continuous ambient eruption illustration for #process's `.eruption-loop`
// widget -- a self-contained 2D canvas particle system (terrain/cone, lava
// flows, an ash/eruption column, ballistic "spark" embers, and a pyroclastic
// glow at the base), plus a "Trigger surge" button that temporarily boosts
// everything's intensity. Ported from a standalone prototype: the original
// used an unconditional `requestAnimationFrame` loop and global
// `document.getElementById` lookups; here the loop is gated by the same
// `gatedRaf` helper scroll-effects.ts uses for initParallax/initVolcanoScene
// (so the canvas is idle whenever the section is off-screen), and every
// element is looked up scoped inside `.eruption-loop` -- there is an
// unrelated pre-existing `#scene` canvas elsewhere on the page, so a global
// id lookup would collide with it.
//
// prefers-reduced-motion: rather than skipping the widget entirely, it draws
// one static frame (terrain, a calm baseline lava glow, and a handful of
// fixed, non-animating ash puffs) and never starts the continuous loop -- no
// per-frame ash spawn, no sparks. The "Trigger surge" button still responds
// to a click (a user-initiated action, not automatic motion), but under
// reduced motion it only nudges the same static frame's glow up and back
// down once, instead of kicking off the particle system.

import { gatedRaf } from "./scroll-effects";

interface AshParticle {
  baseX: number;
  x: number;
  y: number;
  phase: number;
  age: number;
  life: number;
  riseTarget: number;
  spreadTarget: number;
  dir: number;
  r0: number;
  r: number;
  a0: number;
  alpha: number;
  dark: number;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  trail: { x: number; y: number }[];
}

/** Baseline (non-surged) intensities, and how much a surge boosts each. */
const BASE = {
  plumeFrac: 0.62,
  ashDensity: 0.5,
  lavaIntensity: 0.75,
  pyroclastic: 0.12,
  shake: 0.05,
  surgeBoost: 0.55,
};

/** Ash particle pool size -- generous enough that the spawn rate never stalls. */
const ASH_POOL_SIZE = 560;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Mounts the ambient eruption canvas into `.eruption-loop .eruption-loop-canvas`
 * and wires up its `.eruption-loop-replay` "Trigger surge" button.
 */
export function initEruptionLoop(): void {
  const root = document.querySelector<HTMLElement>(".eruption-loop");
  const foundStage = root?.querySelector<HTMLElement>(".eruption-loop-stage");
  const foundCanvas = root?.querySelector<HTMLCanvasElement>(".eruption-loop-canvas");
  const replayButton = root?.querySelector<HTMLButtonElement>(".eruption-loop-replay");
  if (!root || !foundStage || !foundCanvas) return;
  // Narrowed into typed locals (matching hero-cursor-glass.ts's pattern) so
  // that TS keeps them non-null inside the nested function declarations below
  // — control-flow narrowing on the original `foundStage`/`foundCanvas`
  // bindings doesn't carry into hoisted function declarations.
  const stage: HTMLElement = foundStage;
  const canvas: HTMLCanvasElement = foundCanvas;

  const foundCtx = canvas.getContext("2d");
  if (!foundCtx) return;
  const ctx: CanvasRenderingContext2D = foundCtx;

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;

  // ---- Terrain (cone + crater) ----
  let groundY = 0;
  let coneBaseW = 0;
  let coneApexX = 0;
  let coneApexY = 0;
  let craterY = 0;

  function layoutTerrain(): void {
    groundY = height * 0.86;
    coneApexX = width * 0.5;
    coneApexY = height * 0.5;
    coneBaseW = width * 0.5;
    craterY = coneApexY + (groundY - coneApexY) * 0.06;
  }

  function drawCone(glowAmount: number): void {
    const apex = { x: coneApexX, y: coneApexY };
    const baseL = { x: coneApexX - coneBaseW / 2, y: groundY };
    const baseR = { x: coneApexX + coneBaseW / 2, y: groundY };

    const rockGradient = ctx.createLinearGradient(0, apex.y, 0, groundY);
    rockGradient.addColorStop(0, "#5c4738");
    rockGradient.addColorStop(0.5, "#4a372a");
    rockGradient.addColorStop(1, "#241b16");
    ctx.fillStyle = rockGradient;
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(baseR.x, baseR.y);
    ctx.lineTo(baseL.x, baseL.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#1a120e";
    ctx.beginPath();
    ctx.moveTo(apex.x - 14, craterY);
    ctx.lineTo(apex.x, apex.y + 10);
    ctx.lineTo(apex.x + 14, craterY);
    ctx.closePath();
    ctx.fill();

    if (glowAmount > 0.03) {
      const glow = ctx.createRadialGradient(apex.x, craterY, 1, apex.x, craterY, 26 + glowAmount * 24);
      glow.addColorStop(0, "rgba(255,178,56," + Math.min(0.8, 0.55 * glowAmount) + ")");
      glow.addColorStop(1, "rgba(255,90,31,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(apex.x, craterY, 26 + glowAmount * 24, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(233,228,218,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(apex.x, apex.y);
    ctx.lineTo(baseL.x, baseL.y);
    ctx.stroke();
  }

  // ---- Lava flows down the cone's flanks ----
  const LAVA_STREAM_OFFSETS = [0.3, 0.5, 0.68];
  let lavaT = 0;

  function updateLava(dt: number): void {
    lavaT += dt;
  }

  function drawLava(intensity: number): void {
    if (intensity <= 0.02) return;
    ctx.save();
    LAVA_STREAM_OFFSETS.forEach((offset, i) => {
      const top = { x: coneApexX, y: craterY };
      const baseX = lerp(coneApexX - coneBaseW * 0.42, coneApexX + coneBaseW * 0.42, offset);
      const baseY = groundY - 2;
      const wobble = Math.sin(lavaT * 1.4 + i * 2) * 6 * intensity;
      ctx.strokeStyle =
        "rgba(255," + Math.floor(90 + 70 * intensity) + "," + Math.floor(20 + 20 * intensity) + "," + (0.55 + 0.35 * intensity) + ")";
      ctx.lineWidth = 3 + intensity * 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(top.x, top.y + 4);
      ctx.quadraticCurveTo((top.x + baseX) / 2 + wobble, (top.y + baseY) / 2, baseX, baseY);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,205,120," + 0.5 * intensity + ")";
      ctx.lineWidth = 1.2 + intensity * 2;
      ctx.stroke();
    });
    ctx.restore();
  }

  function drawFountain(lavaIntensity: number, t: number): void {
    if (lavaIntensity < 0.05) return;
    const ventX = coneApexX;
    const ventY = craterY;
    ctx.save();
    for (let i = 0; i < 12; i++) {
      const seed = i * 13.7;
      const phase = (t * 1.8 + seed) % 1;
      const h = phase * 38 * lavaIntensity;
      const x = ventX + Math.sin(seed) * 11 * phase;
      const y = ventY - h;
      ctx.fillStyle = "rgba(255," + (180 - Math.floor(phase * 90)) + ",60," + (1 - phase) * 0.9 + ")";
      ctx.beginPath();
      ctx.arc(x, y, 2.6 * (1 - phase * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- Ash / eruption column ----
  const ashParticles: (AshParticle | null)[] = Array.from({ length: ASH_POOL_SIZE }, () => null);
  let ashSpawnAccum = 0;

  function ashSpawnRate(ashDensity: number): number {
    return 3 + ashDensity * 70;
  }

  function spawnAsh(ashDensity: number, plumeFrac: number): void {
    const idx = ashParticles.findIndex((p) => p === null);
    if (idx === -1) return;
    const ventX = coneApexX;
    const ventY = craterY;
    const maxHeightPx = (groundY - 40) * plumeFrac;
    const dir = Math.random() < 0.5 ? -1 : 1;
    ashParticles[idx] = {
      baseX: ventX + (Math.random() - 0.5) * 10,
      y: ventY,
      x: ventX,
      phase: Math.random() * 10,
      age: 0,
      life: 4.2 + Math.random() * 3.2,
      riseTarget: maxHeightPx * (0.55 + Math.random() * 0.5),
      spreadTarget: (26 + maxHeightPx * 0.65) * (0.5 + Math.random() * 0.8),
      dir,
      r0: 16 + Math.random() * 20 + ashDensity * 16,
      r: 0,
      a0: 0.22 + Math.random() * 0.16,
      alpha: 0,
      dark: Math.random(),
    };
  }

  // Spawns and ages ash particles -- only ever called from the continuous
  // (non-reduced-motion) loop.
  function updateAsh(dt: number, ashDensity: number, plumeFrac: number): void {
    const ventY = craterY;
    ashSpawnAccum += dt * ashSpawnRate(ashDensity);
    while (ashSpawnAccum >= 1) {
      ashSpawnAccum -= 1;
      spawnAsh(ashDensity, plumeFrac);
    }

    for (let i = 0; i < ashParticles.length; i++) {
      const p = ashParticles[i];
      if (!p) continue;
      p.age += dt;
      const lifeT = p.age / p.life;
      if (lifeT >= 1) {
        ashParticles[i] = null;
        continue;
      }
      const riseEase = 1 - Math.pow(1 - Math.min(1, lifeT * 1.4), 2);
      p.y = ventY - riseEase * p.riseTarget;
      const spread = Math.pow(lifeT, 0.6) * p.spreadTarget;
      const turbulence =
        Math.sin(p.phase + p.age * 0.9) * 6 * (0.3 + lifeT) + Math.sin(p.phase * 1.7 + p.age * 0.4) * 4;
      p.x = p.baseX + turbulence + spread * p.dir;
      p.r = p.r0 * (0.55 + lifeT * 1.9);
      p.alpha = p.a0 * (lifeT < 0.12 ? lifeT / 0.12 : Math.pow(1 - lifeT, 0.8));
    }
  }

  function drawAsh(ashDensity: number): void {
    ctx.save();
    for (const p of ashParticles) {
      if (!p) continue;
      const shade = Math.floor(lerp(165, 70, ashDensity * 0.7 + p.dark * 0.3));
      const rad = Math.max(1, p.r);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rad);
      grad.addColorStop(0, "rgba(" + shade + "," + (shade - 6) + "," + (shade - 14) + "," + p.alpha + ")");
      grad.addColorStop(0.6, "rgba(" + (shade - 10) + "," + (shade - 16) + "," + (shade - 22) + "," + p.alpha * 0.6 + ")");
      grad.addColorStop(1, "rgba(" + (shade - 20) + "," + (shade - 24) + "," + (shade - 30) + ",0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // Seeds a small, fixed set of non-animating ash puffs for the
  // reduced-motion static frame.
  function seedCalmAsh(): void {
    const ventX = coneApexX;
    const ventY = craterY;
    const count = 6;
    for (let i = 0; i < ashParticles.length; i++) ashParticles[i] = null;
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const rad = 26 + t * 30;
      ashParticles[i] = {
        baseX: ventX,
        x: ventX + (t - 0.5) * 90,
        y: ventY - 30 - t * 130,
        phase: 0,
        age: 0,
        life: 1,
        riseTarget: 0,
        spreadTarget: 0,
        dir: t < 0.5 ? -1 : 1,
        r0: rad,
        r: rad,
        a0: 0.24,
        alpha: 0.24 * (1 - t * 0.5),
        dark: t,
      };
    }
  }

  // ---- Ballistic sparks ----
  const sparks: SparkParticle[] = [];
  let sparkSpawnAccum = 0;

  function sparkSpawnRate(intensity: number): number {
    return 2.5 + intensity * 5.5;
  }

  function updateSparks(dt: number, intensity: number): void {
    const ventX = coneApexX;
    const ventY = craterY;
    const gravity = 320;
    sparkSpawnAccum += dt * sparkSpawnRate(intensity);
    while (sparkSpawnAccum >= 1) {
      sparkSpawnAccum -= 1;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const speed = 140 + Math.random() * 170 * (0.6 + intensity);
      sparks.push({
        x: ventX + (Math.random() - 0.5) * 8,
        y: ventY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 5 + Math.random() * 7 + intensity * 4,
        life: 0,
        maxLife: 1.1 + Math.random() * 0.9,
        trail: [],
      });
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > 6) p.trail.shift();
      p.vy += gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dt;
      if (p.life >= p.maxLife || p.y > groundY + 20) sparks.splice(i, 1);
    }
  }

  function drawSparks(): void {
    ctx.save();
    for (const p of sparks) {
      const lifeT = p.life / p.maxLife;
      const alpha = Math.max(0, 1 - lifeT);
      if (p.trail.length > 1) {
        ctx.strokeStyle = "rgba(255,140,50," + alpha * 0.4 + ")";
        ctx.lineWidth = p.r * 0.35;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let i = 1; i < p.trail.length; i++) ctx.lineTo(p.trail[i].x, p.trail[i].y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 2.2);
      glow.addColorStop(0, "rgba(255,220,150," + alpha * 0.9 + ")");
      glow.addColorStop(0.5, "rgba(255,120,40," + alpha * 0.5 + ")");
      glow.addColorStop(1, "rgba(255,90,30,0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle =
        "rgba(255," + Math.floor(230 - lifeT * 80) + "," + Math.floor(160 - lifeT * 120) + "," + alpha + ")";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (1 - lifeT * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---- Pyroclastic flow glow at the base ----
  let pyroT = 0;

  function updatePyroclastic(dt: number): void {
    pyroT += dt;
  }

  function drawPyroclastic(intensity: number): void {
    if (intensity <= 0.02) return;
    const baseY = groundY;
    const reach = intensity * coneBaseW * 1.35;
    const pulse = 1 + Math.sin(pyroT * 1.6) * 0.03 * intensity;
    ctx.save();
    const glow = ctx.createRadialGradient(coneApexX, baseY, 4, coneApexX, baseY, reach * pulse);
    glow.addColorStop(0, "rgba(120,90,80," + 0.55 * intensity + ")");
    glow.addColorStop(0.6, "rgba(90,75,72," + 0.42 * intensity + ")");
    glow.addColorStop(1, "rgba(80,70,68,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(coneApexX, baseY, reach * pulse, reach * pulse * 0.3, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---- Screen shake ----
  let shakeX = 0;
  let shakeY = 0;

  function updateShake(intensity: number): void {
    if (intensity <= 0.01) {
      shakeX = 0;
      shakeY = 0;
      return;
    }
    const mag = intensity * 5;
    shakeX = (Math.random() - 0.5) * mag;
    shakeY = (Math.random() - 0.5) * mag;
  }

  // ---- Surge state, driven by the "Trigger surge" button ----
  let surge = 0;

  // dt is clamped the same way as this repo's other frame loops (see
  // scroll-effects.ts / stage.ts), so resuming after the tab was
  // backgrounded does not snap every eased value in one jump.
  let lastTime = performance.now();

  function stepFrame(): void {
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    surge = Math.max(0, surge - dt * 0.35);

    const boost = surge * BASE.surgeBoost;
    const ashDensity = Math.min(1, BASE.ashDensity + boost);
    const plumeFrac = Math.min(1, BASE.plumeFrac + boost * 0.5);
    const lavaIntensity = BASE.lavaIntensity;
    const pyroclasticIntensity = Math.min(1, BASE.pyroclastic + boost * 0.8);
    const shakeAmt = BASE.shake + boost * 0.6;

    updateLava(dt);
    updatePyroclastic(dt);
    updateAsh(dt, ashDensity, plumeFrac);
    updateShake(shakeAmt);

    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.translate(shakeX, shakeY);

    drawCone(lavaIntensity + boost * 0.4);
    drawPyroclastic(pyroclasticIntensity);
    drawLava(lavaIntensity);
    drawFountain(lavaIntensity, lavaT);
    drawAsh(ashDensity);
    updateSparks(dt, lavaIntensity + boost * 0.5);
    drawSparks();

    ctx.restore();
  }

  // The reduced-motion single frame: terrain plus a calm, non-animating
  // lava/ash state. `boost` briefly lifts the glow when the surge button is
  // pressed, without spawning any particles.
  function drawStaticFrame(boost: number): void {
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    drawCone(BASE.lavaIntensity + boost * 0.4);
    drawPyroclastic(Math.min(1, BASE.pyroclastic + boost * 0.5));
    drawLava(BASE.lavaIntensity);
    drawFountain(BASE.lavaIntensity, 0);
    drawAsh(BASE.ashDensity);
    ctx.restore();
  }

  function resize(): void {
    const rect = stage.getBoundingClientRect();
    width = Math.max(200, rect.width);
    height = Math.max(200, rect.height);
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layoutTerrain();
    if (reducedMotion) {
      seedCalmAsh();
      drawStaticFrame(0);
    }
  }

  resize();
  window.addEventListener("resize", resize);

  if (reducedMotion) {
    replayButton?.addEventListener("click", () => {
      drawStaticFrame(1);
      window.setTimeout(() => drawStaticFrame(0), 900);
    });
  } else {
    gatedRaf(stage, stepFrame);
    replayButton?.addEventListener("click", () => {
      surge = 1;
    });
  }
}
