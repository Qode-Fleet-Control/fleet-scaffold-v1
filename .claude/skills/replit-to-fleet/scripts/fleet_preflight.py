#!/usr/bin/env python3
"""Run Fleet Control's own repo-side preflight checks (collector/preflight.py:
check_template, check_conf) against a local repo's COMMITTED tree, offline.

The collector package connects to its database at import time, so this extracts
the pure check functions via ast and runs only those.

usage: fleet_preflight.py <agent-fleet-backend-dir> <repo> [git-ref=HEAD]
Needs a python with nothing extra (stdlib only). Exit 1 if a REQUIRED check fails."""
import ast, subprocess, sys

B, R = sys.argv[1], sys.argv[2]
ref = sys.argv[3] if len(sys.argv) > 3 else "HEAD"
mod = ast.parse(open(f"{B}/collector/preflight.py").read())
keep = []
for node in mod.body:
    if isinstance(node, (ast.Import, ast.ImportFrom)):
        mods = [a.name for a in node.names] if isinstance(node, ast.Import) else [node.module or ""]
        if all(m.split(".")[0] in sys.stdlib_module_names or m == "__future__" for m in mods):
            keep.append(node)
    elif isinstance(node, (ast.FunctionDef, ast.Assign, ast.AnnAssign)):
        keep.append(node)
ns = {"__name__": "preflight_offline"}
for node in keep:
    try: exec(compile(ast.Module([node], []), "preflight.py", "exec"), ns)
    except Exception: pass  # module-level config that needs the running fleet
show = lambda p: subprocess.run(["git", "-C", R, "show", f"{ref}:{p}"], capture_output=True, text=True).stdout or None
tree = subprocess.run(["git", "-C", R, "ls-tree", "-r", ref], capture_output=True, text=True, check=True).stdout
entries = []
for line in tree.splitlines():
    meta, path = line.split("\t", 1); mode, typ, _ = meta.split()
    entries.append({"path": path, "type": typ, "mode": mode})
steps = ns["check_template"](entries, show("bin/run"), show(".gitignore"), show(".env.example"), False)
steps += ns["check_conf"](show("fleet.conf"), entries, show("bin/run"))
failed = 0
for s in steps:
    req = s.get("required"); st = s.get("status", "")
    if req and st == "fail": failed += 1
    print(f"{st:8} {'REQUIRED' if req else 'advisory'}  {s.get('label','')[:52]:52} {str(s.get('detail',''))[:70]}")
print(f"--- {failed} required check(s) failing")
sys.exit(1 if failed else 0)
