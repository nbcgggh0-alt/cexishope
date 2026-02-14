# 🚀 Quick Start Guide - CexiStore Bot

## Step 1: Get Bot Token (2 minutes)

1. Open Telegram
2. Search for: **@BotFather**
3. Send: `/newbot`
4. Choose a name: **My Store Bot**
5. Choose username: **mystorebot** (must end with 'bot')
6. Copy the token you receive (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

## Step 2: Configure Bot (1 minute)

1. Open `config.js`
2. Replace `YOUR_BOT_TOKEN_HERE` with your token:

```javascript
TELEGRAM_BOT_TOKEN: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
```

3. Save the file

## Step 3: Setup Example Data (Optional)

Run this to create example categories and products:

```bash
node setup.js
```

## Step 4: Start Bot

```bash
npm start
```

You should see: `🚀 CexiStore Bot is running!`

## Step 5: Configure on Telegram (3 minutes)

1. Open Telegram
2. Search for your bot username
3. Send: `/start`
4. Send: `/setowner` (makes you the owner)
5. Upload your payment QR code to `qr/` folder
6. Done! 🎉

## Step 6: Test the Bot

### Add a Category
```
/addcategory Netflix Premium
```

### Add a Product
```
/addproduct CAT-XXXXX | Netflix Account | 15.00 | 5 | Premium account 1 month | auto
```
(Replace CAT-XXXXX with the category ID from step above)

### Test Order Flow
1. Click "🛒 Beli Produk"
2. Select category
3. Select product
4. Click "💳 Beli Sekarang"
5. Bot sends QR code
6. User uploads payment proof with `/send`
7. Admin verifies with `/verify ORD-XXXXX`

## Admin Commands Cheatsheet

```bash
/verify [order_id]     # Approve order
/reject [order_id]     # Reject order
/join [token]          # Join support chat
/addadmin [user_id]    # Add admin
/addcategory [name]    # Add category
/listproducts          # List all products
```

## 📝 Important Notes

- **Token Location**: All config in `config.js` (not .env)
- **Data Storage**: JSON files in `data/` folder
- **QR Codes**: Upload to `qr/` folder
- **Language**: Default is Malay, users can toggle to English
- **Session Timeout**: 4 hours for support chats
- **Auto Delivery**: Set product type to "auto" with items array

## 🔧 Troubleshooting

**Bot won't start?**
- Check if token is correct in config.js
- Make sure token doesn't have spaces

**No products showing?**
- Check stock is > 0
- Check product is set to active: true

**Payment not working?**
- Add QR image to qr/ folder
- Update path in data/settings.json

## 📱 User Experience Flow

1. User sends `/start`
2. Sees main menu with inline buttons
3. Browses products by category
4. Makes purchase
5. Gets QR payment
6. Uploads proof with `/send`
7. Receives item after admin verification

## 👑 Owner Functions

- Set owner: `/setowner`
- Add admin: `/addadmin [telegram_id]`
- Remove admin: `/removeadmin [telegram_id]`
- Access owner panel from main menu

---

**Need help?** Check README.md for full documentation.
