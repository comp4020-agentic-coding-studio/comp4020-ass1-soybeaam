import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  applyRevealAction,
  decideRevealAction,
  effectiveDelay,
  expandedViewportRect,
  geometricIntersectionRatio,
  parseRevealConfig,
  parseRootMargin,
  type Rect,
} from "../reveal-engine";

// The reveal system's actual browser wiring (reveal-observer.ts) needs a real
// IntersectionObserver and requestAnimationFrame, which jsdom doesn't provide.
// Everything worth asserting about the *decision* the system makes lives in
// reveal-engine.ts instead, which takes plain Elements/Rects as arguments —
// so it's tested directly here with no browser APIs mocked.

function makeElement(attributes: Record<string, string> = {}): Element {
  const { document } = new JSDOM("<!doctype html><body></body>").window;
  const el = document.createElement("div");
  for (const [key, value] of Object.entries(attributes)) {
    el.setAttribute(key, value);
  }
  return el;
}

describe("parseRevealConfig", () => {
  it("throws when data-animation is missing", () => {
    expect(() => parseRevealConfig(makeElement())).toThrow();
  });

  it("throws when data-animation is not a known animation name", () => {
    expect(() => parseRevealConfig(makeElement({ "data-animation": "spin" }))).toThrow();
  });

  it("fills in defaults when only data-animation is given", () => {
    const config = parseRevealConfig(makeElement({ "data-animation": "fade-up" }));
    expect(config).toEqual({
      animation: "fade-up",
      delay: 0,
      replay: false,
      threshold: 0.15,
      rootMargin: "0px 0px -10% 0px",
    });
  });

  it("reads every attribute when all are present", () => {
    const config = parseRevealConfig(
      makeElement({
        "data-animation": "image-reveal",
        "data-delay": "200",
        "data-replay": "true",
        "data-threshold": "0.4",
        "data-root-margin": "10% 0px",
      }),
    );
    expect(config).toEqual({
      animation: "image-reveal",
      delay: 200,
      replay: true,
      threshold: 0.4,
      rootMargin: "10% 0px",
    });
  });

  it("falls back to defaults for non-numeric delay/threshold rather than NaN", () => {
    const config = parseRevealConfig(
      makeElement({ "data-animation": "scale", "data-delay": "soon", "data-threshold": "lots" }),
    );
    expect(config.delay).toBe(0);
    expect(config.threshold).toBe(0.15);
  });

  it("only treats the literal string \"true\" as replay", () => {
    const config = parseRevealConfig(makeElement({ "data-animation": "fade", "data-replay": "yes" }));
    expect(config.replay).toBe(false);
  });
});

describe("effectiveDelay", () => {
  it("is just the own delay for the first item in a group", () => {
    expect(effectiveDelay(50, 0, 100)).toBe(50);
  });

  it("adds index * stagger for later items", () => {
    expect(effectiveDelay(50, 3, 100)).toBe(350);
  });

  it("is unaffected by stagger when there is no container", () => {
    expect(effectiveDelay(50, 0, 0)).toBe(50);
  });
});

describe("decideRevealAction", () => {
  it("reveals an intersecting element that has never been revealed", () => {
    expect(decideRevealAction(true, false, false)).toBe("reveal");
  });

  it("does nothing to an intersecting element that already revealed and can't replay", () => {
    expect(decideRevealAction(true, true, false)).toBe("none");
  });

  it("does nothing to an intersecting element that already revealed even if it can replay", () => {
    expect(decideRevealAction(true, true, true)).toBe("none");
  });

  it("does nothing to a never-revealed element that has left the viewport", () => {
    expect(decideRevealAction(false, false, false)).toBe("none");
  });

  it("hides a revealed, replayable element once it leaves the viewport", () => {
    expect(decideRevealAction(false, true, true)).toBe("hide");
  });

  it("leaves a revealed, non-replayable element alone once it leaves the viewport", () => {
    expect(decideRevealAction(false, true, false)).toBe("none");
  });
});

describe("applyRevealAction", () => {
  it("adds is-revealed for a reveal action", () => {
    const el = makeElement();
    applyRevealAction(el, "reveal");
    expect(el.classList.contains("is-revealed")).toBe(true);
  });

  it("removes is-revealed for a hide action", () => {
    const el = makeElement();
    el.classList.add("is-revealed");
    applyRevealAction(el, "hide");
    expect(el.classList.contains("is-revealed")).toBe(false);
  });

  it("touches nothing for a none action", () => {
    const el = makeElement();
    applyRevealAction(el, "none");
    expect(el.classList.contains("is-revealed")).toBe(false);
  });
});

describe("geometricIntersectionRatio", () => {
  const root: Rect = { top: 0, left: 0, bottom: 1000, right: 1000, width: 1000, height: 1000 };

  it("is 1 when the target is fully inside the root", () => {
    const target: Rect = { top: 100, left: 100, bottom: 200, right: 200, width: 100, height: 100 };
    expect(geometricIntersectionRatio(target, root)).toBe(1);
  });

  it("is 0 when the target doesn't overlap the root at all", () => {
    const target: Rect = { top: 1100, left: 0, bottom: 1200, right: 100, width: 100, height: 100 };
    expect(geometricIntersectionRatio(target, root)).toBe(0);
  });

  it("is 0.5 when exactly half the target overlaps", () => {
    const target: Rect = { top: 950, left: 0, bottom: 1050, right: 100, width: 100, height: 100 };
    expect(geometricIntersectionRatio(target, root)).toBeCloseTo(0.5);
  });

  it("stays accurate for a target whose own rendered area collapsed via clip-path", () => {
    // This is exactly the image-reveal bug this function exists to avoid:
    // clip-path makes the rendered box tiny, but the *layout* box passed in
    // here is unclipped, so the ratio still reflects real scroll position.
    const target: Rect = { top: 100, left: 100, bottom: 200, right: 200, width: 100, height: 100 };
    expect(geometricIntersectionRatio(target, root)).toBe(1);
  });

  it("is 0 for a zero-area target", () => {
    const target: Rect = { top: 100, left: 100, bottom: 100, right: 100, width: 0, height: 0 };
    expect(geometricIntersectionRatio(target, root)).toBe(0);
  });
});

describe("parseRootMargin", () => {
  it("applies a single value to all four sides", () => {
    expect(parseRootMargin("10px", 1000, 800)).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
  });

  it("resolves percentages against height for top/bottom and width for left/right", () => {
    expect(parseRootMargin("10% 20%", 1000, 800)).toEqual({ top: 80, right: 200, bottom: 80, left: 200 });
  });

  it("supports the full top/right/bottom/left shorthand", () => {
    expect(parseRootMargin("1px 2px 3px 4px", 1000, 800)).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
  });

  it("supports negative margins", () => {
    expect(parseRootMargin("-10% 0px", 1000, 800)).toEqual({ top: -80, right: 0, bottom: -80, left: 0 });
  });
});

describe("expandedViewportRect", () => {
  it("returns the plain viewport for zero margin", () => {
    const rect = expandedViewportRect("0px", 1000, 800);
    // Zero margin negates to -0 rather than 0, which is numerically equal
    // but fails strict object-identity assertions — compare values, not sign.
    expect(rect.top).toBeCloseTo(0);
    expect(rect.left).toBeCloseTo(0);
    expect(rect.bottom).toBe(800);
    expect(rect.right).toBe(1000);
    expect(rect.width).toBe(1000);
    expect(rect.height).toBe(800);
  });

  it("shrinks the rect for a negative margin", () => {
    const rect = expandedViewportRect("0px 0px -10% 0px", 1000, 800);
    expect(rect.bottom).toBe(720);
    expect(rect.top).toBeCloseTo(0);
  });

  it("grows the rect for a positive margin", () => {
    const rect = expandedViewportRect("25% 0px", 1000, 800);
    expect(rect.top).toBe(-200);
    expect(rect.bottom).toBe(1000);
  });
});
