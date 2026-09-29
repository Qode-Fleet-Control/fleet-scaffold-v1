// Visit SPA routes in headless Chromium and report JS errors, 5xx responses,
// request storms (same endpoint hit >50 times on one page) and 404s.
// usage (run from a dir where @playwright/test resolves, e.g. apps/web):
//   node crawl_pages.mjs <base-url> [route ...]
//   node crawl_pages.mjs <base-url> --from <path/to/App.tsx>   # routes without :params
// 401/403 are listed but expected for pages that need a demo persona first.
import { chromium } from "@playwright/test";
import fs from "node:fs";
const [base, ...rest] = process.argv.slice(2);
let routes = rest;
if (rest[0] === "--from") {
  const src = fs.readFileSync(rest[1], "utf8");
  routes = [...new Set([...src.matchAll(/<Route\s+path=["']([^"']+)["']/g)].map((m) => m[1]).filter((r) => !r.includes(":")))];
  if (!routes.includes("/")) routes.unshift("/");
}
const browser = await chromium.launch();
const page = await browser.newPage();
const issues = []; let cur = ""; let counts = {};
page.on("pageerror", (e) => issues.push([cur, "pageerror", e.message.slice(0, 200)]));
page.on("request", (r) => { const k = r.method() + " " + new URL(r.url()).pathname; counts[k] = (counts[k] ?? 0) + 1; });
page.on("response", (r) => {
  const s = r.status(); const u = r.url();
  if (s >= 500 || s === 429) issues.push([cur, `HTTP ${s}`, u]);
  else if (s === 404 && !u.includes("fonts.g")) issues.push([cur, "HTTP 404", u]);
  else if (s === 401 || s === 403) issues.push([cur, `auth ${s} (expected without persona)`, new URL(u).pathname]);
});
for (const route of routes) {
  cur = route; counts = {};
  await page.goto(base.replace(/\/$/, "") + route, { waitUntil: "networkidle", timeout: 45000 }).catch((e) => issues.push([route, "nav", e.message.slice(0, 120)]));
  const text = (await page.locator("#root").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  const storm = Object.entries(counts).filter(([, n]) => n > 50);
  for (const [k, n] of storm) issues.push([route, "REQUEST STORM", `${k} x${n}`]);
  console.log(`${route.padEnd(40)} ${String(text.length).padStart(6)} chars | ${text.slice(0, 60)}`);
}
const real = issues.filter((i) => !i[1].startsWith("auth"));
console.log(`\nREAL ISSUES: ${real.length}   (auth 401/403: ${issues.length - real.length})`);
for (const i of real.slice(0, 40)) console.log("  " + i.join(" | "));
await browser.close();
process.exit(real.length ? 1 : 0);
