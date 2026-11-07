#!/usr/bin/env bash
# Puts the images from the original HN Creative Agency site into /public so the new site never
# depends on the old deployment (do this BEFORE you deploy the new site over the old one).
#
#   bash scripts/copy-legacy-assets.sh                 # download from the live old site
#   bash scripts/copy-legacy-assets.sh ~/old-hn-site   # or copy from your old project folder
#
# Then run:  npm run images:optimize   (creates small .webp copies the site uses automatically)
set -euo pipefail
FILES="logo.png project-1.jpg project-2.jpg project-3.jpg project-4.jpg project-5.jpg project-6.jpg assets/images/favicon.png assets/images/image.png"
mkdir -p public/assets/images
if [ "${1:-}" != "" ]; then
  for f in $FILES; do
    if [ -f "$1/$f" ]; then cp "$1/$f" "public/$f" && echo "✓ $f"; else echo "✗ $f not found in $1"; fi
  done
else
  BASE="https://hncreativeagency.pages.dev"
  for f in $FILES; do
    if curl -fsSL "$BASE/$f" -o "public/$f"; then echo "✓ $f"; else echo "✗ could not download $f — copy it manually into public/$f"; fi
  done
fi
echo "Done. Commit the files in public/ and run: npm run images:optimize"
