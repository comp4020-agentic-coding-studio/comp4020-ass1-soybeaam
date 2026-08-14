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
