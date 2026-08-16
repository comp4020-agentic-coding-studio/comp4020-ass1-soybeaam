# Research notes

Shared knowledge base for this project. Written by the `researcher` agent —
check here before spending a web search on something that might already be
answered. Each topic below is self-contained; read the one you need rather
than the whole file.

## Hero design reference: unsection.com lama-lama-creative-agency

**Question:** What are the font choices, colour palette, and content
placement/layout of the "Lama Lama Creative Agency Hero Design" reference
(https://www.unsection.com/section/lama-lama-creative-agency-hero-design), so
its design DNA can be borrowed for a volcano-themed (dark bg, red/orange lava
accent) hero section on this repo's scroll-reveal single-page site?

**Findings:**

unsection.com is a gallery/archive site — the page itself has no live CSS to
inspect, just a captured screenshot of the design plus curator tags: "Dark",
"Large Type", "Image", "Visible Border", category "Hero Section Design",
industry "Agency", and it's flagged "Archived" (i.e. this is a past version of
the real site lamalama.com's hero, which may since have changed — the real
lamalama.com could not be reached from this sandbox, DNS failed on two
attempts, so the screenshot on unsection is the only source used here).
Fetching the actual hero screenshot (`https://unsection.b-cdn.net/Lama%20Lama%20Creative%20Agency%20Hero%20Design.webp`)
and viewing it directly gave a full, clear read of the design:

*Layout* — Full-bleed macro photograph fills the entire viewport as the
background (a warm, sepia/terracotta close-up texture with a single water
droplet — moody, high-detail, not a clean product shot). Content sits in two
zones at the very bottom of the frame, an asymmetric two-column split:
bottom-left holds a small bracketed uppercase eyebrow label ("[ WE ARE LAMA
LAMA ]") directly above a huge, heavy, uppercase three-line display headline
("A CREATIVE DIGITAL AGENCY THAT GOES ALL IN OR NOT AT ALL.") in warm
off-white; bottom-right (same baseline, opposite corner) holds a shorter,
narrower-column supporting paragraph in regular-weight mixed-case type. There
is no CTA button in the hero itself — the closest thing is a pill-shaped "GET
IN TOUCH" button pinned in the top-right corner of the nav, separate from the
headline block, plus a "THIS IS US (+)" expandable label just below it. A thin
full-width off-white divider line sits under the headline/paragraph pair,
with a footer strip below it: left-aligned stats ("20+ DIGITAL FREAKS",
"AMSTERDAM BASED"), a centred bracketed live-clock element with a tiny red
heart icon, and right-aligned social links + language toggle. Top nav is a
centred dark pill/chip containing the logo mark, a centred nav label, and a
hamburger icon — the chip has a visible border/outline (matches the
"Visible Border" tag) and sits on a semi-transparent dark background so it
stays legible over the busy photo without needing a scrim across the whole
image.

*Type system* (three clear tiers, no exact font name extractable since no
CSS was accessible — described by visual character instead):
1. **Display headline** — very heavy weight, uppercase, slightly condensed
   grotesk/sans, tight line-height (lines nearly touch), huge size (occupies
   roughly a third of the viewport width across 3 lines), no letter-spacing
   (tight/tracked-in, typical of big condensed display faces).
2. **Body/supporting text** — regular weight, mixed case, humanist sans,
   noticeably smaller than the headline, set in a narrower column so it wraps
   to ~4 short lines rather than running full-width.
3. **Labels/eyebrows/nav/footer** — small, uppercase, wide letter-spacing,
   often wrapped in brackets (`[ LIKE THIS ]`) or used inside pill chips —
   reads as a technical/monospace-flavoured grotesk, clearly distinct from
   both the headline and body faces. This label tier is used a lot (nav,
   eyebrow, "THIS IS US", footer stats, clock) and does a lot of the work of
   making the page feel structured/technical despite the huge, loose display
   headline.

*Colour palette character* — Not a designed flat palette; the "background
colour" is whatever warm sepia/brown tones the macro photograph itself
contains, and all text runs in a single warm off-white (not pure white) for
both headline and body — high contrast against the darker/mid-tone parts of
the image. UI chrome (nav pill, CTA pill) uses a dark, semi-transparent
brown/black fill so those elements stay readable without a gradient scrim
over the whole hero. There is exactly one saturated accent in the entire
design: a small red heart glyph inside the footer's clock/label — used once,
decoratively, not as a system colour. So character-wise: monochromatic
warm-photographic background + single warm off-white text colour + one tiny
saturated accent used sparingly + dark translucent "chip" backgrounds for
floating UI, rather than a full-bleed gradient scrim.

**Tips / gotchas:**

- Do not copy the reference's literal sepia/brown hues — translate the
  *character*, not the colours: (1) let the volcano photograph itself carry
  the "background colour" rather than layering a flat dark-bg colour over it
  everywhere, (2) use a single warm off-white/cream for headline + body text
  (not pure `#fff`) so it reads as "warm" rather than clinical, (3) treat the
  red/orange lava accent the way this reference treats its red heart — as one
  small, sparingly-used saturated hit (e.g. a live indicator, a bullet, an
  underline on hover) rather than tinting large surfaces, and (4) use small
  dark semi-transparent "chip" backgrounds (nav pill, a small label) for any
  UI element that needs to sit on top of the busiest/brightest part of the
  eruption photo, instead of a full gradient scrim across the entire image —
  it keeps more of the photograph visible.
- Font stack recommendation for this repo's CSS variables: pick (a) a heavy
  condensed/grotesk display font (e.g. Archivo Black, Anton, Bebas Neue, or a
  heavy cut of Inter/Space Grotesk) for the headline set in uppercase with
  tight line-height and no added letter-spacing; (b) a regular-weight
  humanist sans (e.g. Inter, Manrope, system-ui) for body copy, mixed case,
  kept in a narrower measure than full-width; (c) reuse the body font (or a
  monospace like IBM Plex Mono / JetBrains Mono) at a small size with wide
  `letter-spacing` and uppercase for eyebrows/labels/nav — this three-tier
  split is what makes the reference feel designed rather than a font-size
  gradient.
- Layout translation: put the eyebrow + huge headline stacked bottom-left
  over the full-bleed eruption photo, and a shorter supporting paragraph in
  a narrower column bottom-right (or, if a single CTA is wanted, put it near
  the paragraph rather than inside the headline block — the reference keeps
  its only button up in the nav, separate from the headline). At phone width
  this asymmetric two-column bottom layout should collapse to a single
  left-aligned stack (eyebrow, headline, paragraph, then CTA if present, top
  to bottom) with the photo re-cropped/`object-position` adjusted so its
  focal point (the "hot" part of the lava) stays visible behind the shorter
  headline lines instead of behind the paragraph.
- Could not reach the live `lamalama.com` from this sandbox (DNS failure on
  two attempts) and unsection.com itself is a static screenshot archive with
  the entry marked "Archived" — so there's no live CSS/font-name to confirm
  against, and the current live lamalama.com hero may differ from what's
  described here. If exact font names matter, re-check the live site's
  rendered fonts in a real browser before locking them in.

**Sources:**
- [Lama Lama Creative Agency Hero Design — unsection.com](https://www.unsection.com/section/lama-lama-creative-agency-hero-design)
- [Hero screenshot (viewed directly)](https://unsection.b-cdn.net/Lama%20Lama%20Creative%20Agency%20Hero%20Design.webp)
- [Lama Lama — Amsterdam based creative digital agency (live site, unreachable from this sandbox at time of research)](https://lamalama.com/)

## Attribution for `src/volcano.glb` (Sketchfab volcano model)

**Question:** What license is the "volcano" Sketchfab model
(`src/volcano.glb`, used in the scroll-driven 3D volcano section) under, and
what exact attribution text does that license require, since the site
currently shows no attribution for it?

**Findings:**

The model page (https://sketchfab.com/3d-models/volcano-136292fd63fc43a5b446d868fcaa7751)
lists:
- **Title (exact, as displayed):** "volcano" (lowercase, no other qualifier
  in the page heading).
- **Author:** display name "gelmi.com.br", Sketchfab handle/profile
  `@rodrigogelmi` → profile URL `https://sketchfab.com/rodrigogelmi`. The
  profile itself only exposes a Facebook link (https://www.facebook.com/rgelmi)
  as an external link, not a separate gelmi.com.br hyperlink — the author
  appears to have simply set their Sketchfab display name to their domain
  (gelmi.com.br), so that string is the name to display, but there is no
  distinct "linked from profile" URL to gelmi.com.br to cite beyond the
  domain-as-name itself.
- **License:** "CC Attribution" (Sketchfab's label), i.e. **Creative Commons
  Attribution 4.0 International (CC BY 4.0)**. Sketchfab's own "Learn more"
  link on the model page points to
  `http://creativecommons.org/licenses/by/4.0/` (canonical HTTPS form:
  https://creativecommons.org/licenses/by/4.0/).

CC BY 4.0 requires attribution containing, at minimum: title of the work,
author name (with link if available), source/link to the work, and the
license name with a link to it ("TASL" — Title, Author, Source, License).
Sketchfab's own recommended attribution format for CC-licensed models
follows exactly this pattern.

**Recommended exact attribution line(s):**

Plain text:
> "volcano" by gelmi.com.br (https://sketchfab.com/rodrigogelmi) is licensed
> under CC Attribution 4.0 International (https://creativecommons.org/licenses/by/4.0/).
> Source: https://sketchfab.com/3d-models/volcano-136292fd63fc43a5b446d868fcaa7751

As linked HTML (for the implementer to convert into markup, not written here
since this agent doesn't edit site source):
> "[volcano](https://sketchfab.com/3d-models/volcano-136292fd63fc43a5b446d868fcaa7751)"
> by [gelmi.com.br](https://sketchfab.com/rodrigogelmi) is licensed under
> [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/)

**Tips / gotchas:**

- License is **CC BY 4.0** (attribution required, no NonCommercial or
  ShareAlike restriction per Sketchfab's page) — commercial use and
  modification are permitted as long as attribution is given, so this repo
  (course prototype, deployed publicly) is compliant provided the
  attribution above appears somewhere reachable from the deployed page —
  a visible credit line/footer near the volcano section, or a credits/about
  page linked from the site, is the normal way to satisfy this; it doesn't
  strictly have to sit inside the 3D canvas itself.
- Use the canonical HTTPS license URL `https://creativecommons.org/licenses/by/4.0/`
  even though Sketchfab's own in-page link is `http://` (no `s`) — the
  content is identical, https is just the modern canonical form.
- Sketchfab's display name for this author *is* "gelmi.com.br" (they named
  their account after their domain) — there is no separate "author's real
  name" distinct from that string to attribute to, and no confirmed direct
  hyperlink from their profile to `gelmi.com.br` itself (only a Facebook
  link was found on the profile at time of research) — so link the
  author's name to their **Sketchfab profile** (`https://sketchfab.com/rodrigogelmi`),
  not to a bare `gelmi.com.br` URL, since that domain link wasn't verified
  as live/owned-by-them beyond being their display name.
- This agent did not edit any HTML/CSS/TS — whichever agent adds the
  attribution should place it as visible, non-decorative text (not just an
  HTML comment), since CC BY requires attribution be reasonably discoverable
  by a viewer of the work, not merely present in source.

**Sources:**
- [volcano — Sketchfab model page](https://sketchfab.com/3d-models/volcano-136292fd63fc43a5b446d868fcaa7751)
- [rodrigogelmi (gelmi.com.br) — Sketchfab profile](https://sketchfab.com/rodrigogelmi)
- [Creative Commons Attribution 4.0 International — canonical license text](https://creativecommons.org/licenses/by/4.0/)

## Cursor-following effect on vertex3d.asia (for hero lens/ripple redesign)

**Question:** What is the distortion character, cursor-tracking behaviour, and
ripple behaviour of the cursor-following effect on https://www.vertex3d.asia/,
so it can be used as the reference for reworking this repo's own hero
cursor-lens effect (an SVG `feImage`/`feDisplacementMap` radial bulge applied
via CSS `backdrop-filter`, currently minus its `blur()` term which another
agent is removing)?

**Important caveat up front — direct observation was not possible.**
`https://www.vertex3d.asia/` returned **HTTP 403 Forbidden** on every WebFetch
attempt (both `https://www.vertex3d.asia/` and `https://vertex3d.asia/`),
consistent with Cloudflare-style bot protection blocking a headless
fetcher — no raw HTML, inline `<script>`, or CSS could be pulled from the live
page. The Wayback Machine (`web.archive.org`) is also unreachable from this
tool ("Claude Code is unable to fetch from web.archive.org"). So **none of
this entry is a direct code/DOM inspection** — everything below is either (a)
third-party description of the site (Awwwards' own tagging of its featured
interactions, which Awwwards writes editorially, not the site's own docs) or
(b) inferred from general knowledge of how this genre of WebGL cursor-lens
site is normally built. Each claim below is labelled which.

**Findings:**

*What's actually confirmed (from Awwwards, a third party, not vertex3d.asia
itself):* Vertex3D is a WebGL/real-time-3D studio site by Yann Trevelot,
Awwwards Honorable Mention, tagged with GSAP, WebGL, Webflow (CMS), and
Three.js-adjacent "Spatial Web" language. Awwwards' own showcase page for the
site lists several *separate* tagged interaction elements, not one single
"the cursor effect" — this matters because the user's description (a
full-hero radial lens that warps the video/background under the pointer)
doesn't map cleanly onto exactly one of these named entries:
- **"Magnetic Cursor to Glassmorphism UI Reveal"** — tagged `cursor`,
  `micro-interaction`, `hover effect`, `gsap`, `ui design`, `glassmorphism`,
  categorised under "Mouse Interaction." The name and tags read as a
  *button/UI-element* hover pattern (cursor gets magnetically pulled toward a
  target, which then reveals a frosted-glass panel) — i.e. GSAP-driven DOM/CSS
  animation, not necessarily a full-viewport WebGL shader. This is Awwwards'
  own title for the clip, not something scraped from the site's code.
- **"WebGL Particle Physics & Fluid Shaders"** — also categorised under
  "Mouse Interaction," separate entry, separate clip. This name is the closer
  match to what the user is describing (a real distortion field reacting to
  the cursor, over a fluid/particle-like visual) but Awwwards gives no prose
  explaining its mechanics either — just the title and category tag.
- **"Cinematic 3D Environment Transition with Lens Distortion"** — categorised
  under "Transition," not "Mouse Interaction," so this is very likely a
  scene/page-transition effect (camera cut with a lens-distortion wipe), not
  a persistent cursor-follow effect, despite having "Lens Distortion" in its
  name — worth not conflating with the hero cursor effect.

Because Awwwards splits these into separate named/categorised entries rather
than describing one unified "hero cursor lens," **it's not possible to say
with confidence, from the sources reachable here, which single one (if any)
corresponds to the specific effect the user wants to model** — most likely
candidate is "WebGL Particle Physics & Fluid Shaders" given it's the one
actually about a WebGL-driven field effect rather than a UI hover pattern, but
this is a guess, not a confirmed match.

*Distortion character, tracking, ripple — none of these three specific
questions have a directly-sourced answer.* No description found (via
Awwwards, general web search, or the site itself) states outright whether the
effect is a magnifying bulge vs. chromatic aberration vs. pixel-sorting, nor
whether the cursor tracking snaps/lags/springs, nor whether there's a
click/movement-triggered ripple. This is reasoned/inferred below from how
this class of effect ("WebGL cursor lens over a video/image hero," the same
category this repo's own effect sits in) is conventionally built — treat all
of it as **best-guess, not observed**, and cross-check by actually opening the
live site in a real browser (`agent-browser` per this repo's CLAUDE.md) before
committing to it, since that's ground truth this research pass couldn't reach:

1. **Distortion character (inferred):** Sites in this genre (WebGL portfolio/
   agency hero lenses — e.g. the broader "liquid/fluid cursor" and "lens
   distortion hover" genre seen across Codrops-style demos and Awwwards
   "Mouse Interaction" entries) are built one of two ways: (a) a WebGL canvas
   rendering the hero content (video/image) as a texture, with a fragment
   shader doing a **radial UV-displacement / magnification** around the
   cursor (a true optical bulge, same shape as this repo's own `feImage`
   `feDisplacementMap` bulge, just computed per-pixel in a shader instead of
   an SVG filter), or (b) a full fluid/Navier–Stokes-style simulation (the
   Pavel Dobryakov "WebGL Fluid Simulation" lineage many of these sites reuse)
   where cursor movement injects velocity/dye into a simulated fluid field
   that then displaces the texture — this reads visually as more "liquid/
   swirly" than a clean lens bulge, with visible curl/vorticity rather than a
   simple radial falloff. Given Awwwards' "Particle Physics & Fluid Shaders"
   naming for the WebGL mouse-interaction entry, a fluid-simulation-flavoured
   effect (option b) is at least as plausible as a pure lens bulge (option a)
   for that specific piece — i.e. it may look more "liquid/swirling" than
   ours rather than being a straight scaled-up version of the same bulge.
   No chromatic-aberration or pixel-sorting signal was found anywhere in the
   sources reached; if either is present it wasn't surfaced by any
   description found.
**Follow-up: direct headless-Chrome load (partial ground truth).** After the
above was written, a plain WebFetch was retried via a real headless Chrome
instance driven over the DevTools protocol (not the WebFetch tool, which is
still blocked) — this got past Cloudflare and loaded the real page, but the
site itself gates its WebGL experience behind a hardware-acceleration check:
with GPU disabled (required for this headless run) it renders only a "V" logo
and a "HARDWARE ACCELERATION REQUIRED" splash, no canvas, no visible hero
effect. So the cursor lens itself still wasn't directly observed — but the
page's loaded `<script src>` list *was* captured, and confirms real facts the
Awwwards-only pass above couldn't:
- Confirmed libraries: `gsap.min.js` **3.15.0** plus the `ScrollToPlugin`,
  `ScrollTrigger`, `ScrambleTextPlugin`, `InertiaPlugin`, and `Observer`
  plugins (all from `cdn.prod.website-files.com/gsap/3.15.0/`) — this is a
  Webflow site using GSAP's paid/bundled plugin set, not a from-scratch WebGL
  fluid-sim engine and not Three.js loaded as a separate script (no
  `three.js`/`three.min.js` in the script list, though a bundler could still
  inline it — inconclusive either way on Three.js specifically).
- **`InertiaPlugin` is the single most useful confirmed fact for recreating
  the "tracking" feel.** It's GSAP's physics-based "throw with momentum" easing
  primitive — this makes the earlier inferred guess ("lerp/spring toward the
  cursor") concrete: the tracked point most likely has real inertia/momentum
  (it keeps drifting slightly after the cursor stops, decelerating, rather
  than a simple critically-damped lerp that stops the instant the cursor
  does). `Observer` is GSAP's unified pointer/wheel/touch listener, used to
  feed that inertia system cursor deltas cleanly across input types.
- This doesn't resolve the distortion-character question (lens bulge vs.
  fluid-sim) — no canvas ever rendered in this run, so shader code was never
  reachable — but combined with no `three.js` script tag and a from-Webflow
  GSAP toolchain, a from-scratch Navier–Stokes fluid sim (heavier, unusual to
  hand-roll on a marketing site) is now somewhat less likely than a shader- or
  filter-driven lens/ripple effect animated by GSAP, though still not
  confirmed.

**Practical recommendation (unchanged in substance, now on firmer footing):**
for this repo's own effect, the single highest-value, lowest-risk change is
adding **inertia/eased tracking** of the cursor position that drives the SVG
filter's effective centre — instead of setting `--cursor-x`/`--cursor-y` to
the raw pointer position every frame (1:1 snap), lerp/spring toward it each
frame (a simple `pos += (target - pos) * k` is enough to read as "smooth,"
without needing to pull in GSAP as a new dependency) — plus a decaying radial
ripple pulse layered on cursor movement (e.g. briefly boosting the existing
`feDisplacementMap` `scale` with a value that spikes on movement and decays
back down, rather than a literal expanding-ring visual) to read as "ripple"
without requiring a second canvas/shader pipeline. This keeps the existing
lens-bulge character (already the right family per this repo's own working
implementation) and layers in the two traits — inertia and a
movement-triggered pulse — that are now confirmed or well-supported rather
than purely guessed.

2. **Tracking/easing (inferred):** WebGL cursor-lens effects almost never
   snap the distortion centre directly to the raw mouse coordinate every
   frame — direct 1:1 snapping reads as jittery/mechanical on a shader-driven
   effect. The near-universal convention (and the reason GSAP is explicitly
   named in Vertex3D's own tag list) is to **lerp/ease the tracked position
   toward the real cursor position every frame** (e.g. `pos += (mouse - pos) *
   factor`, or GSAP's `quickTo`/`quickSetter` helpers, which are built exactly
   for this "smooth cursor follower" use case), producing a soft, slightly
   trailing feel — not sluggish enough to look laggy, not elastic/bouncy
   enough to overshoot, more a fast, tight "catches up within a few frames"
   ease. That "fast smoothing, no overshoot" character is the most common
   choice in this genre and the safest inference here, but it is an inference
   from convention, not a timing value read off the actual site.
3. **Ripple (inferred):** Two common patterns exist for the "does it ripple"
   question and this research could not determine which (if either) applies
   here: (a) **continuous, velocity-coupled** — the distortion strength/
   radius scales with cursor speed so fast movement produces a visible
   trailing smear/wake, decaying immediately when the cursor stops (typical
   of the fluid-simulation lineage — no discrete "rings"); (b) **discrete,
   event-triggered** — a single expanding ring (or a few concentric rings)
   spawned on click or on movement-start, expanding and fading over roughly
   0.5–1.5s, independent of continued cursor motion (typical of "water drop"
   ripple shaders, e.g. the classic sine-based ripple-shader tutorials).
   Given the Awwwards tag mentions "Particle Physics" specifically (implying
   continuously-simulated particles/fluid rather than discrete triggered
   waves), (a) — continuous, velocity-coupled, no discrete rings — is the
   marginally more likely guess, but this is speculative.

**Tips / gotchas:**

- Treat this whole entry as **weak signal** relative to the rest of
  `RESEARCH.md`: no direct DOM/shader inspection was achieved. Before an
  implementer commits real work to matching vertex3d.asia specifically,
  someone should actually open `https://www.vertex3d.asia/` in a real browser
  (this repo's CLAUDE.md recommends `agent-browser` for exactly this reason —
  "the rendered page is the truth") and eyeball the three questions directly:
  distortion shape, tracking lag, and ripple trigger. A human or a
  browser-capable agent can answer all three in under a minute of moving the
  mouse around the hero; that observation should override every inferred
  claim above.
- If re-attempting fetch-based research later: the 403 looked like bot
  protection (Cloudflare or similar) rather than a one-off network blip, so
  retrying the same plain `WebFetch` call is unlikely to succeed — a
  browser-rendering tool (headless browser, `agent-browser`, or a screenshot/
  DOM-dump tool that executes JS and presents as a real browser) is needed,
  not a second attempt at the same raw HTTP fetch.
- Practical implication for the implementer regardless of which exact variant
  vertex3d.asia turns out to use: this repo's existing approach (SVG
  `feImage`/`feDisplacementMap` bulge via `backdrop-filter`, blur term
  removed) is already a reasonable match for the "lens/bulge" branch of this
  genre (inferred option (a) above) — the highest-leverage change beyond
  removing the blur is almost certainly **adding eased/lerped tracking of the
  cursor position feeding the filter's center coordinate** (rather than
  updating it 1:1 per `mousemove` event) if it isn't already doing that,
  since that smoothing is the one trait essentially every reference site in
  this genre shares and it's cheap to add (a single lerp on the x/y values
  driving the SVG filter's `cx`/`cy`, updated via `requestAnimationFrame`).
  A genuine multi-ring or fluid-simulation ripple is a much larger lift
  (real WebGL/canvas work, not a CSS filter tweak) and — per the "weak
  signal" caveat above — isn't confirmed to be needed until someone verifies
  visually that vertex3d.asia actually has one.

**Sources:**
- [Vertex3D — Awwwards Honorable Mention (showcase/tag listing, editorial third-party description, not the site's own docs)](https://www.awwwards.com/sites/vertex3d)
- [Magnetic Cursor to Glassmorphism UI Reveal from Vertex3D — Awwwards inspiration entry](https://www.awwwards.com/inspiration/magnetic-custom-cursor-physics-vertex3d)
- [Vertex3D — Immersive WebGL Experience Studio (live site — returned HTTP 403 to WebFetch at time of research, not directly inspected)](https://www.vertex3d.asia/)
- General-genre background only (not vertex3d-specific, cited for the
  lens-bulge vs. fluid-simulation distinction used in the inference above):
  [react-fluid-distortion (Pavel Dobryakov fluid shader lineage, React-Three-Fiber port)](https://github.com/whatisjery/react-fluid-distortion)

## Interactive eruption UI references (for a from-scratch canvas/SVG eruption section)

**Question:** For two reference tools — Inverness Design Studio's "Interactive
Volcano Simulator" and URI's "Lavasimulate" — what's the core interaction
model, visual elements, controls/UI, and animation/timing behaviour, so a
from-scratch vanilla TS + Canvas/SVG eruption section can be scoped without
copying either site's code or assets?

**Findings:**

**1. Inverness Design Studio — Interactive Volcano Simulator**
(https://invernessdesignstudio.com/design-tools/interactive-volcano-simulator)
This reads as a small 3D/WebGL toy (mouse instructions say "Drag to rotate •
Scroll to zoom," so it's a real 3D scene, not a flat diagram). Core loop is
**build-then-trigger**: a "Pressure Control" builds a "Magma Pressure" reading
(shown as a 0–100% readout) while the volcano sits in a "Dormant" state
("The volcano is quiet. Magma is deep underground"), then a "Start Eruption"
button fires the eruption once pressure is set; a "Reset" button returns it to
dormant. Three view-mode toggles let the user re-frame the same scene: "🏔️
Surface" (exterior), "🔥 Underground," and "🔬 Cross-Section" — the
cross-section view is explicitly labelled with "Magma Chamber," "Rising
Magma," "Mantle," and "Volcano," i.e. a classic vertical geology diagram
(chamber → conduit → vent) rather than a free-form 3D interior. Marketing copy
separately references simulated pyroclastic flows, ash clouds, and lava paths,
and names three eruption "styles" (Plinian, Strombolian, Hawaiian) as
something the tool can represent, though exact numeric slider ranges
(viscosity, gas %) weren't recoverable from the fetched text — the page is
JS-rendered and a static fetch only surfaces label strings, not slider
min/max values. Net interaction model: **state machine with three phases**
(dormant → pressure-building → erupting), a **discrete trigger button** (not
continuous/hold-to-fire), and a **separate camera/view-mode control** layered
on top of the pressure control, decoupled from it.

**2. URI Lavasimulate** (https://volcano.uri.edu/lava/Lavasimulate/lavasimulate.html)
This is an older academic teaching tool, part of URI's "Kīlauea flow factors"
curriculum module, and reads as a **calculator, not an animation**. Interaction
is **discrete parameter selection, not sliders or hold-to-build**: pick a
"Magma Type" (Basalt / Andesite / Rhyolite — three discrete choices, not a
continuous viscosity slider) and a "Volume Rate" (High / Low — two discrete
choices), which drive two computed readouts ("Magma Viscosity (poise)," e.g.
"1×10^11," and "Volume Rate," e.g. "1000 m³/s"), then click a single "Start
Eruption" button to run the calculation. No cross-section diagram, magma
chamber illustration, ash cloud, or animated lava-flow graphic was found in
the fetched page content — the only image referenced is a real photo
("Helicopter overflight of Kīlauea Volcano's lower East Rift zone"). This
strongly suggests the "simulation" is a physics-formula lookup (viscosity ×
discharge rate → flow distance/speed, per the well-known Jeffreys/Nichols
lava-flow equations that this branch of volcanology teaches) presented as a
text/number result, not a rendered flow animation. Net interaction model:
**pick discrete categorical parameters, hit one button, get a computed
numeric/text result** — no staged timing, no build-up, no visual eruption to
imitate visually; its only transferable idea is *coupling qualitative labels
(rock type, flow rate) to quantitative readouts* so the user sees the
model's driving numbers, not just an animation.

**Tips / gotchas:**

- Neither reference was inspected as a running page (both were read via a
  static-text WebFetch, which renders JS-built DOM strings but can't verify
  actual animation timing, easing curves, or exact slider ranges) — before
  final visual design, someone should open Inverness's simulator directly in
  a browser (it's the one with an actual eruption animation worth watching)
  to check whether the eruption itself has visible **stages** (e.g. tremor →
  ash column → lava fountain → flow) worth timing against, since the fetched
  text only confirms the state labels exist, not their on-screen choreography.
- **Recommended synthesis for this repo's own build** (not implemented by
  this agent — hand off as a suggestion): borrow Inverness's **three-phase
  state machine** (dormant → pressure build → erupt, with an explicit
  Reset) as the interaction skeleton, since it maps cleanly onto a scroll- or
  click-driven Canvas/SVG piece — e.g. a pressure control (slider or
  press-and-hold) fills a meter, an "Erupt" button/scroll-trigger fires a
  canvas particle/path animation (lava fountain + flow down a cross-section
  silhouette), and borrow URI's **numeric-readout-tied-to-a-choice** idea
  (e.g. picking a "magma type" toggle changes a displayed viscosity number
  and visibly changes how sluggish/fast the rendered lava path animates) to
  give the piece a light "simulator" feel without needing real fluid
  simulation math. A vertical cross-section silhouette (chamber → conduit →
  vent → surface, per Inverness's own cross-section labels) is a well-known,
  low-risk diagram shape to draw in SVG/Canvas and would suit the dark
  volcanic palette (near-black `#120d0c` background, lava-orange `#ff4d1c`
  fill animating up the conduit, deep-red `#7a1710` for cooled/older lava or
  shadow tones).
- Both are **reference-for-interaction-concept only** — no code, DOM
  structure, image assets, or copy should be copied from either; the state-
  machine shape and the parameter-to-readout coupling are the only reusable
  ideas, not any specific visual asset or line of text.
- This is a from-scratch-build scoping question with a real design choice
  buried in it (how literal to make the "simulator" framing — e.g. whether
  to expose a fake viscosity number at all, or keep it purely visual) — that
  tradeoff belongs to whoever scopes the interaction-engineer's task, not
  this research entry.

**Sources:**
- [Interactive Volcano Simulator — Inverness Design Studio](https://invernessdesignstudio.com/design-tools/interactive-volcano-simulator)
- [Lavasimulate — Volcano World / URI](https://volcano.uri.edu/lava/Lavasimulate/lavasimulate.html)
- [Volcano @ URI — magma viscosity teaching page (background on the
  viscosity concept URI's simulator is teaching)](https://volcano.uri.edu/lava/MagmaProperties/viscosity.html)

## mysimulator.uk volcanic-eruption sim — reference for particle/glow visual design

**Question:** What does the fire particle system and lighting on
https://www.mysimulator.uk/geology/volcanic-eruption/sim.html actually look
like (particle shape/size/color-over-lifetime, glow/blend technique, whether
the scene is lit by the particles, motion/trajectory, additional layered
effects like smoke/sparks, and the technical rendering approach), so it can
be used as a concrete visual reference for this repo's own canvas-based
eruption particle effect?

**Important caveat up front — this could not be directly observed.** This
agent's only tools are `WebFetch` (fetches a page, converts HTML→markdown,
then runs a small text model over that markdown) and `WebSearch`. Both are
fundamentally text-extraction tools. `sim.html` renders its eruption as a
**WebGL canvas** (see below) — there is no DOM/markdown text describing pixel
colours, blend modes, or particle shapes for a fetch-and-summarise tool to
find, because that content is drawn by JS onto `<canvas>`, not present as
readable markup. Every `WebFetch` attempt against `sim.html` itself returned
only the page's own *marketing/explainer prose* (which describes the
underlying physics model, not the render), never canvas/shader code or a
pixel-level description. No screenshot or browser-rendering tool was
available in this session to look at the actual rendered frame. **Treat
everything below as confirmed-from-text-only** (i.e. what the site's own
copy says about itself) **plus explicitly-labelled inference** — not a
direct visual inspection. Before locking in an implementation, someone with
real browser access (this repo's `agent-browser` per `CLAUDE.md`, or just
opening the page in Chrome) should actually watch the animation for 30
seconds and check colour/glow/motion against what's below.

**Findings (confirmed from the site's own text, via repeated WebFetch/WebSearch):**

- **Rendering stack:** the sibling landing page
  (`https://www.mysimulator.uk/volcanic-eruption/`) tags this simulation as
  **"3D" / "Three.js · WebGL"**, targeting **60 FPS**, fully client-side, no
  install — i.e. this is a **Three.js/WebGL 3D scene**, not a flat 2D canvas
  sprite system, despite a "Canvas 2D" tag also appearing on the page (likely
  describing a UI overlay/readout layer, not the particle rendering itself).
  The wider `mysimulator.uk` site (per its `/about/` page and general search
  results) is built site-wide on **Three.js r160, WebGL 2.0, GLSL shaders,
  and Cannon-es** for physics, loaded via CDN with no build step — so the
  particle glow is most plausibly a **GLSL shader/shader-material effect**
  (additive-blended sprite billboards or a custom fragment shader per
  particle, the standard Three.js way of doing glowing fire/ember particles)
  rather than a 2D-canvas `shadowBlur` trick — but this specific detail
  (which exact Three.js particle technique) was not confirmed, only inferred
  from the stack.
- **Particle types (confirmed, quoted directly from the page's own copy):**
  "A particle system spawns **lava blobs, incandescent pyroclasts and
  drifting ash** from the vent." And: "Particles are drawn as lava,
  pyroclasts or ash **with different gravity and lifespan**." So there are
  explicitly **three distinct particle types**, each with its own physics
  (gravity strength, how long it lives) — this maps directly onto "chunky
  bombs vs. fine ash vs. sparks" from the brief: lava blobs ≈ heavy/ballistic
  chunks, pyroclasts ≈ incandescent (glowing) ejecta, ash ≈ light, drifting,
  presumably lower gravity/longer lifespan and more wind-affected.
- **Physical driver of eruption style (confirmed):** the sim computes
  eruption rate from viscosity, gas content and pressure-build-rate sliders,
  derives column height as a power law of that rate, and an approximate VEI
  (Volcanic Explosivity Index, log10 of eruption rate, clamped 0–8),
  classifying the eruption into named styles — Effusive, Hawaiian,
  Strombolian, Vulcanian, or Plinian. This implies particle **count/spawn
  rate/velocity/column height visibly scale with these slider inputs** rather
  than being a fixed-look animation — i.e. the "explosiveness" of what you
  see is meant to visibly track the numbers, not just be decorative.
- **Explicit self-description of fidelity (confirmed, direct quote):** "the
  particle system is a visual stylisation rather than a true computational
  fluid dynamics solution [of magma ascent]" — the site itself says not to
  read this as physically accurate fluid sim, just a stylised
  representation driven by the simplified equations above.
- **Nothing found, anywhere, in any fetch:** no exact colour values, no
  mention of a glow/bloom/blend technique by name, no mention of smoke as a
  separate layer from "ash," no description of spread/cone angle, apparent
  speed, or how particles die (fade/shrink/fall off) — none of this is
  present in the site's own text copy, and a text-summarising fetch tool has
  no way to read it off pixels.

**Tips / gotchas:**

- A `WebSearch` result surfaced a specific claim — "MIT licence, clone via
  `git clone https://github.com/oleksandr-labs/mysimulator.uk.git`" — that
  looked promising for reading the actual particle/shader source directly.
  **This claim did not check out**: a direct `WebFetch` of
  `github.com/oleksandr-labs/mysimulator.uk` and of a guessed raw file path
  under it both returned **HTTP 404**, and the site's own `/about/` page,
  fetched directly, states the license as **CC BY 4.0** ("Content licensed
  under CC BY 4.0 · Free for educational use," reuse/redistribution allowed
  with credit) and names **no** GitHub org or repo at all. The two sources
  disagree (MIT vs. CC BY 4.0) and the repo URL 404s, so treat the
  "GitHub repo, MIT licence" claim as **likely a search-summary hallucination
  ,not fact** — don't spend more time trying that URL, and if source access
  is wanted, CC BY 4.0 (require attribution) is the license actually stated
  on the site itself, not MIT.
- Because the effect is a live WebGL canvas, the only reliable way to get the
  specifics the engineer actually needs (exact hex/RGB per particle type,
  whether it's additive `lighter` blending vs. a shader bloom pass, cone
  angle, particle die-off style) is to **open the page in a real browser and
  watch it** — this agent's tools can't do that. If another agent/user has
  `agent-browser` or DevTools access, 30–60 seconds of watching
  `sim.html` (and toggling the viscosity/gas/pressure sliders to see a
  Plinian vs. Hawaiian style) would answer every visual question in the
  original brief far better than anything recoverable via text fetch.
- The one genuinely reusable, confirmed idea for the engineer regardless of
  visual specifics: **three particle types with independently-tuned gravity
  and lifespan** (lava blobs = heavy/short arcs, pyroclasts = glowing/
  medium, ash = light/long-lived/drifting) is a good, simple structural
  pattern to copy into this repo's own particle system even without seeing
  the exact pixels — it's explicitly confirmed as the real structure behind
  this reference, not a guess.

**Sources:**
- [Volcanic eruption simulator — sim.html (live WebGL canvas; only its own
  explainer prose was readable by this agent's tools, not the render itself)](https://www.mysimulator.uk/geology/volcanic-eruption/sim.html)
- [Volcanic Eruption Simulator — Magma, Pyroclastics & Lava (landing/explainer
  page, confirms Three.js·WebGL + Canvas 2D tags, 60 FPS target)](https://www.mysimulator.uk/volcanic-eruption/)
- [mysimulator.uk — About (states CC BY 4.0 license site-wide; no GitHub
  repo named here, contradicting a search-summary claim of an MIT-licensed
  GitHub repo which 404s)](https://www.mysimulator.uk/about/)
- [mysimulator.uk — homepage (site-wide stack description: Three.js r160,
  WebGL 2.0, GLSL shaders, Cannon-es, CDN-loaded, no build tools)](https://www.mysimulator.uk/)

**Follow-up: actual screenshot taken (real ground truth, supersedes the
inference above).** `node scripts/shoot.mjs` was pointed directly at
`sim.html` (desktop viewport, 4s settle wait) and the rendered canvas *was*
captured as a normal screenshot — WebGL output rasterizes to pixels like
anything else, so it didn't need DOM/shader access, just a render + capture.
Confirmed from direct visual inspection at default slider settings (Viscosity
Medium, Gas 3.0%, Vulcanian style, VEI 2):

- **Two visually distinct particle populations, not a uniform particle
  system.** (1) Small, bright, glowing **orange/amber embers** — each reads as
  a soft radial-gradient dot: a hot near-white/yellow core fading through
  orange to a dim red-orange edge, with enough overlap between nearby embers
  that dense clusters brighten toward yellow-white (consistent with additive
  `lighter`-style blending, not alpha blending — overlapping glows visibly sum
  rather than just occlude). (2) Larger, **flat grey-brown, semi-transparent
  circles** with no glow at all — these are the ash/pyroclast fraction, clearly
  a separate render path from the embers (bigger, softer-edged, no bright
  core, more muted/desaturated).
- **Shape of the plume:** both populations rise together from the vent in a
  narrow-based, widening cone/fountain — tightest right at the crater, fanning
  out with height — rather than a vertical column or a wide instant burst.
  The glowing embers sit slightly denser/lower in the plume; the grey ash
  circles drift further out and higher, consistent with the site's own text
  claim of different gravity/lifespan per type.
- **Vent itself glows**: a soft orange radial bloom sits right at the crater
  mouth (a concentrated bright core inside a wider dim halo), reading as a
  light source, not just a particle spawn point.
- **Background is near-black**, which is doing real work — it's what makes
  the additive orange glow read as genuinely emissive/bright rather than a
  flat orange sprite; the same colours on a lighter background would look
  much flatter.
- **Practical takeaway for this repo's own canvas particle engine:** render
  at least two particle populations with visibly different treatment — a
  small, bright, radial-gradient glowing type (white/yellow-hot core → orange
  → red edge, additive `globalCompositeOperation = 'lighter'`, this is the
  "ember" ejecta) plus a larger, flatter, non-glowing semi-transparent grey
  type (plain alpha-blended fill, no gradient glow, this is the ash/smoke) —
  don't render everything with the same glow treatment, since the contrast
  between glowing embers and matte ash is a big part of why the reference
  reads as convincing. Keep the canvas background dark/near-black behind the
  particle layer (already true of this repo's dark volcanic palette) so the
  additive glow keeps its punch.

**Additional source:**
- [Screenshot taken directly via `scripts/shoot.mjs` against `sim.html`,
  desktop viewport — the actual visual ground truth this entry was missing]
  (https://www.mysimulator.uk/geology/volcanic-eruption/sim.html)
