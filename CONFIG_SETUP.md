# 🔧 Setup Config Tokens (NO REPLIT AUTH)

## Bahasa Melayu

### Kaedah 1: Terus di config.js (RECOMMENDED)

Edit file `config.js`:

```javascript
module.exports = {
  // 1. TELEGRAM BOT TOKEN (WAJIB!)
  TELEGRAM_BOT_TOKEN: '8285430975:AAFxk17EnyAHonkeaYVKOAW4ZJLAjeBFzMQ',
  
  // 2. DROPBOX TOKEN (Optional - untuk backup)
  DROPBOX_TOKEN: 'sl.BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxA',
  
  // 3. GOOGLE DRIVE TOKEN (Optional - backup failover)
  GOOGLE_DRIVE_TOKEN: 'ya29.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  
  OWNER_ID: 8253048034, // Tukar dengan ID Telegram anda
  // ... rest of config
};
```

### Kaedah 2: Guna file .env

1. Copy `.env.example` ke `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` dan masukkan tokens:
   ```
   TELEGRAM_BOT_TOKEN=8285430975:AAFxk17EnyAHonkeaYVKOAW4ZJLAjeBFzMQ
   DROPBOX_TOKEN=sl.BxxxxxxxxxxxxxxxxxA
   GOOGLE_DRIVE_TOKEN=ya29.xxxxxxxx
   ```

### Cara Dapatkan Tokens:

#### 1. Telegram Bot Token
1. Buka Telegram, cari @BotFather
2. Hantar `/newbot`
3. Ikut arahan untuk buat bot
4. Copy token yang diberi (contoh: `8285430975:AAFxk17E...`)

#### 2. Dropbox Token (Optional)
1. Pergi ke https://www.dropbox.com/developers/apps
2. Create app → Scoped access → Full Dropbox
3. Pergi ke tab OAuth 2
4. Klik "Generate access token"
5. Copy token (bermula dengan `sl.`)

Atau guna command dalam bot:
```
/addapi sl.your_dropbox_token_here
```

#### 3. Google Drive Token (Optional)
- Untuk backup failover sahaja
- Rujuk dokumentasi Google Drive API

---

## English

### Method 1: Directly in config.js (RECOMMENDED)

Edit `config.js` file:

```javascript
module.exports = {
  // 1. TELEGRAM BOT TOKEN (REQUIRED!)
  TELEGRAM_BOT_TOKEN: '8285430975:AAFxk17EnyAHonkeaYVKOAW4ZJLAjeBFzMQ',
  
  // 2. DROPBOX TOKEN (Optional - for backup)
  DROPBOX_TOKEN: 'sl.BxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxA',
  
  // 3. GOOGLE DRIVE TOKEN (Optional - backup failover)
  GOOGLE_DRIVE_TOKEN: 'ya29.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  
  OWNER_ID: 8253048034, // Change to your Telegram ID
  // ... rest of config
};
```

### Method 2: Use .env file

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add tokens:
   ```
   TELEGRAM_BOT_TOKEN=8285430975:AAFxk17EnyAHonkeaYVKOAW4ZJLAjeBFzMQ
   DROPBOX_TOKEN=sl.BxxxxxxxxxxxxxxxxxA
   GOOGLE_DRIVE_TOKEN=ya29.xxxxxxxx
   ```

### How to Get Tokens:

#### 1. Telegram Bot Token
1. Open Telegram, search for @BotFather
2. Send `/newbot`
3. Follow instructions to create bot
4. Copy the token provided (example: `8285430975:AAFxk17E...`)

#### 2. Dropbox Token (Optional)
1. Go to https://www.dropbox.com/developers/apps
2. Create app → Scoped access → Full Dropbox
3. Go to OAuth 2 tab
4. Click "Generate access token"
5. Copy token (starts with `sl.`)

Or use command in bot:
```
/addapi sl.your_dropbox_token_here
```

#### 3. Google Drive Token (Optional)
- For backup failover only
- Refer to Google Drive API documentation

---

## Priority System

Token loading priority (first found wins):

1. **settings.json** (via `/addapi` command) - Highest priority
2. **config.js** - Direct hardcoded tokens
3. **.env file** - Environment variables via process.env

**NO REPLIT AUTH NEEDED!** 🚫

All tokens can be set directly in config.js or .env file.

---

## Security Warning ⚠️

**IMPORTANT:** If using git/GitHub:

1. **DO NOT commit config.js** with real tokens
2. **DO add .env to .gitignore** (already included)
3. **Best practice:** Use .env file and keep .env in .gitignore

Current .gitignore already includes:
```
.env
```

So your tokens are safe! ✅
