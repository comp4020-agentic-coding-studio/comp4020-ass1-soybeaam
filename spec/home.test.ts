import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { ANIMATIONS } from "../reveal-engine";

// Page-specific structural contract for the scroll-reveal home page, built
// against dist/index.html the same way spec/invariants.test.ts is. The
// generic one-<h1>/one-<nav> invariants live there; this file only checks
// what's specific to this page's six-section scroll-reveal structure.
const doc = new JSDOM(readFileSync(resolve("dist/index.html"), "utf8")).window.document;

const SECTION_IDS = ["hero", "intro", "features", "showcase", "process", "cta"];

describe("home page sections", () => {
  for (const id of SECTION_IDS) {
    it(`has exactly one #${id} section`, () => {
      expect(doc.querySelectorAll(`#${id}`).length).toBe(1);
    });
  }

  it("navigates to every section from the primary nav", () => {
    const hrefs = Array.from(doc.querySelectorAll("nav a")).map((a) => a.getAttribute("href"));
    for (const id of SECTION_IDS) {
      expect(hrefs).toContain(`#${id}`);
    }
  });
});

describe("home page reveal contract", () => {
  it("gives every [data-animation] element a recognised animation name", () => {
    const elements = doc.querySelectorAll("[data-animation]");
    expect(elements.length).toBeGreaterThan(0);
    for (const el of elements) {
      expect(ANIMATIONS).toContain(el.getAttribute("data-animation"));
    }
  });

  it("gives the hero its sequential-entrance stagger container", () => {
    const hero = doc.querySelector("#hero");
    expect(hero?.hasAttribute("data-stagger")).toBe(true);
  });

  it("gives the hero a working primary CTA", () => {
    const cta = doc.querySelector("#hero a.cta-button");
    expect(cta?.getAttribute("href")).toBeTruthy();
  });

  it("gives the final CTA section a working call to action", () => {
    const cta = doc.querySelector("#cta a.cta-button");
    expect(cta?.getAttribute("href")).toBeTruthy();
  });
});

describe("home page timeline progress line", () => {
  it("has a fill element for scroll-driven progress", () => {
    expect(doc.querySelector("#process .timeline-line-fill")).toBeTruthy();
  });

  it("has at least two timeline items for the line to connect", () => {
    expect(doc.querySelectorAll("#process .timeline-item").length).toBeGreaterThanOrEqual(2);
  });
});
