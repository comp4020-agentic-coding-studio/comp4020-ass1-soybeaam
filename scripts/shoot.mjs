#!/usr/bin/env node
// Dual-viewport screenshot + console-error capture for manually verifying
// this site's scroll/animation behavior, since a type-check can't see any
// of that. Requires the dev server already running (pnpm dev) and
// `playwright` installed (a devDependency of this repo — see package.json).
//
// Usage:
//   node scripts/shoot.mjs <url> [options]
//
// Options:
//   --out=<dir>          output directory for PNGs (default: .tmp/shots)
//   --name=<label>        base filename, without extension (default: derived from url)
//   --selector=<css>       screenshot just this element instead of the full page
//   --viewport=desktop|phone|both   (default: both) — desktop=1920x1080, phone=390x844
//   --scroll-into=<css>     scroll this selector into view before shooting
//   --wait=<ms>            extra wait after load/scroll before capturing (default: 300)
//
// Always prints any console errors/warnings and page-load errors seen during
// the visit, since a silently broken page (a runtime exception with a still
// styled empty screen) is exactly the kind of thing a screenshot alone won't
// surface.
//
// This script is read-only: it never edits site source. It's the shared
// tool behind the debug-agent (.claude/agents/debug-agent.md) and available
// to any other agent that needs to see the rendered page as ground truth.

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const VIEWPORTS = {
  desktop: { width: 1920, height: 1080 },
  phone: { width: 390, height: 844 },
};

function parseArgs(argv) {
  const url = argv[0];
  const opts = { out: ".tmp/shots", viewport: "both", wait: 300 };
  for (const arg of argv.slice(1)) {
    const m = arg.match(/^--([a-z-]+)=(.*)$/);
    if (m) opts[m[1]] = m[2];
  }
  return { url, opts };
}

async function shootOne(browser, url, opts, viewportName) {
  const context = await browser.newContext({ viewport: VIEWPORTS[viewportName] });
  const page = await context.newPage();

  const consoleIssues = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      consoleIssues.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    consoleIssues.push(`[pageerror] ${err.message}`);
  });

  await page.goto(url, { waitUntil: "networkidle" });

  if (opts["scroll-into"]) {
    await page.locator(opts["scroll-into"]).scrollIntoViewIfNeeded();
  }

  await page.waitForTimeout(Number(opts.wait));

  await mkdir(opts.out, { recursive: true });
  const name = opts.name ?? (new URL(url).pathname.replace(/\W+/g, "_") || "index");
  const file = `${opts.out}/${name}_${viewportName}.png`;

  if (opts.selector) {
    await page.locator(opts.selector).screenshot({ path: file });
  } else {
    await page.screenshot({ path: file, fullPage: true });
  }

  await context.close();
  return { file, consoleIssues };
}

async function main() {
  const { url, opts } = parseArgs(process.argv.slice(2));
  if (!url) {
    console.error("Usage: node scripts/shoot.mjs <url> [--out=dir] [--selector=css] [--viewport=desktop|phone|both]");
    process.exit(1);
  }

  const viewports = opts.viewport === "both" ? ["desktop", "phone"] : [opts.viewport];
  const browser = await chromium.launch();

  try {
    for (const vp of viewports) {
      const { file, consoleIssues } = await shootOne(browser, url, opts, vp);
      console.log(`Saved ${file}`);
      if (consoleIssues.length) {
        console.log(`  Console issues (${vp}):`);
        for (const line of consoleIssues) console.log(`    ${line}`);
      } else {
        console.log(`  No console errors/warnings (${vp}).`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
