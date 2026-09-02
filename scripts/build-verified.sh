#!/usr/bin/env bash
set -euo pipefail

# Simple build script for GitHub Pages static export
echo "Running Next.js static build..."
npx next build

