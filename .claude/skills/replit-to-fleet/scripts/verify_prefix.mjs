// Drive the app through fleet_ingress.mjs under /direct/<id>:<port>/ the way the
// fleet's "run app" preview serves it, and check that routes, assets, in-app
// navigation and API calls all stay under the prefix.
// usage (from apps/web): node verify_prefix.mjs <ingress-url> <id> <app-port> [route ...]
//   e.g. node verify_prefix.mjs http://localhost:8088 agent1 5098 / /demos
import { chromium } from "@playwright/test";
const [ingress, id, port, ...routes] = process.argv.slice(2);
const base = `${ingress}/direct/${id}:${port}`;
const b = await chromium.launch(); const page = await b.newPage();
const bad = []; let cur = ""; const apiForms = new Set();
page.on("pageerror", (e) => bad.push([cur, "pageerror", e.message.slice(0, 150)]));
page.on("response", (r) => { const s = r.status(); const u = r.url().replace(ingress, "");
  if (s >= 500 || (s === 404 && !u.includes("fonts.g"))) bad.push([cur, `HTTP ${s}`, u]); });
page.on("request", (r) => { const u = new URL(r.url()); if (u.pathname.includes("/api/")) apiForms.add(u.pathname.startsWith("/direct/") ? "prefixed" : "root-absolute(Referer-routed)"); });
for (const route of routes.length ? routes : ["/"]) {
  cur = route;
  await page.goto(base + route, { waitUntil: "networkidle", timeout: 45000 });
  const txt = (await page.locator("#root").innerText()).replace(/\s+/g, " ");
  console.log(`${route.padEnd(28)} url=${page.url().replace(ingress, "").padEnd(48)} chars=${txt.length} notFound=${/not found|404/i.test(txt)}`);
}
cur = "nav-click";
await page.goto(base + "/", { waitUntil: "networkidle" });
const hrefs = await page.locator("a[href]").evaluateAll((as) => as.map((a) => a.getAttribute("href")).filter((h) => h && h.startsWith("/")));
console.log("in-app links under prefix:", hrefs.filter((h) => h.startsWith(`/direct/${id}:${port}`)).length, "/", hrefs.length);
console.log("API request forms seen:", [...apiForms].join(", ") || "none");
console.log("ISSUES:", bad.length); for (const x of bad.slice(0, 20)) console.log("  " + x.join(" | "));
await b.close();
process.exit(bad.length ? 1 : 0);
