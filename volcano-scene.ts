// Scroll-scrubbed 3D volcano for #volcano-scene.
//
// The section is taller than the viewport and its `.volcano-canvas` child is
// pinned with `position: sticky` (see styles.css), so the canvas stays
// full-viewport while the section's extra height scrolls past underneath it.
// That extra height is the scrub track: scroll position through the section is
// normalised to a 0→1 `progress`, and both the model's Y rotation and the
// camera's pose are computed *fresh from that progress every frame* rather
// than accumulated per frame. That's the difference between
// scroll-interactive and scroll-triggered autoplay — scrolling back up runs
// the camera move exactly backwards, and a mid-section reload or an anchor
// jump lands on the pose that scroll position implies.
//
// The camera travels a three-act path, each act a (elevation angle, distance)
// keyframe interpolated with an eased blend (see `poseAt`): it opens close
// and low on the crater rim, rises and pulls back into a wide three-quarter
// establishing shot of the whole cone, then swings up over the rim and dives
// in near-vertical on the crater's centre for the finale, which washes out to
// red and then black as the section hands off. Camera position is built from
// spherical coordinates around the model's centre with a fixed azimuth (the
// camera never leaves the Y–Z plane through that centre) — elevation moves it
// through Y and Z simultaneously, exactly the two axes the shot needs; X stays
// at 0 so the model's own rotation is what supplies lateral motion.
//
// The render loop is gated by the shared IntersectionObserver-driven
// `gatedRaf` from scroll-effects.ts, so the GPU is idle whenever the section
// is off-screen — this is a 150k-triangle model with two 1–2 MB textures and
// is by far the most expensive thing on the page.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import volcanoUrl from "./src/volcano.glb?url";
import { gatedRaf } from "./scroll-effects";
import { buildCraterLava, buildTerrainApron, sampleHeightfield } from "./src/models/volcano-terrain";

/** Full turns of the model across the whole section. */
const TURNS = 2;

// Camera distance is expressed as a multiple of a computed "fit distance" —
// the distance at which the model just fills the frame for the *current*
// aspect ratio and elevation — rather than in absolute world units. Two
// reasons: the glTF arrives with a baked-in ~0.008 scale (a 4040-unit
// Sketchfab export nested inside two scaling parent nodes), and a distance
// that frames the cone at 1920×1080 leaves it a postage stamp at 390×844.
// Fit-relative distances hold the same framing at both.
//
// The path is three keyframes in (elevation angle, distance) space, blended
// with an eased interpolation (`poseAt`):
//   1. OPEN     — close and low on the rim, matching the section's opening
//      shot: the crater fills the frame and the flat skirt of the terrain
//      plate is mostly cropped out.
//   2. AERIAL   — risen and pulled back into a wide establishing shot of the
//      whole cone. Held at a three-quarter elevation rather than a true
//      bird's-eye: at 78° the cone flattened into a map-like overhead plan
//      that read as a contour diagram, losing the profile and the height that
//      make it a volcano. Around 52° the silhouette, the crater rim and the
//      lava in it are all still legible in one frame.
//   3. CENTRE   — swung back up to near-vertical and dived in close on the
//      crater's centre, for the finale. This leg is a bigger elevation swing
//      than it used to be (52° → 85° rather than 78° → 85°), which is the
//      point: the drop into the crater now has a change of angle behind it,
//      not just a change of distance.
// Elevation is degrees above the horizontal plane through the model's centre;
// 0° is dead-on, 90° is straight down (never reached — see `poseAt`).
type PoseKeyframe = { progress: number; elevationDeg: number; distanceWide: number; distanceNarrow: number };

// Landscape frames can take a harder push than portrait ones before they stop
// reading as "a crater" — a 390-wide viewport at the same distance showed
// nothing but a wall of rock, because the narrow frame is already cropping
// hard before any dolly starts. So the tighter keyframes (OPEN, CENTRE) ease
// back on distance as the viewport narrows; AERIAL is a wide enough shot that
// the difference isn't worth carrying.
const POSE_KEYFRAMES: PoseKeyframe[] = [
  { progress: 0, elevationDeg: 28.87, distanceWide: 0.62, distanceNarrow: 0.75 }, // OPEN
  { progress: 0.45, elevationDeg: 52, distanceWide: 1.7, distanceNarrow: 1.7 }, // AERIAL
  { progress: 1, elevationDeg: 85, distanceWide: 0.16, distanceNarrow: 0.22 }, // CENTRE
];
const POSE_ASPECT_RANGE = { narrow: 0.5, wide: 1.6 };

const FOV = 45;

// Framing is solved against the true aspect ratio, except that very narrow
// viewports are framed as if they were square. Honouring 390/844 literally
// would shove the camera far enough back to leave the volcano a thin strip
// across the middle of a tall empty frame; clamping the aspect used for the
// fit lets the flat outer skirt of the terrain plate crop off the sides on
// phones instead. The cone is the subject; its base plate isn't.
const MIN_FIT_ASPECT = 1.0;

/** Pose used for the single static frame under prefers-reduced-motion: the opening shot. */
const REDUCED_MOTION_PROGRESS = 0;

// The section ends by washing the whole frame out — first red, then black —
// so the finale dive into the crater resolves into a deliberate cut rather
// than the volcano simply sliding off the top of the screen while #intro's
// text slides up under it. Two overlapping ramps over the last tenth of the
// scrub track: red gets ~6% of the track to itself before black starts, so
// there's a readable red-dominant beat, and black finishes exactly at
// progress 1 — the moment the pin releases and the section hands off.
//
// These drive `--fade-red` / `--fade-black` on `.volcano-end-fade`, whose two
// pseudo-element layers are the actual colour (see styles.css). Progress is
// the same pure function of scroll position the camera uses, so the wash
// scrubs backwards on scroll-up like everything else here.
const FADE_RED_RANGE = { from: 0.9, to: 0.96 };
const FADE_BLACK_RANGE = { from: 0.94, to: 1 };

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 0 at or below `from`, 1 at or above `to`, smoothly eased in between. */
function ramp(value: number, { from, to }: { from: number; to: number }): number {
  return smoothstep(clamp((value - from) / (to - from), 0, 1));
}

/**
 * Mounts a Three.js canvas into `#volcano-scene .volcano-canvas` and scrubs
 * the model's rotation and the camera's distance from scroll position.
 */
export function initVolcanoScene(): void {
  const found = document.querySelector<HTMLElement>("#volcano-scene");
  const container = found?.querySelector<HTMLElement>(".volcano-canvas");
  if (!found || !container) return;
  const section: HTMLElement = found;

  // Optional on purpose: the wash is decoration over a scene that has to work
  // without it, so a missing element degrades to "no fade" rather than
  // throwing out of the whole scene init and leaving a blank canvas.
  const endFade = found.querySelector<HTMLElement>(".volcano-end-fade");

  // The sticky canvas is laid out by CSS; fall back to the viewport if this
  // runs before the element has a measured box, so the first frame is never
  // rendered at 0×0 (the window `resize` handler corrects it afterwards).
  const measure = (): { width: number; height: number } => ({
    width: container.clientWidth || window.innerWidth,
    height: container.clientHeight || window.innerHeight,
  });

  const { width, height } = measure();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  // Cap DPR at 2: past that the pixel count buys nothing visible on a phone
  // and costs real frame time on a model this heavy.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.domElement.style.display = "block";
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.1, 4000);

  // The model's only material is a baked colour map (`COLORMAP_BAKE`) with a
  // normal map, metalness 0 and (after the swap in the loader callback below)
  // no specular at all — most of its shading is already painted into the
  // albedo. So the lighting here is deliberately ambient-dominant: the
  // ambient term reveals the bake honestly, and a single warm directional key
  // from the upper front-left re-sculpts the large forms and lets the normal
  // map catch on the lava channels without double-shading the bake into mud.
  scene.add(new THREE.AmbientLight(0xffffff, 1.6));
  const key = new THREE.DirectionalLight(0xfff0dd, 3.2);
  key.position.set(-1, 1.5, 1.1);
  scene.add(key);

  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const centre = new THREE.Vector3();
  /** Model bounding-box corners, relative to `centre` (see `fitDistanceFor`). */
  let corners: THREE.Vector3[] = [];
  let model: THREE.Object3D | null = null;

  /**
   * Distance along `dir` at which the whole model just fits the frame, for
   * the current aspect. Recomputed fresh per frame rather than cached,
   * because `dir` itself now changes with scroll progress — cheap enough
   * (eight corners) that this costs nothing measurable.
   *
   * Solved exactly against the bounding-box corners rather than estimated
   * from the box's width and height, because the subject is a wide flat
   * terrain plate seen from a shallow angle: its *near* edge is far closer to
   * the camera than its centre is, and so projects far larger than a
   * size-based estimate predicts. (First attempt used width/height and put
   * the camera about 40% too close — the plate's near edge blew straight past
   * the bottom of the frame.) For a camera at `centre + dir * d` looking at
   * `centre`, a corner `q` (relative to centre) sits at camera-space depth
   * `d - q·dir` with lateral offsets `q·right` and `q·up`, so each corner
   * implies a minimum `d`; the fit is the largest of them.
   */
  function fitDistanceFor(dir: THREE.Vector3): number {
    if (corners.length === 0) return 1;
    const halfV = Math.tan((FOV * Math.PI) / 360);
    const halfH = halfV * Math.max(camera.aspect, MIN_FIT_ASPECT);

    // Camera basis for a lookAt with world up: forward is -dir. Degenerates
    // if dir is exactly vertical, which is why no keyframe reaches 90°.
    const right = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, dir).normalize();
    const up = new THREE.Vector3().crossVectors(dir, right).normalize();

    let required = 0;
    for (const q of corners) {
      const depth = q.dot(dir);
      required = Math.max(
        required,
        depth + Math.abs(q.dot(right)) / halfH,
        depth + Math.abs(q.dot(up)) / halfV,
      );
    }
    return required;
  }

  /** Scroll fraction through the section's scrub track, 0→1. */
  function scrollProgress(): number {
    const rect = section.getBoundingClientRect();
    const track = rect.height - window.innerHeight;
    if (track <= 0) return 0;
    return clamp((0 - rect.top) / track, 0, 1);
  }

  /**
   * Blends `POSE_KEYFRAMES` at `progress` into an (elevation, distance
   * multiplier) pair, easing each segment independently so the camera settles
   * into and out of the AERIAL keyframe rather than passing through it at a
   * constant rate.
   */
  function poseAt(progress: number): { elevationDeg: number; distance: number } {
    const { narrow, wide } = POSE_ASPECT_RANGE;
    const aspectT = clamp((camera.aspect - narrow) / (wide - narrow), 0, 1);

    let i = 0;
    while (i < POSE_KEYFRAMES.length - 2 && progress > POSE_KEYFRAMES[i + 1].progress) i++;
    const a = POSE_KEYFRAMES[i];
    const b = POSE_KEYFRAMES[i + 1];
    const span = b.progress - a.progress;
    const localT = smoothstep(span > 0 ? clamp((progress - a.progress) / span, 0, 1) : 1);

    const aDistance = THREE.MathUtils.lerp(a.distanceNarrow, a.distanceWide, aspectT);
    const bDistance = THREE.MathUtils.lerp(b.distanceNarrow, b.distanceWide, aspectT);
    return {
      elevationDeg: THREE.MathUtils.lerp(a.elevationDeg, b.elevationDeg, localT),
      distance: THREE.MathUtils.lerp(aDistance, bDistance, localT),
    };
  }

  /** Applies a pose that is a pure function of `progress`. */
  function applyProgress(progress: number): void {
    // Before the model guard: the end wash is CSS over the canvas, and it
    // should still resolve to 0 on the frames rendered before the glTF lands.
    if (endFade) {
      endFade.style.setProperty("--fade-red", ramp(progress, FADE_RED_RANGE).toFixed(4));
      endFade.style.setProperty("--fade-black", ramp(progress, FADE_BLACK_RANGE).toFixed(4));
    }
    if (!model) return;
    model.rotation.y = progress * Math.PI * 2 * TURNS;
    const { elevationDeg, distance } = poseAt(progress);
    const rad = THREE.MathUtils.degToRad(elevationDeg);
    const dir = new THREE.Vector3(0, Math.sin(rad), Math.cos(rad));
    camera.position.copy(centre).addScaledVector(dir, distance * fitDistanceFor(dir));
    camera.lookAt(centre);
  }

  function resize(): void {
    const size = measure();
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    renderer.setSize(size.width, size.height);
    if (reducedMotion) {
      applyProgress(REDUCED_MOTION_PROGRESS);
      renderer.render(scene, camera);
    }
  }
  window.addEventListener("resize", resize);

  const loader = new GLTFLoader();
  loader.load(volcanoUrl, (gltf) => {
    model = gltf.scene;

    // Take the specular lobe off the rock, so it reads as matte stone rather
    // than something wet.
    //
    // The obvious knob — roughness — is already spent: `COLORMAP_BAKE` sets
    // `metallicFactor: 0` and omits `roughnessFactor`, which per the glTF spec
    // means 1.0, and there's no roughness map, so the material arrives fully
    // rough already. But roughness 1 on a MeshStandardMaterial doesn't mean
    // *no* specular: a dielectric still keeps an F0 ≈ 0.04 GGX lobe, and at
    // roughness 1 that lobe is spread across the whole lit surface as a broad
    // cool-white film. Against a warm 3.2-intensity key that film is what read
    // as a wet glaze over the crater walls — not a hotspot (nothing in frame
    // clips; the lit rock peaks around 90/255), which is why dimming the light
    // would only have made the volcano darker without making it drier.
    //
    // So the rock is swapped onto a diffuse-only material. With metalness 0,
    // no env map, no roughness/AO map, MeshLambertMaterial is *exactly*
    // MeshStandardMaterial minus that specular term — same BRDF_Lambert for
    // both the direct and the indirect diffuse, same normal-map chunk — so the
    // albedo bake, the lava-channel relief and the light rig all behave as
    // before, and the shader is cheaper on a 150k-triangle model into the
    // bargain. Materials are swapped once per source material, not per mesh,
    // so the three meshes sharing `COLORMAP_BAKE` keep sharing one material.
    //
    // This runs before any generated geometry is parented to `model`, so the
    // apron and the lava keep the materials they were built with.
    const matteRock = new Map<THREE.Material, THREE.MeshLambertMaterial>();
    const toMatte = (material: THREE.Material): THREE.Material => {
      if (!(material instanceof THREE.MeshStandardMaterial)) return material;
      const cached = matteRock.get(material);
      if (cached) return cached;
      const matte = new THREE.MeshLambertMaterial({
        name: material.name,
        color: material.color,
        map: material.map,
        normalMap: material.normalMap,
        // Cloned, not shared: `Material.setValues` copies a Color but assigns
        // a Vector2 by reference, and the source material is disposed below.
        normalScale: material.normalScale.clone(),
        side: material.side,
      });
      matteRock.set(material, matte);
      material.dispose();
      return matte;
    };
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.material = Array.isArray(node.material)
        ? node.material.map(toMatte)
        : toMatte(node.material);
    });

    // Measured once, before any rotation is applied: rotation is about the
    // model's own Y axis, which already passes through the horizontal centre
    // of this export, so the centre stays put as it spins.
    const box = new THREE.Box3().setFromObject(model);
    box.getCenter(centre);
    corners = [box.min, box.max].flatMap((a) =>
      [box.min, box.max].flatMap((b) =>
        [box.min, box.max].map((c) => new THREE.Vector3(a.x, b.y, c.z).sub(centre)),
      ),
    );

    camera.far = box.getBoundingSphere(new THREE.Sphere()).radius * 12;
    camera.updateProjectionMatrix();

    scene.add(model);

    // The apron fades to whatever colour is actually behind the canvas (the
    // renderer is alpha:true and nothing sets scene.background, so that's
    // .volcano-canvas's own background), read from CSS rather than duplicated
    // as a hex literal here — retheme the page and the horizon follows.
    const pageSurface = new THREE.Color();
    try {
      pageSurface.setStyle(getComputedStyle(container).backgroundColor);
    } catch {
      pageSurface.setHex(0x1e1613);
    }

    // Everything below is generated geometry parented to `model`, and it is
    // built *after* the box/corners capture above on purpose: the apron is an
    // order of magnitude wider than the baked plate, so if it were included in
    // the fit the camera would pull back to frame the whole plain and the cone
    // would become a dot. Parenting to `model` (rather than `scene`) keeps it
    // centred and turning with the model as `model.rotation.y` scrubs.
    const field = sampleHeightfield(model);
    model.add(buildTerrainApron(field, { horizon: pageSurface }));
    const lava = buildCraterLava(field);
    model.add(lava.group);

    if (reducedMotion) {
      // Mirrors initParallax's reduced-motion early return: no loop, no
      // scroll-linked motion, just one settled frame of the same scene. The
      // lava is posed once at t = 0 rather than left unpulsed at whatever its
      // material defaults were.
      lava.update(0);
      applyProgress(REDUCED_MOTION_PROGRESS);
      renderer.render(scene, camera);
      return;
    }

    gatedRaf(section, () => {
      // The lava pulse runs on scene time, not scroll: it has to keep looking
      // molten while the reader is holding still. Everything else in here is a
      // pure function of scroll position.
      lava.update(performance.now() / 1000);
      applyProgress(scrollProgress());
      renderer.render(scene, camera);
    });
  });
}
