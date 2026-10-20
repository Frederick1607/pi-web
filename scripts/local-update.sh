#!/bin/sh
# Rebuild this fork and install it as the global `pi-web`.
#
#   scripts/local-update.sh            bump the pi SDK to the latest release
#   scripts/local-update.sh 1.4.0      bump the pi SDK to a specific version
#   scripts/local-update.sh --sync     also merge upstream/main first
#
# Use this instead of `pi-web update`, which would reinstall the npm release.
set -eu

cd "$(dirname "$0")/.."

SYNC=0
PI_VERSION=""
for arg in "$@"; do
  case "$arg" in
    --sync) SYNC=1 ;;
    *) PI_VERSION="$arg" ;;
  esac
done

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is not clean; commit or stash first." >&2
  exit 1
fi

if [ "$SYNC" = 1 ]; then
  git fetch upstream --tags
  git merge --no-edit upstream/main
fi

if [ -z "$PI_VERSION" ]; then
  PI_VERSION=$(npm view @earendil-works/pi-coding-agent version)
fi
CURRENT=$(node -p "require('./package.json').dependencies['@earendil-works/pi-coding-agent']")
echo "pi SDK: $CURRENT -> $PI_VERSION"

if [ "$CURRENT" != "$PI_VERSION" ]; then
  node -e '
    const fs = require("fs");
    const version = process.argv[1];
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    for (const name of Object.keys(pkg.dependencies)) {
      if (name.startsWith("@earendil-works/pi-")) pkg.dependencies[name] = version;
    }
    fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
  ' "$PI_VERSION"
fi

npm install --no-audit --no-fund
node_modules/.bin/tsc --noEmit
npm test
npm run build

if [ "$CURRENT" != "$PI_VERSION" ]; then
  git add package.json package-lock.json
  git commit -m "chore(deps): bump pi SDK to $PI_VERSION"
fi

pi-web stop >/dev/null 2>&1 || true
rm -rf .next/server/route-cache
TMP=$(mktemp -d)
npm pack --silent --pack-destination "$TMP" >/dev/null
npm install -g "$TMP"/agegr-pi-web-*.tgz --no-audit --no-fund
rm -rf "$TMP"

echo "Installed: $(pi-web version) with pi SDK $PI_VERSION"
echo "Run 'pi-web' to start it. Push with: git push origin custom"
