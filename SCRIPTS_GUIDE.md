# Deployment & Maintenance Scripts

## 🔄 Auto-Update Script
Pull latest code dari GitHub dengan backup automatik.

```bash
bash update.sh
```

**What it does:**
1. ✅ Backup current code ke `.backups/`
2. ✅ Pull latest dari GitHub
3. ✅ Auto-restart bot
4. ✅ Rollback if pull fails

---

## 🔙 Rollback Script
Kembali ke commit sebelumnya kalau ada error.

```bash
# Rollback 1 commit
bash rollback.sh

# Rollback ke specific commit
bash rollback.sh abc1234
```

**How to use:**
1. Run `git log --oneline` untuk lihat commit history
2. Copy commit hash yang nak rollback
3. Run `bash rollback.sh [hash]`

---

## 🚀 Safe Deploy (Recommended)
Deploy dengan safety check. Kalau gagal, auto-rollback.

```bash
bash safe_deploy.sh
```

**What it does:**
1. ✅ Save current commit hash
2. ✅ Backup files
3. ✅ Pull from GitHub
4. ✅ Test syntax (optional)
5. ✅ Restart bot
6. ✅ Show rollback command if needed

---

## 📋 Quick Commands

### Update bot (safe)
```bash
bash safe_deploy.sh
```

### Update bot (fast)
```bash
bash update.sh
```

### Check commit history
```bash
git log --oneline -10
```

### Rollback jika error
```bash
# Method 1: Rollback 1 commit
bash rollback.sh

# Method 2: Rollback ke specific commit
bash rollback.sh abc1234
```

### Manual rollback
```bash
git reset --hard HEAD~1  # Go back 1 commit
git pull origin main --rebase
pm2 restart cexishope
```

---

## 🛡️ Safety Features

### Automatic Backups
Every deploy creates backup in `.backups/YYYYMMDD_HHMMSS/`

### Stash Local Changes
Your local changes are saved before pulling:
```bash
git stash list  # View stashed changes
git stash pop   # Restore stashed changes
```

### View Backup Location
```bash
ls -la .backups/
```

### Restore from Backup
```bash
cp -r .backups/YYYYMMDD_HHMMSS/* ./
pm2 restart cexishope
```

---

## ⚠️ Emergency Recovery

If bot crashes after update:

1. **Check logs**
   ```bash
   pm2 logs cexishope --lines 50
   ```

2. **Rollback immediately**
   ```bash
   bash rollback.sh
   ```

3. **Or restore from backup**
   ```bash
   cp -r .backups/latest_working/* ./
   pm2 restart cexishope
   ```

---

## 🔍 Troubleshooting

### "Permission denied" error
```bash
chmod +x *.sh
```

### "Git conflicts" error
```bash
git reset --hard origin/main
bash update.sh
```

### Bot won't start after update
```bash
# Quick rollback
bash rollback.sh

# Check for missing dependencies
npm install

# Check logs
pm2 logs cexishope
```

---

## 📌 Best Practices

1. **Always use `safe_deploy.sh`** for production
2. **Keep backups** for at least 7 days
3. **Test locally** before deploying to server
4. **Check bot logs** after every update

---

## File Structure
```
cexishope-main/
├── update.sh          # Quick update script
├── rollback.sh        # Rollback to previous commit
├── safe_deploy.sh     # Safe deploy with checks
└── .backups/          # Auto-created backups
    ├── 20260216_103000/
    └── 20260216_104500/
```
