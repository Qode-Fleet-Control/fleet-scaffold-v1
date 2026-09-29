#!/usr/bin/env python3
"""Boot an app EXACTLY the way Fleet Control's QA tester does (backend tester.py):
source fleet.conf in bash to read INSTALL/BUILD/START_CMD + HEALTH_PATH, run each
through /bin/sh from the repo root, inject PORT/HOST/TEST_BASE_URL/DATABASE_URL
and BASE_PATH="", start in its own session, poll HEALTH_PATH for up to 180s, then
killpg the whole group and confirm the port is free.

usage: sim_fleet_tester.py <clean-checkout> <port> <DATABASE_URL> [app-env-file]
  app-env-file: KEY=VALUE lines standing in for the workspace App .env
                (e.g. the .npmrc token variable, SESSION_SECRET, NODE_ENV).
Use a CLEAN clone of the commit you intend to push and a FRESH, empty database."""
import os, signal, subprocess, sys, time, urllib.request

W, port, dburl = sys.argv[1], sys.argv[2], sys.argv[3]
app_env = {}
if len(sys.argv) > 4:
    for line in open(sys.argv[4]):
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1); app_env[k] = v.strip().strip('"').strip("'")
keys = ["INSTALL_CMD", "BUILD_CMD", "START_CMD", "HEALTH_PATH"]
script = '. "$1" >/dev/null 2>&1; printf "%s\\0" ' + " ".join(f'"${k}"' for k in keys)
out = subprocess.run(["bash", "-c", script, "_", os.path.join(W, "fleet.conf")], capture_output=True, text=True)
man = dict(zip(keys, out.stdout.split("\0")))
print("manifest:", man, flush=True)
env = {k: v for k, v in os.environ.items() if k not in ("NODE_ENV", "DATABASE_URL", "PORT", "FLEET_ROOT", "BASE_PATH", "GITHUB_TOKEN")}
env.update(app_env)
env.update({"PORT": port, "HOST": "0.0.0.0", "TEST_BASE_URL": f"http://localhost:{port}", "DATABASE_URL": dburl})
env.setdefault("BASE_PATH", "")
for label in ("INSTALL_CMD", "BUILD_CMD"):
    if not man.get(label): print(f"{label}: (empty - skipped)"); continue
    t = time.time()
    r = subprocess.run(man[label], shell=True, cwd=W, env=env, capture_output=True, text=True)
    print(f"{label}: exit {r.returncode} in {time.time()-t:.0f}s", flush=True)
    if r.returncode:
        print(r.stdout[-2000:], r.stderr[-2000:]); sys.exit(1)
logp = os.path.join(W, "app-server.log")
p = subprocess.Popen(man["START_CMD"], shell=True, cwd=W, env=env, stdout=open(logp, "wb"),
                     stderr=subprocess.STDOUT, start_new_session=True)
url = f"http://localhost:{port}{man.get('HEALTH_PATH') or '/'}"
t, ok = time.time(), False
while time.time() - t < 180:
    try:
        with urllib.request.urlopen(url, timeout=2) as r:
            if r.status == 200: ok = True; break
    except Exception: pass
    if p.poll() is not None: break
    time.sleep(1)
print(f"READY={ok} after {time.time()-t:.1f}s at {url}", flush=True)
if ok:
    for path in ["/", "/api/health", "/api/healthz"]:
        try:
            with urllib.request.urlopen(f"http://localhost:{port}{path}", timeout=5) as r:
                print(f"  GET {path} -> {r.status} {r.headers.get('content-type')}")
        except Exception as e: print(f"  GET {path} -> {e}")
os.killpg(os.getpgid(p.pid), signal.SIGTERM)
try: p.wait(timeout=10)
except subprocess.TimeoutExpired: os.killpg(os.getpgid(p.pid), signal.SIGKILL)
time.sleep(1)
held = subprocess.run(["fuser", f"{port}/tcp"], capture_output=True, text=True).stdout.strip()
print("port free after teardown:", not held)
if not ok: print(open(logp).read()[-3000:])
sys.exit(0 if ok and not held else 1)
