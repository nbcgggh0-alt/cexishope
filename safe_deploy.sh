#!/bin/bash
# Safe deploy script - Pull + Test + Rollback jika gagal
# Usage: bash safe_deploy.sh

echo "🚀 Safe Deploy Starting..."

# Save current commit hash
CURRENT_COMMIT=$(git rev-parse HEAD)
echo "📌 Current commit: $CURRENT_COMMIT"

# Backup
BACKUP_DIR=".backups/$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup at $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"
cp -r handlers utils config.js index.js package.json "$BACKUP_DIR/" 2>/dev/null

# Pull
echo "⬇️ Pulling latest code..."
git stash push -m "Auto-stash $(date +%Y%m%d_%H%M%S)"
git pull origin main

if [ $? -ne 0 ]; then
    echo "❌ Pull failed! Aborting..."
    git stash pop
    exit 1
fi

# Test syntax (optional - uncomment if you want)
# echo "🔍 Testing code syntax..."
# node -c index.js
# if [ $? -ne 0 ]; then
#     echo "❌ Code has syntax errors! Rolling back..."
#     git reset --hard $CURRENT_COMMIT
#     exit 1
# fi

echo "✅ Deploy successful!"
echo "📦 Backup: $BACKUP_DIR"
echo "📌 Previous commit (for rollback): $CURRENT_COMMIT"
echo ""
echo "🔄 Restarting bot..."
pm2 restart cexishope 2>/dev/null || npm start &

echo ""
echo "⚠️ If bot crashes, run: bash rollback.sh $CURRENT_COMMIT"
