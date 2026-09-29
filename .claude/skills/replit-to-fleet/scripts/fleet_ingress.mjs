// Emulates fleet-control web/nginx.conf rules for embedded apps:
//  location ~ ^/direct/<id>:<port>(/.*)?$  -> proxy_pass http://<id>:<port> (FULL URI, prefix intact)
//  map $http_referer ~^https?://[^/]+/direct/<id>:<port>/ -> other paths rerouted to that app unchanged
// <id> resolves to 127.0.0.1 here (docker DNS in the fleet).
import http from "node:http";
const listen = Number(process.argv[2]);
const log = [];
http.createServer((req, res) => {
  let port = null;
  const m = req.url.match(/^\/direct\/([a-zA-Z0-9-]+):(\d+)(\/.*)?$/);
  if (m) port = m[2];
  else {
    const r = (req.headers.referer || "").match(/^https?:\/\/[^/]+\/direct\/([a-zA-Z0-9-]+):(\d+)\//);
    if (r) port = r[2];
  }
  if (!port) { res.writeHead(404); res.end("fleet dashboard (not the app)"); console.log("DASHBOARD", req.url); return; }
  const up = http.request({ host: "127.0.0.1", port, path: req.url, method: req.method, headers: req.headers }, (u) => {
    res.writeHead(u.statusCode, u.headers); u.pipe(res);
  });
  up.on("error", (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(up);
}).listen(listen, () => console.log("ingress on", listen));
