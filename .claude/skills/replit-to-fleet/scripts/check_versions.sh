#!/usr/bin/env bash
# Verify every dependency in the repo's private GitHub Packages scopes resolves at the
# EXACT pinned version. Scopes and the token variable are read from <repo>/.npmrc:
#   @scope:registry=https://npm.pkg.github.com
#   //npm.pkg.github.com/:_authToken=${SOME_VAR}
#
# usage: check_versions.sh <repo>
# SOME_VAR must be set in the environment (classic PAT, read:packages).
# Exit 1 if any pin is missing; prints what the registry said for it.
set -uo pipefail
repo="${1:?repo path}"
npmrc="$repo/.npmrc"
scopes=$(grep -oE '^@[A-Za-z0-9_.-]+:registry=https://npm\.pkg\.github\.com' "$npmrc" 2>/dev/null | cut -d: -f1 | sort -u)
[ -n "$scopes" ] || { echo "no GitHub Packages scopes in $npmrc - nothing to check"; exit 0; }
var=$(grep -oE 'npm\.pkg\.github\.com/:_authToken=\$\{[A-Za-z_][A-Za-z0-9_]*\}' "$npmrc" | head -1 | sed -E 's/.*\$\{([^}]+)\}/\1/')
[ -n "$var" ] || { echo "$npmrc has no _authToken=\${VAR} line for npm.pkg.github.com" >&2; exit 2; }
[ -n "${!var:-}" ] || { echo "$var (referenced by .npmrc) is not set" >&2; exit 2; }
echo "scopes: $(echo $scopes)   token variable: $var"
specs=$(python3 - "$repo" $scopes <<'PY'
import json, glob, sys
repo, scopes = sys.argv[1], tuple(s + "/" for s in sys.argv[2:])
out = set()
for f in glob.glob(f"{repo}/apps/*/package.json") + glob.glob(f"{repo}/packages/*/package.json") \
       + glob.glob(f"{repo}/artifacts/*/package.json") + glob.glob(f"{repo}/lib/*/package.json") + [f"{repo}/package.json"]:
    try: d = json.load(open(f))
    except Exception: continue
    for sec in ("dependencies", "devDependencies", "peerDependencies"):
        for k, v in d.get(sec, {}).items():
            if k.startswith(scopes) and not v.startswith(("workspace:", "catalog:")): out.add(f"{k}@{v}")
print("\n".join(sorted(out)))
PY
)
[ -n "$specs" ] || { echo "no dependencies in those scopes"; exit 0; }
missing=0
while read -r spec; do
  res=$(npm view "$spec" version --userconfig "$npmrc" --prefer-online 2>&1)
  got=$(printf '%s\n' "$res" | grep -vE '^npm (error|warn)' | tail -1)
  if [ -n "$got" ]; then echo "ok       $spec"; else
    missing=$((missing+1))
    why=$(printf '%s\n' "$res" | grep -m1 -oE 'E[0-9]{3}[^\n]{0,90}')
    echo "MISSING  $spec   ${why:-not found}"
  fi
done <<< "$specs"
echo "---"; echo "$missing missing"; [ "$missing" -eq 0 ]
