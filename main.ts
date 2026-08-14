import { initParallax, initTimelineProgress } from "./scroll-effects";
import { initScrollReveal } from "./reveal-observer";
import { initVolcanoScene } from "./volcano-scene";
import { initHeroCursorGlass } from "./hero-cursor-glass";

/**
 * Slows the hero background video to a clearly ambient pace. It's stock
 * footage, not an authored seamless loop, so playing it at real speed both
 * reads as generic b-roll and makes its loop cut more noticeable; slowing it
 * down helps both problems at once.
 */
function initHeroVideoPlaybackRate(): void {
  const video = document.querySelector<HTMLVideoElement>("#hero .hero-visual video");
  if (!video) return;
  video.playbackRate = 0.35;
}

// The module script tag sits at the end of <body>, so the DOM is already
// parsed by the time this runs — no need to wait for DOMContentLoaded.
initScrollReveal();
initTimelineProgress();
initParallax();
initVolcanoScene();
initHeroVideoPlaybackRate();
initHeroCursorGlass();
