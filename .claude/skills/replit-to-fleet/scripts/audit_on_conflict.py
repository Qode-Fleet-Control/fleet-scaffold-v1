#!/usr/bin/env python3
"""Find INSERT ... ON CONFLICT (cols) targets in API source that have no matching
unique index/constraint in the live database. Postgres rejects those at runtime
("there is no unique or exclusion constraint matching the ON CONFLICT
specification"). Typical cause: the Drizzle schema created the table first, so the
runtime `CREATE TABLE IF NOT EXISTS ... UNIQUE (...)` never ran.

usage: audit_on_conflict.py <api-src-dir> <DATABASE_URL>
Run AFTER db:push and after the API has booted once (so runtime DDL has run).
Tables not yet created (lazy runtime DDL) are listed separately, not failed."""
import collections, glob, re, subprocess, sys

src, url = sys.argv[1], sys.argv[2]
q = ("select t.relname, string_agg(a.attname, ',' order by a.attname) from pg_index i "
     "join pg_class t on t.oid=i.indrelid join pg_namespace n on n.oid=t.relnamespace "
     "join pg_attribute a on a.attrelid=t.oid and a.attnum = any(i.indkey) "
     "where i.indisunique and n.nspname='public' group by t.relname, i.indexrelid")
out = subprocess.run(["psql", url, "-tAF|", "-c", q], capture_output=True, text=True, check=True).stdout
uniq = collections.defaultdict(set)
for line in out.splitlines():
    if "|" in line:
        t, c = line.split("|"); uniq[t].add(c)
missing, lazy = collections.defaultdict(set), set()
pat = re.compile(r"INSERT\s+INTO\s+([a-z0-9_]+)(?:(?!INSERT\s+INTO).){0,4000}?ON\s+CONFLICT\s*\(([^)]*)\)", re.S | re.I)
for f in glob.glob(f"{src}/**/*.ts", recursive=True):
    s = open(f).read()
    for m in pat.finditer(s):
        t = m.group(1)
        cols = ",".join(sorted(x.strip().split()[0] for x in m.group(2).split(",")))
        name = f.split("/")[-1]
        if t not in uniq: lazy.add((t, name)); continue
        if cols not in uniq[t]: missing[t].add((cols, name))
for t, v in sorted(missing.items()):
    print("MISSING", t, sorted(v))
print(f"{len(missing)} table(s) with unmatched ON CONFLICT targets")
print(f"{len(lazy)} target(s) on tables not created yet (lazy runtime DDL) - re-run after exercising the app:")
for t, f in sorted(lazy): print("  ", t, f)
sys.exit(1 if missing else 0)
