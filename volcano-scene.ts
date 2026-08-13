// Scroll-scrubbed 3D volcano for #volcano-scene.
//
// The section is taller than the viewport and its `.volcano-canvas` child is
// pinned with `position: sticky` (see styles.css), so the canvas stays
// full-viewport while the section's extra height scrolls past underneath it.
// That extra height is the scrub track: scroll position through the section is
// normalised to a 0→1 `progress`, and both the model's Y rotation and the
// camera's distance from the model are computed *fresh from that progress
// every frame* rather than accumulated per frame. That's the difference
// between scroll-interactive and scroll-triggered autoplay — scrolling back up
// runs the rotation and the dolly exactly backwards, and a mid-section reload
// or an anchor jump lands on the pose that scroll position implies.
//
// The render loop is gated by the shared IntersectionObserver-driven
// `gatedRaf` from scroll-effects.ts, so the GPU is idle whenever the section
// is off-screen — this is a 150k-triangle model with two 1–2 MB textures and
// is by far the most expensive thing on the page.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import volcanoUrl from "./src/volcano.glb?url";
import { gatedRaf } from "./scroll-effects";

/** Full turns of the model across the whole section. */
const TURNS = 2;

// Camera distance is expressed as a multiple of a computed "fit distance" —
// the distance at which the model just fills the frame for the *current*
// aspect ratio — rather than in absolute world units. Two reasons: the glTF
// arrives with a baked-in ~0.008 scale (a 4040-unit Sketchfab export nested
// inside two scaling parent nodes), and a distance that frames the cone at
// 1920×1080 leaves it a postage stamp at 390×844. Fit-relative distances
// hold the same framing at both.
const START_DISTANCE = 1.0; // whole model in frame, nothing cropped

// How far in the dolly pushes, as a fraction of the fit distance. A landscape
// frame can take a hard push — at 0.42 the crater mouth fills a 16:9 frame and
// still reads as a crater. A portrait frame can't: the same distance on a
// 390-wide viewport showed nothing but a wall of rock, because the narrow
// frame is already cropping hard before the dolly starts. So the end distance
// eases back as the viewport gets narrower.
const END_DISTANCE_WIDE = 0.42;
const END_DISTANCE_NARROW = 0.62;
const END_DISTANCE_ASPECT_RANGE = { narrow: 0.5, wide: 1.6 };

const FOV = 45;

// Framing is solved against the true aspect ratio, except that very narrow
// viewports are framed as if they were square. Honouring 390/844 literally
// would shove the camera far enough back to leave the volcano a thin strip
// across the middle of a tall empty frame; clamping the aspect used for the
// fit lets the flat outer skirt of the terrain plate crop off the sides on
// phones instead. The cone is the subject; its base plate isn't.
const MIN_FIT_ASPECT = 1.0;

/**
 * Direction from the model centre to the camera: dead-on in Z, lifted about
 * 29°. Lower (the first pass used ~19°) and the terrain plate collapses to a
 * thin band across the frame and you can't see into the crater; much higher
 * and it reads as a flat disc rather than a cone.
 */
const VIEW_DIRECTION = new THREE.Vector3(0, 0.55, 1).normalize();

/** Pose used for the single static frame under prefers-reduced-motion. */
const REDUCED_MOTION_PROGRESS = 0.3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  // normal map, metalness 0 — most of its shading is already painted into the
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
  /** Model bounding-box corners, relative to `centre` (see `computeFit`). */
  let corners: THREE.Vector3[] = [];
  let fitDistance = 1;
  let endDistance = END_DISTANCE_WIDE;
  let model: THREE.Object3D | null = null;

  /**
   * Distance along `VIEW_DIRECTION` at which the whole model just fits the
   * frame, for the current aspect.
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
  function computeFit(): void {
    if (corners.length === 0) return;
    const halfV = Math.tan((FOV * Math.PI) / 360);
    const halfH = halfV * Math.max(camera.aspect, MIN_FIT_ASPECT);

    // Camera basis for a lookAt with world up: forward is -VIEW_DIRECTION.
    const right = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, VIEW_DIRECTION).normalize();
    const up = new THREE.Vector3().crossVectors(VIEW_DIRECTION, right).normalize();

    let required = 0;
    for (const q of corners) {
      const depth = q.dot(VIEW_DIRECTION);
      required = Math.max(
        required,
        depth + Math.abs(q.dot(right)) / halfH,
        depth + Math.abs(q.dot(up)) / halfV,
      );
    }
    fitDistance = required;

    const { narrow, wide } = END_DISTANCE_ASPECT_RANGE;
    const t = clamp((camera.aspect - narrow) / (wide - narrow), 0, 1);
    endDistance = THREE.MathUtils.lerp(END_DISTANCE_NARROW, END_DISTANCE_WIDE, t);
  }

  /** Scroll fraction through the section's scrub track, 0→1. */
  function scrollProgress(): number {
    const rect = section.getBoundingClientRect();
    const track = rect.height - window.innerHeight;
    if (track <= 0) return 0;
    return clamp((0 - rect.top) / track, 0, 1);
  }

  /** Applies a pose that is a pure function of `progress`. */
  function applyProgress(progress: number): void {
    if (!model) return;
    model.rotation.y = progress * Math.PI * 2 * TURNS;
    const distance = THREE.MathUtils.lerp(START_DISTANCE, endDistance, progress) * fitDistance;
    camera.position.copy(centre).addScaledVector(VIEW_DIRECTION, distance);
    camera.lookAt(centre);
  }

  function resize(): void {
    const size = measure();
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    computeFit();
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
    computeFit();

    camera.far = box.getBoundingSphere(new THREE.Sphere()).radius * 12;
    camera.updateProjectionMatrix();

    scene.add(model);

    if (reducedMotion) {
      // Mirrors initParallax's reduced-motion early return: no loop, no
      // scroll-linked motion, just one settled frame of the same scene.
      applyProgress(REDUCED_MOTION_PROGRESS);
      renderer.render(scene, camera);
      return;
    }

    gatedRaf(section, () => {
      applyProgress(scrollProgress());
      renderer.render(scene, camera);
    });
  });
}
