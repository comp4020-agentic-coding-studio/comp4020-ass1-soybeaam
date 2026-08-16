# Process overview

## What I built

This project is an interactive explainer, built for Assignment 1, about how **volcanic explosivity** affects the size and magnitude of an eruption. The site lets users explore different levels of volcanic activity and see how changes in explosivity shift the scale, intensity, and effects of an eruption.

## The moments that mattered

Key commits so far:

- Hero cursor lens (tracking, SVG `feDisplacementMap`-based distortion that
  follows the pointer):
  [`7a1bc23`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-soybeaam/commit/7a1bc231277cbcf667d2df57fcfda51dbfcdc86e)

  I wanted a cursor-following pointer that also distorted the shape around it. Claude initially built a frosted-glass effect instead, so I tried longer, more detailed prompts plus a reference link — which wasted tokens without improving the result. Changing my terminology instead of adding detail worked: reloading the zoomed-in session showed Claude had corrected the interaction. This taught me that redescribing a problem beats repeating it with more detail.

- Three-act bird's-eye camera path for the volcano scene:
  [`344ea58`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-soybeaam/commit/344ea58fa68de606983a1d238ecf91d03d93708f),
  [`7a1bc23`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-soybeaam/commit/7a1bc231277cbcf667d2df57fcfda51dbfcdc86e)

  I wanted a 3D scene where the volcano transitions into the next section. I prompted Claude for a bird's-eye view before zooming in, but the camera sat far too high, and several more prompts didn't fix it. Applying the same lesson — redescribe rather than repeat — I scrapped the bird's-eye framing entirely and specified its removal, so the crater reads as a bowl with visible depth instead of a flattened contour map. Removing detail, rather than adding more, is what fixed it. The same fix exposed the model's square-edged baked plate at the wider angle, so I also asked Claude for a ground plane to hide it — it built `buildTerrainApron()`, a procedural annulus of terrain that extends past the plate's edge and fades into the page background.

- Eruption-simulation spec (researched Inverness Design Studio's and URI's
  Lavasimulate's interaction models before scoping `eruption-sim.ts` from
  scratch):
  [`9a2436c`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-soybeaam/commit/9a2436cc18e8a1105d427ac50ed1317275938a3e)
  [`972abb6`]

  I initially tried to recreate the eruption panel from an image and website reference. Claude struggled to reproduce it, and asking it to keep the working parts while fixing others just triggered full rewrites of the component. Instead of re-prompting the same implementation, I pulled up a new session and prompted from empty context from the web AI. I knew it was working once the new implementation let me make targeted changes without the rest being rewritten — much more control over the final result.

- Subagent scopes created (CLAUDE.md gains a Subagents section defining
  `html-writer`, `css-stylist`, `style-refactorer`, `interaction-engineer`,
  `three-d-engineer`, and `researcher`):
  [`0f7be92`](https://github.com/comp4020-agentic-coding-studio/comp4020-ass1-soybeaam/commit/0f7be924d1460f3d1171c56aec0a9f8c9162b2ab)

  Web scraping in particular kept hitting blockers and silently retrying, burning tokens without it being obvious anything was stuck. I created a dedicated researcher agent to scrape once and save its findings to a file, so other agents could read that instead of re-fetching it, and added a rule to `CLAUDE.md` to stop processes once the token budget dropped below a threshold. I knew it worked once the other agents could fan out and finish their tasks without getting stuck re-researching the same ground.
