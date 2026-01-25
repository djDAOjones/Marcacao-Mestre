#!/bin/bash

# Rebuild Marcação Mestre with version increment
# This script:
# 1. Clears all caches (Vite, TypeScript, dist)
# 2. Increments the build number in version.json
# 3. Runs TypeScript check and Vite build
# 4. Restarts the dev server

set -e

SCRIPT_DIR="$(dirname "$0")"
cd "$SCRIPT_DIR"

echo "🔧 Marcação Mestre Rebuild Script"
echo "================================="

# Clear caches
echo "🧹 Clearing caches..."
rm -rf node_modules/.vite 2>/dev/null && echo "   Cleared Vite cache" || true
rm -rf dist 2>/dev/null && echo "   Cleared dist folder" || true
rm -f tsconfig.tsbuildinfo 2>/dev/null && echo "   Cleared TS build cache" || true

# Increment build number
VERSION_FILE="version.json"
if [ -f "$VERSION_FILE" ]; then
  MAJOR=$(cat "$VERSION_FILE" | grep '"major"' | sed 's/[^0-9]//g')
  MINOR=$(cat "$VERSION_FILE" | grep '"minor"' | sed 's/[^0-9]//g')
  BUILD=$(cat "$VERSION_FILE" | grep '"build"' | sed 's/[^0-9]//g')
  NEW_BUILD=$((BUILD + 1))
  
  cat > "$VERSION_FILE" << EOF
{
  "major": $MAJOR,
  "minor": $MINOR,
  "build": $NEW_BUILD
}
EOF
  
  echo "📦 Version: $MAJOR.$MINOR.$NEW_BUILD"
else
  echo "❌ version.json not found!"
  exit 1
fi

# Kill any existing Vite processes
echo "🛑 Stopping existing dev server..."
pkill -f "vite" 2>/dev/null && echo "   Killed existing Vite process" || echo "   No existing Vite process"
sleep 1

# Run build
echo "🔨 Building..."
npm run build

if [ $? -eq 0 ]; then
  echo "✅ Build successful!"
else
  echo "❌ Build failed!"
  exit 1
fi

# Start dev server
echo "🚀 Starting dev server..."
npm run dev
