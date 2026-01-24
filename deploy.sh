#!/bin/bash

# Marcação Mestre - Build and Deploy Script
# Usage: ./deploy.sh "commit message"

set -e

# Default commit message if none provided
MESSAGE="${1:-Update deployment}"

echo "🔨 Building production bundle..."
npm run build

echo "📦 Staging changes..."
git add .

echo "💾 Committing: $MESSAGE"
git commit -m "$MESSAGE" || echo "No changes to commit"

echo "🚀 Pushing to GitHub..."
git push

echo ""
echo "✅ Done! GitHub Actions will deploy to:"
echo "   https://djdaojones.github.io/Marcacao-Mestre/"
echo ""
echo "   Check status: https://github.com/djDAOjones/Marcacao-Mestre/actions"
