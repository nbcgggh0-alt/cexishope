#!/bin/bash
# Auto-update script untuk pull latest code dari GitHub
# Usage: bash update.sh

echo "🔄 Starting update from GitHub..."

# 1. Backup current state
BACKUP_DIR=".backups/$(date +%Y%m%d_%H%M%S)"
echo "📦 Creating backup at $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"
cp -r handlers utils config.js index.js "$BACKUP_DIR/" 2>/dev/null

# 2. Stash local changes (if any)
echo "💾 Saving local changes..."
git stash push -m "Auto-stash before update $(date +%Y%m%d_%H%M%S)"

# 3. Pull from GitHub
echo "⬇️ Pulling from GitHub..."
git pull origin main

# Check if pull was successful
if [ $? -eq 0 ]; then
    echo "✅ Update successful!"
    echo "📦 Backup saved at: $BACKUP_DIR"
    echo ""
    echo "🔄 Restarting bot..."
    pm2 restart cexishope 2>/dev/null || echo "⚠️ Please restart bot manually: npm start"
else
    echo "❌ Update failed!"
    echo "🔙 Rolling back..."
    git stash pop
    exit 1
fi
