#!/bin/bash

# Restart the Vite dev server for Marcação Mestre
# This script kills any existing Vite process and starts fresh

echo "🔄 Restarting Marcação Mestre dev server..."

# Kill any existing Vite processes
pkill -f "vite" 2>/dev/null && echo "✅ Killed existing Vite process" || echo "ℹ️  No existing Vite process found"

# Small delay to ensure port is released
sleep 1

# Navigate to project directory and start dev server
cd "$(dirname "$0")"
echo "🚀 Starting dev server..."
npm run dev
