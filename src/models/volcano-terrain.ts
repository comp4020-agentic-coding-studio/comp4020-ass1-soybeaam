// Code-generated additions to the imported volcano glTF (see volcano-scene.ts).
//
// The glTF is a baked DEM export: a 33-unit square terrain plate with the cone
// in the middle. Two things it doesn't give us, both built here in code rather
// than by editing someone else's CC-licensed binary:
//
//   1. `buildTerrainApron` — the plate's boundary is a hard-edged square, and
//      from the AERIAL camera keyframe that square read as a diamond silhouette
//      against the page background. The apron is a large procedural annulus of
//      ground whose inner rim is buried under the cone's flank and whose plain
//      covers the plate's entire outer skirt, so what reads as land is a round,
//      irregular shoreline; it carries on outward for twelve plate-widths,
//      darkening with distance until it renders as the page's own background
//      colour rather than ever showing an edge of its own.
//   2. `buildCraterLava` — a molten pool in the crater bowl, which the finale
//      keyframe dives into.
//
// Both need to know how high the baked terrain is at an arbitrary (x, z), and
// raycasting the glTF costs ~140 ms per ray (150k triangles, no BVH), so
// `sampleHeightfield` does one pass over the model's position buffers and bins
// them into a max-height grid instead. That's a few milliseconds and it's what
// every "sit on the terrain" decision below is solved against — the geometry is
// fitted to the asset that's actually loaded, not to hand-guessed coordinates.

import * as THREE from "three";

/** A coarse max-height grid over the model's XZ footprint, in *model* space. */
export type Heightfield = {
  /** Half-width of the baked plate's square footprint (its XZ half-extent). */
  halfWidth: number;
  /** Centre of the plate's footprint, and the height range found. */
  centre: THREE.Vector3;
  minY: number;
  maxY: number;
  /** Bilinearly interpolated terrain height at (x, z), clamped at the edges. */
  heightAt(x: number, z: number): number;
};

/**
 * Bins every vertex of `root` into a `resolution`×`resolution` max-height grid,
 * expressed in `root`'s own local space (so the result stays valid as `root`
 * rotates, and geometry built from it can be parented to `root`).
 */
export function sampleHeightfield(root: THREE.Object3D, resolution = 128): Heightfield {
  root.updateWorldMatrix(true, true);
  const toRoot = root.matrixWorld.clone().invert();

  const meshes: { positions: THREE.BufferAttribute | THREE.InterleavedBufferAttribute; matrix: THREE.Matrix4 }[] = [];
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
    meshes.push({
      positions: mesh.geometry.attributes.position,
      matrix: new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld),
    });
  });

  // Pass 1: bounds in root space.
  const v = new THREE.Vector3();
  const box = new THREE.Box3();
  for (const { positions, matrix } of meshes) {
    for (let i = 0; i < positions.count; i++) {
      v.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      box.expandByPoint(v);
    }
  }

  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const halfWidth = Math.max(size.x, size.z) / 2;
  const cell = Math.max(size.x, size.z) / (resolution - 1);
  const originX = centre.x - halfWidth;
  const originZ = centre.z - halfWidth;

  // Pass 2: max height per cell. Max rather than mean because everything built
  // on top of this wants to know "what must I stay clear of / bury under".
  const data = new Float32Array(resolution * resolution).fill(Number.NaN);
  for (const { positions, matrix } of meshes) {
    for (let i = 0; i < positions.count; i++) {
      v.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      const gx = Math.round((v.x - originX) / cell);
      const gz = Math.round((v.z - originZ) / cell);
      if (gx < 0 || gz < 0 || gx >= resolution || gz >= resolution) continue;
      const index = gz * resolution + gx;
      const current = data[index];
      if (Number.isNaN(current) || v.y > current) data[index] = v.y;
    }
  }

  // Any cell the vertex distribution happened to miss is filled from its
  // neighbours, so `heightAt` never has to deal with holes.
  for (let pass = 0; pass < 4; pass++) {
    let holes = 0;
    for (let gz = 0; gz < resolution; gz++) {
      for (let gx = 0; gx < resolution; gx++) {
        const index = gz * resolution + gx;
        if (!Number.isNaN(data[index])) continue;
        let sum = 0;
        let count = 0;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = gx + dx;
            const nz = gz + dz;
            if (nx < 0 || nz < 0 || nx >= resolution || nz >= resolution) continue;
            const value = data[nz * resolution + nx];
            if (Number.isNaN(value)) continue;
            sum += value;
            count++;
          }
        }
        if (count > 0) data[index] = sum / count;
        else holes++;
      }
    }
    if (holes === 0) break;
  }
  for (let i = 0; i < data.length; i++) if (Number.isNaN(data[i])) data[i] = box.min.y;

  function heightAt(x: number, z: number): number {
    const fx = THREE.MathUtils.clamp((x - originX) / cell, 0, resolution - 1);
    const fz = THREE.MathUtils.clamp((z - originZ) / cell, 0, resolution - 1);
    const x0 = Math.floor(fx);
    const z0 = Math.floor(fz);
    const x1 = Math.min(x0 + 1, resolution - 1);
    const z1 = Math.min(z0 + 1, resolution - 1);
    const tx = fx - x0;
    const tz = fz - z0;
    const h00 = data[z0 * resolution + x0];
    const h10 = data[z0 * resolution + x1];
    const h01 = data[z1 * resolution + x0];
    const h11 = data[z1 * resolution + x1];
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(h00, h10, tx),
      THREE.MathUtils.lerp(h01, h11, tx),
      tz,
    );
  }

  return { halfWidth, centre, minY: box.min.y, maxY: box.max.y, heightAt };
}

/* ------------------------------------------------------------------
   Deterministic value noise. No Math.random anywhere in here: the same
   model must produce the same land every load, or a reload mid-scroll
   would quietly re-roll the terrain under the camera.
   ------------------------------------------------------------------ */

function hash2(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const n00 = hash2(x0, y0);
  const n10 = hash2(x0 + 1, y0);
  const n01 = hash2(x0, y0 + 1);
  const n11 = hash2(x0 + 1, y0 + 1);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(n00, n10, sx),
    THREE.MathUtils.lerp(n01, n11, sx),
    sy,
  );
}

/** Fractal value noise in −1…1. */
function fbm(x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  let frequency = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amplitude * (valueNoise(x * frequency, y * frequency) * 2 - 1);
    total += amplitude;
    amplitude *= 0.5;
    frequency *= 2.07;
  }
  return sum / total;
}

/** Noise on a circle: wraps exactly, so there's no seam at θ = 0. */
function angularNoise(theta: number, lobes: number, phase: number): number {
  const x = Math.cos(theta) * lobes;
  const y = Math.sin(theta) * lobes;
  return fbm(x + phase, y - phase, 3);
}

/* ------------------------------------------------------------------
   The apron
   ------------------------------------------------------------------ */

const APRON_RADIAL_SEGMENTS = 192;
/** Rings. Spaced geometrically (see below), not linearly. */
const APRON_RINGS = 72;
/** Outer radius, in plate half-widths. The widest pose (AERIAL, 1.7× fit) has
 *  ground in frame out to roughly 6 half-widths and its shallowest corner ray
 *  reaches ~9, so 12 keeps the apron's own edge outside every frame while
 *  staying comfortably inside `camera.far`. */
const APRON_EXTENT = 12;
/** Radius of the apron's buried inner rim, as a fraction of the plate's
 *  half-width. A *circle*, not an inset copy of the square: the rim is level
 *  all the way round, so the apron crosses the cone's flank at a roughly
 *  constant radius and the plate's four corners — which stick out to 1.41
 *  half-widths and are the most square-looking thing about it — end up under
 *  the plain. What's left reading as land is a round footprint.
 *
 *  It also has to be far enough in to be on the *flank*: the bake's outer
 *  skirt is nearly dead flat (its perimeter height varies by half a unit over
 *  33), and a level plain crossing a level skirt intersects it in a chaotic
 *  band of spikes and islands. Crossing the flank instead, where the terrain
 *  falls about 0.7 per unit of radius, gives one clean shoreline. */
const APRON_INNER = 0.78;
/** How far the plain clears the highest point on the plate's perimeter. Has to
 *  beat the skirt's own noise (~±0.25) plus the apron's near-field relief. */
const PLAIN_CLEARANCE = 1.2;
/** Measured, not derived: under volcano-scene.ts's ambient-dominant rig a flat
 *  up-facing Lambert surface renders about 1.17× its own albedo. The far end of the
 *  apron has to *render* as the page's background colour — not merely be
 *  painted with it — or the ground stays visibly lighter than the page and the
 *  canvas itself starts reading as a rectangle. So the horizon albedo is
 *  pre-divided by this. Re-measure it if the lighting in volcano-scene.ts
 *  changes: sample the frame's far corners at progress 0 and compare with
 *  `--color-surface`. */
const HORIZON_LIGHT_GAIN = 1.17;

export type ApronOptions = {
  /** Albedo where the apron meets the bake, matched to the flank it emerges
   *  through (not to the pale skirt further in — the shoreline sits on the
   *  flank, and that's the only tone the join is judged against). */
  shore?: THREE.ColorRepresentation;
  /** Albedo the plain settles to once it's clear of the plate. */
  rock?: THREE.ColorRepresentation;
  /** Warmer, oxidised ground mixed into `rock` in patches. */
  rust?: THREE.ColorRepresentation;
  /** Colour the far distance fades to — the page background behind the canvas. */
  horizon?: THREE.ColorRepresentation;
};

/**
 * Builds the ground that carries on past the baked plate's square edge.
 *
 * The seam is hidden by *intersection*, not by butt-joining. The apron is a
 * level plain sitting `PLAIN_CLEARANCE` above the highest point on the plate's
 * perimeter, with its inner rim buried under the cone's flank at
 * `APRON_INNER` of a half-width. So the plate's whole outer skirt — including
 * the four corners, which are what read as "square" — is *under* the plain, and
 * the only place the two surfaces meet is where the flank rises through the
 * plain's level. Nothing has to line up to a vertex, nothing can open a crack,
 * and the shoreline's shape is the *baked* terrain's own contour at that height
 * plus a low-frequency wander in the plain's level: irregular, and round rather
 * than square. Past the plate the plain falls away gently and fades to the
 * page's background colour (see HORIZON_LIGHT_GAIN).
 */
export function buildTerrainApron(field: Heightfield, options: ApronOptions = {}): THREE.Mesh {
  const shore = new THREE.Color(options.shore ?? 0x847867);
  const rock = new THREE.Color(options.rock ?? 0x464339);
  const rust = new THREE.Color(options.rust ?? 0x504032);
  const horizon = new THREE.Color(options.horizon ?? 0x1e1613).multiplyScalar(1 / HORIZON_LIGHT_GAIN);

  const { halfWidth, centre } = field;
  const outerRadius = halfWidth * APRON_EXTENT;

  // The level the plain sits at, measured off the asset: the highest terrain
  // anywhere on the plate's perimeter, plus a clearance. Everything the plate's
  // hard edge does happens below this, so the edge is covered all the way
  // round without needing to know anything else about the bake.
  let perimeterMax = -Infinity;
  const perimeterSamples = 96;
  for (let i = 0; i < perimeterSamples; i++) {
    const theta = (i / perimeterSamples) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const edge = (halfWidth * 0.995) / Math.max(Math.abs(cos), Math.abs(sin));
    perimeterMax = Math.max(perimeterMax, field.heightAt(centre.x + cos * edge, centre.z + sin * edge));
  }
  const plainLevel = perimeterMax + PLAIN_CLEARANCE;

  const cols = APRON_RADIAL_SEGMENTS;
  const rows = APRON_RINGS;
  const positions = new Float32Array(cols * rows * 3);
  const colors = new Float32Array(cols * rows * 3);
  const indices: number[] = [];

  const colour = new THREE.Color();
  const ground = new THREE.Color();
  const innerRadius = halfWidth * APRON_INNER;

  for (let col = 0; col < cols; col++) {
    const theta = (col / cols) * Math.PI * 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);

    const seamY = field.heightAt(centre.x + cos * innerRadius, centre.z + sin * innerRadius);
    // The rim itself is pinned under the local terrain even if this direction's
    // flank happens to dip below the plain's level — a gully deep enough to
    // expose the rim would show as a hard straight edge, which is the whole
    // class of artefact this mesh exists to remove.
    const rimY = Math.min(plainLevel, seamY - 0.45);

    // A per-direction nudge to the plain's level, so the shoreline wanders
    // rather than tracing a circle. Small: it has to stay inside the clearance.
    const wander =
      0.22 * angularNoise(theta, 2.5, 11.3) + 0.12 * angularNoise(theta, 6.5, 4.1);

    for (let row = 0; row < rows; row++) {
      // Geometric ring spacing: dense at the seam (where the join has to be
      // hidden and the relief has to be resolved), progressively coarser
      // outwards, which is roughly constant spacing *on screen* under
      // perspective. Linear spacing undersampled the mid-field badly enough
      // that the relief noise aliased into radial streaks.
      const radius = innerRadius * Math.pow(outerRadius / innerRadius, row / (rows - 1));
      // Distance out from the buried rim, in half-widths. Everything below is
      // a function of this rather than of the *square's* boundary: measuring
      // from the square would leave the diagonals — where the plate reaches a
      // further 40% out — with a dead flat, featureless shelf.
      const out = (radius - innerRadius) / halfWidth;

      // Level while it's over the plate (the corners reach 1.41 half-widths,
      // so nothing descends until 1.5), then a long gentle fall — about nine
      // units over the apron's whole span, which reads as the flank running
      // out into a plain.
      const sink = Math.max(0, (radius - halfWidth * 1.5) / halfWidth);
      const drop = 2.6 * (1 - Math.exp(-sink * 0.55)) + 0.42 * Math.pow(sink, 1.15);
      // Undulation: held to a fraction of the clearance while the apron is
      // still over the plate (relief that outgrew the clearance tore the
      // skirt through the plain in spikes), then broad low hills once clear.
      const relief = 0.3 + 2.6 * Math.min(1, sink * 0.7) * Math.exp(-sink * 0.28);
      // Fine detail is only worth having while the rings are still close
      // enough together to resolve it; further out it would alias into
      // per-vertex jitter and make the distance twinkle instead of settling
      // into the page background.
      const detail = Math.exp(-sink * 0.6);
      const x = centre.x + cos * radius;
      const z = centre.z + sin * radius;
      // The last two terms are near-field detail, kept inside PLAIN_CLEARANCE
      // so they can't tear the skirt through: without them the plain rendered
      // as a smooth radial gradient and read as fog rather than ground.
      const undulation =
        relief * fbm(x * 0.05 + 3.1, z * 0.05 - 7.7, 4) +
        relief * 0.4 * fbm(x * 0.17 - 1.3, z * 0.17 + 5.2, 3) +
        detail * 0.45 * fbm(x * 0.42 + 8.8, z * 0.42 - 2.4, 2) +
        detail * 0.2 * fbm(x * 1.1, z * 1.1, 2);

      // The rim is pinned under the terrain and the surface reaches the plain's
      // level a little way out, so the apron emerges through the flank rather
      // than at its own edge.
      const emerge = THREE.MathUtils.smoothstep(out, 0, 0.12);
      const level = plainLevel + wander - drop + undulation;
      const y = THREE.MathUtils.lerp(Math.min(rimY, level), level, emerge);

      const index = col * rows + row;
      positions[index * 3] = x;
      positions[index * 3 + 1] = y;
      positions[index * 3 + 2] = z;

      // Albedo: the tone of the flank the apron emerges through where it
      // emerges — that match is what stops the join reading as an edge — then
      // settling to darker volcanic ground in ashy and oxidised patches, then
      // fading towards the page background so the apron's own outer edge can't
      // read as an edge either.
      const grain =
        0.5 + 0.9 * (0.5 + 0.5 * fbm(x * 0.075 - 4.4, z * 0.075 + 2.2, 3)) * (0.7 + 0.55 * fbm(x * 0.3, z * 0.3, 2));
      const inland = THREE.MathUtils.smoothstep(out + 0.2 * fbm(x * 0.08 - 12.2, z * 0.08 + 6.6, 2), 0.05, 0.55);
      const oxide = THREE.MathUtils.clamp(0.5 + 0.9 * fbm(x * 0.045 + 17.5, z * 0.045 - 8.8, 3), 0, 1);
      // Fade edge wobbled by 2D noise (not a per-direction constant, which
      // would streak radially) so the fade doesn't read as a halo ring.
      const haze = THREE.MathUtils.smoothstep(
        out + 0.9 * fbm(x * 0.02 + 9.9, z * 0.02 - 3.3, 2) + 0.3 * fbm(x * 0.07 - 5.5, z * 0.07 + 1.1, 2),
        0.3,
        1.45,
      );
      ground.copy(rock).lerp(rust, oxide);
      colour.copy(shore).lerp(ground, inland).multiplyScalar(grain).lerp(horizon, haze);
      colors[index * 3] = colour.r;
      colors[index * 3 + 1] = colour.g;
      colors[index * 3 + 2] = colour.b;

      if (row < rows - 1) {
        const nextCol = (col + 1) % cols;
        const a = col * rows + row;
        const b = col * rows + row + 1;
        const c = nextCol * rows + row + 1;
        const d = nextCol * rows + row;
        // Wound so the face normal is +Y: (radius, angle) order gives a
        // downward normal, which culls the whole apron when it's seen from
        // above — which is every pose this thing exists for.
        indices.push(a, c, b, a, d, c);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Lambert, not Standard: Standard's non-metal specular floor (F0 = 0.04) adds
  // a fixed ~0.008 of linear light regardless of albedo, which put a floor
  // under the far distance about 27/255 above the page background — no albedo
  // could fade the apron out from under it. Diffuse-only lighting makes the
  // rendered colour a clean multiple of the vertex colour, which is what
  // HORIZON_LIGHT_GAIN relies on.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "terrain-apron";
  // The plate hides the rim, not the depth buffer: this is a big, mostly
  // distant surface and it must never be culled early by its own bounds.
  mesh.frustumCulled = false;
  return mesh;
}

/* ------------------------------------------------------------------
   The lava
   ------------------------------------------------------------------ */

const LAVA_RADIAL_SEGMENTS = 128;
const LAVA_RINGS = 26;

export type CraterLava = {
  /** Pool surface plus its additive glow, ready to parent to the model. */
  group: THREE.Group;
  light: THREE.PointLight;
  /** Scene-time animation: molten, not scroll-driven. `seconds` is elapsed. */
  update(seconds: number): void;
};

/**
 * Fills the crater bowl with a molten pool.
 *
 * The pool's level is read off the heightfield rather than chosen: the crater's
 * low point is *found* (the lowest cell within a third of a half-width of the
 * plate's centre), the surface is flooded to a fixed depth above it, and every
 * vertex is either that flood level or a hair above the baked rock — so the
 * pool can neither float over the floor nor sink into it, whatever the bowl's
 * shape. Heat fades out where the rock rises through the surface, which is what
 * gives the pool its irregular shoreline.
 *
 * It's centred on the plate's centre rather than on that low point, because the
 * plate's centre is what the camera's CENTRE keyframe looks at: pinning the pool
 * to the low point (which sits a couple of units off-axis in this bake) pushed
 * the glow to the edge of the frame at the finale, and off the 390-wide frame
 * almost entirely.
 */
export function buildCraterLava(field: Heightfield): CraterLava {
  const { halfWidth, centre } = field;
  const searchRadius = halfWidth * 0.33;

  // Lowest terrain anywhere in the bowl, on a coarse scan of the heightfield.
  let floorY = Infinity;
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const x = centre.x + (i / steps - 0.5) * 2 * searchRadius;
      const z = centre.z + (j / steps - 0.5) * 2 * searchRadius;
      if (Math.hypot(x - centre.x, z - centre.z) > searchRadius) continue;
      floorY = Math.min(floorY, field.heightAt(x, z));
    }
  }

  const floorX = centre.x;
  const floorZ = centre.z;
  const level = floorY + 1.15;
  const radius = halfWidth * 0.34;

  const cols = LAVA_RADIAL_SEGMENTS;
  const rows = LAVA_RINGS;
  const count = cols * rows + 1; // +1 for the centre vertex
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 4);
  const heat = new Float32Array(count);
  const indices: number[] = [];

  const crust = new THREE.Color(0x2c0f06);
  const glow = new THREE.Color(0xff5a12);
  const core = new THREE.Color(0xffc16a);
  const colour = new THREE.Color();

  function write(index: number, x: number, z: number, radial: number) {
    const rock = field.heightAt(x, z);
    const y = Math.max(level, rock + 0.05);
    // Heat: full where the rock is well below the flood level, gone where it
    // stands above it, and tapered to nothing at the pool's outer ring.
    const submerged = THREE.MathUtils.clamp((level + 0.25 - rock) / 1.5, 0, 1);
    const rim = 1 - THREE.MathUtils.smoothstep(radial, 0.5, 1);
    // Two scales of vein: the coarse one breaks the pool into lobes, the fine
    // one into crust with glowing seams. The fine scale is right at the limit
    // of what this mesh's vertex spacing can carry, and the finale keyframe
    // gets close enough to see it.
    const veins =
      (0.6 + 0.5 * (0.5 + 0.5 * fbm(x * 0.55 + 21.7, z * 0.55 - 13.1, 3))) *
      (0.72 + 0.55 * (0.5 + 0.5 * fbm(x * 1.7 - 4.9, z * 1.7 + 9.3, 2)));
    const value = THREE.MathUtils.clamp(submerged * rim * veins, 0, 1);

    heat[index] = value;
    positions[index * 3] = x;
    positions[index * 3 + 1] = y;
    positions[index * 3 + 2] = z;

    colour.copy(crust).lerp(glow, Math.min(1, value * 1.6)).lerp(core, Math.pow(value, 4.5));
    colors[index * 4] = colour.r;
    colors[index * 4 + 1] = colour.g;
    colors[index * 4 + 2] = colour.b;
    colors[index * 4 + 3] = Math.pow(value, 0.65);
  }

  write(0, floorX, floorZ, 0);
  for (let col = 0; col < cols; col++) {
    const theta = (col / cols) * Math.PI * 2;
    for (let row = 0; row < rows; row++) {
      const radial = (row + 1) / rows;
      // Irregular outline: the pool is a puddle, not a disc.
      const wobble = 1 + 0.16 * angularNoise(theta, 3.5, 5.9);
      const r = radius * radial * wobble;
      write(1 + col * rows + row, floorX + Math.cos(theta) * r, floorZ + Math.sin(theta) * r, radial);
    }
  }
  // Same +Y winding as the apron: the pool is only ever looked down into.
  for (let col = 0; col < cols; col++) {
    const nextCol = (col + 1) % cols;
    indices.push(0, 1 + nextCol * rows, 1 + col * rows);
    for (let row = 0; row < rows - 1; row++) {
      const a = 1 + col * rows + row;
      const b = 1 + col * rows + row + 1;
      const c = 1 + nextCol * rows + row + 1;
      const d = 1 + nextCol * rows + row;
      indices.push(a, c, b, a, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Unlit on purpose: lava is its own light source, so the ambient-dominant
  // rig that reveals the bake honestly would only wash it out. Per-vertex
  // alpha fades the pool onto the rock instead of ending on a hard rim.
  const poolMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const pool = new THREE.Mesh(geometry, poolMaterial);
  pool.name = "crater-lava";
  pool.renderOrder = 1;

  // The hot core, additively blended a hair above the surface: this is what
  // pulses, so the pool reads as molten while the scroll is standing still.
  const glowGeometry = geometry.clone();
  const glowPositions = glowGeometry.attributes.position as THREE.BufferAttribute;
  const glowColors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    glowPositions.setY(i, glowPositions.getY(i) + 0.06);
    const value = Math.pow(heat[i], 2.2);
    colour.copy(glow).lerp(core, Math.pow(heat[i], 2.6)).multiplyScalar(value);
    glowColors[i * 3] = colour.r;
    glowColors[i * 3 + 1] = colour.g;
    glowColors[i * 3 + 2] = colour.b;
  }
  glowGeometry.setAttribute("color", new THREE.BufferAttribute(glowColors, 3));
  const glowMaterial = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
  glowMesh.name = "crater-lava-glow";
  glowMesh.renderOrder = 2;

  // Bounce light onto the crater walls, which is most of what sells the pool
  // as a hole full of something hot rather than an orange decal.
  const light = new THREE.PointLight(0xff7326, 90, halfWidth * 1.4, 2);
  light.position.set(floorX, level + 1.1, floorZ);

  const group = new THREE.Group();
  group.name = "crater-lava-group";
  group.add(pool, glowMesh, light);

  const basePoolColour = poolMaterial.color.clone();

  return {
    group,
    light,
    update(seconds: number) {
      // Two out-of-phase sines: a slow swell plus a faster flicker, so the
      // pulse never reads as a single loop.
      const swell = Math.sin(seconds * 0.55);
      const flicker = Math.sin(seconds * 1.9 + 1.7) * Math.sin(seconds * 0.31);
      const pulse = 0.5 + 0.5 * (swell * 0.7 + flicker * 0.3);
      glowMaterial.opacity = 0.26 + 0.32 * pulse;
      poolMaterial.color.copy(basePoolColour).multiplyScalar(0.9 + 0.18 * pulse);
      light.intensity = 70 + 45 * pulse;
    },
  };
}
