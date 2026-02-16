#!/bin/bash
# Rollback script - kembali ke commit sebelumnya
# Usage: bash rollback.sh [commit_hash]
# atau: bash rollback.sh (untuk rollback 1 commit)

if [ -z "$1" ]; then
    echo "🔙 Rolling back to previous commit..."
    git reset --hard HEAD~1
    git pull origin main --rebase
else
    echo "🔙 Rolling back to commit $1..."
    git reset --hard "$1"
fi

echo "✅ Rollback complete!"
echo "🔄 Restarting bot..."
pm2 restart cexishope 2>/dev/null || echo "⚠️ Please restart bot manually"
