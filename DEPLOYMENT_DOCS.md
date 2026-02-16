# CexiStore Bot - Deployment & Handoff Guide

This repository contains the optimized version of CexiStore Bot.

## 🚀 Quick Start for Future AI / Developers

**Repository URL:** `https://github.com/nbcgggh0-alt/cexishope.git`

### 1. Push Changes (If you made edits)
To push new changes to the repository, simply run:
```bash
git add .
git commit -m "Update message here"
git push origin master
```

### 2. Deployment (Pterodactyl / VPS)
This project is optimized for Pterodactyl. 

**Startup Command:**
```bash
node index.js
```

**Install Command:**
```bash
npm install --production
```

---

## 🔑 Environment Variables (Secrets)
These variables MUST be set in your Pterodactyl **"Variables"** tab or in a `.env` file.

| Variable | Description | Required? | Example |
| :--- | :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Your Telegram Bot Token from @BotFather | **YES** | `123456:ABC-DEF...` |
| `SUPABASE_URL` | Your Supabase Project URL | **YES** | `https://xyz.supabase.co` |
| `SUPABASE_KEY` | Your Supabase `service_role` key (keep secret!) | **YES** | `eyJh...` |
| `OWNER_ID` | Your Telegram User ID (get from @userinfobot) | **YES** | `123456789` |
| `STORE_NAME` | Name of your store displayed in bot | No | `CexiStore Pro` |
| `STORE_CURRENCY` | Currency symbol | No | `RM`, `USD`, `IDR` |
| `SESSION_TIMEOUT` | Admin session timeout in ms (default 4 hours) | No | `14400000` |
| `EXCHANGE_RATE_API_KEY` | API Key for currency conversion (optional) | No | `your_api_key` |
| `NODE_ENV` | Set to `production` for better performance | No | `production` |
| `TRANSACTION_CHANNEL_ID` | Channel ID for receipt notifications (start with -100) | No | `-100123456789` |

---

## 🛠️ Maintenance Commands

**Clear Cache / Fix "Access Token" Error:**
If you see "Access token expired" or installation errors:
1. Delete `node_modules` folder.
2. Delete `package-lock.json`.
3. Restart server.

**Check Dependencies:**
The `package.json` has been cleaned to include only:
- `telegraf` (Bot framework)
- `express` (Web panel)
- `supabase-js` (Database)
- `axios` (HTTP requests)
- `node-cron` (Scheduled tasks)
- `pdfkit` (Receipt generation)
