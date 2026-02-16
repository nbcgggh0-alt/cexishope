# 🚀 Panduan Deploy ke Render

## Langkah-langkah Deploy Bot Telegram ke Render

### 1️⃣ Push Kod ke GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2️⃣ Buat Web Service di Render

1. Pergi ke [render.com](https://render.com)
2. Login atau daftar akaun free
3. Klik **"New +"** → **"Web Service"**
4. Connect repository GitHub anda
5. Pilih repository bot Telegram anda

### 3️⃣ Konfigurasi Web Service

**Build Command:**
```
npm install
```

**Start Command:**
```
node index.js
```

**Environment:**
- Runtime: `Node`
- Region: Pilih yang terdekat (contoh: Singapore)
- Branch: `main`
- Plan: **Free** (untuk testing)

### 4️⃣ Set Environment Variables

Klik **"Environment"** dan tambah:

| Key | Value | Keterangan |
|-----|-------|------------|
| `TELEGRAM_BOT_TOKEN` | `your_bot_token` | Token dari @BotFather |

**Cara dapat Bot Token:**
1. Chat dengan [@BotFather](https://t.me/BotFather) di Telegram
2. Hantar `/newbot`
3. Ikut arahan untuk nama dan username bot
4. Copy token yang diberi

### 5️⃣ Deploy!

1. Klik **"Create Web Service"**
2. Tunggu build selesai (2-5 minit)
3. Bot akan start automatically

---

## ⚠️ Penting!

### Free Tier Limits:
- ✅ 750 hours/month
- ⚠️ Auto sleep selepas 15 min tanpa aktiviti
- ✅ Bot akan auto-wake bila ada message masuk

### Tips:
1. **Bot akan sleep bila tiada message**
   - First message selepas sleep akan ada delay 30-60 saat
   - Selepas itu bot akan respond dengan pantas
   
2. **Monitor Usage:**
   - Check dashboard Render untuk usage
   - 750 hours/month cukup untuk bot dengan active users
   
3. **Upgrade jika perlu:**
   - Paid tier $7/month - no sleep, always online
   - Good untuk production bot dengan ramai user 24/7

---

## 🔍 Troubleshooting

### Bot tidak start?
✅ Check Environment Variables di Render:
- `TELEGRAM_BOT_TOKEN` ada dan betul?
- Check logs di Render dashboard untuk error messages
- Restart service: Dashboard → Manual Deploy → **"Deploy latest commit"**

### Bot tidak respond?
✅ Check Telegram:
- Cuba send `/start` ke bot
- Check status bot di @BotFather
- Pastikan bot token betul di Environment Variables

✅ Check Logs di Render dashboard:
- Klik **"Logs"** untuk lihat error
- Pastikan bot successfully connected ke Telegram

---

## 📱 Telegram Bot Commands

Test bot anda dengan command:
- `/start` - Start bot dan lihat menu utama
- `/ping` - Check system status
- `/list` - Lihat semua commands

---

## 🎉 Siap!

Bot Telegram anda sekarang:
- ✅ Running di Render
- ✅ Respond kepada messages
- ✅ Semua features accessible via Telegram bot
- ✅ Free hosting!

**Bot Username:** `@your_bot_username` (dari BotFather)
**Commands:** Semua commands accessible via `/list` dalam Telegram

---

**Need help?** Check logs di Render dashboard atau contact support.
