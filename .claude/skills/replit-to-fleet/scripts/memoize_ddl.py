#!/usr/bin/env python3
"""Make runtime schema initialisers run once per process.

Replit-built APIs often run `CREATE TABLE IF NOT EXISTS ...` inside an
`export async function ensureXSchema()` that is called on every request and
from background workers. On a FRESH database, two concurrent first calls race
on pg_type/pg_class ("duplicate key value violates unique constraint
pg_type_typname_nsp_index"). Existing Replit databases never hit it.

usage:
  memoize_ddl.py --scan <api-src-dir>          list candidates (DDL + not memoized)
  memoize_ddl.py <file.ts> <ensureFnName> ...  wrap the named functions in place

Only wraps zero-argument `export async function name()` definitions; anything
else is reported so you can handle it by hand."""
import glob, re, sys

MEMO_HINT = re.compile(r"(Promise<void> \| undefined|\?\?=\s*\(|\?\?=\s*create|schemaPromise|let\s+\w*(ready|Ready|initialized)\b)")

def scan(src):
    for f in sorted(glob.glob(f"{src}/**/*.ts", recursive=True)):
        s = open(f).read()
        if "CREATE TABLE IF NOT EXISTS" not in s: continue
        fns = re.findall(r"export async function (ensure\w*)\(\)", s)
        if not MEMO_HINT.search(s):
            print(f"{f}: {', '.join(fns) or '(DDL outside an ensure*() function - inspect by hand)'}")

def wrap(path, fn):
    s = open(path).read()
    pat = re.compile(r"export async function " + fn + r"\(\)\s*(:\s*Promise<void>\s*)?\{")
    hits = pat.findall(s)
    if len(hits) != 1:
        print(f"SKIP {path}:{fn} - expected exactly one zero-arg definition, found {len(hits)}"); return
    inner = "create" + fn[len("ensure"):] if fn.startswith("ensure") else fn + "Once"
    m = pat.search(s)
    wrapper = (f"// Run the DDL once per process: concurrent first calls on a fresh database race\n"
               f"// on pg_type/pg_class and fail with duplicate-key errors.\n"
               f"let {inner}Promise: Promise<void> | undefined;\n"
               f"export function {fn}(): Promise<void> {{\n"
               f"  {inner}Promise ??= {inner}().catch((error) => {{\n"
               f"    {inner}Promise = undefined;\n"
               f"    throw error;\n"
               f"  }});\n"
               f"  return {inner}Promise;\n"
               f"}}\n\n")
    s = s[:m.start()] + wrapper + f"async function {inner}(): Promise<void> {{" + s[m.end():]
    open(path, "w").write(s)
    print(f"wrapped {path}:{fn}")

if __name__ == "__main__":
    if sys.argv[1] == "--scan": scan(sys.argv[2])
    else:
        for fn in sys.argv[2:]: wrap(sys.argv[1], fn)
