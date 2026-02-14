# CexiStore Ultimate Pro - Telegram Bot

A comprehensive bilingual (Malay/English) Telegram e-commerce bot with 120+ functions for digital product sales, complete with FAQ, templates, and advanced features.

## 🚀 Quick Start

### 1. Get Your Telegram Bot Token

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` to create a new bot
3. Follow instructions to set name and username
4. Copy the bot token you receive

### 2. Configure Bot

Edit `config.js` and add your bot token:

```javascript
module.exports = {
  TELEGRAM_BOT_TOKEN: 'YOUR_BOT_TOKEN_HERE',  // Paste your token here
  DROPBOX_TOKEN: 'YOUR_DROPBOX_TOKEN',         // For primary backup storage
  OWNER_ID: null,
  // ... rest of config
};
```

**Optional - Secondary Backup (Google Drive):**
```bash
export GOOGLE_DRIVE_TOKEN='your_google_drive_token_here'
```
This enables automatic failover when Dropbox storage is full.

### 3. Run the Bot

```bash
npm start
```

## 📋 Initial Setup

### Set Yourself as Owner

1. Start your bot in Telegram by searching for your bot username
2. Send `/start` 
3. Send `/setowner` to become the owner
4. You can now access Owner Panel

### Add Admins

```
/addadmin [user_id]
```

Get user_id by having the user send `/start` to the bot, then check `data/users.json`

## 🛍️ Store Management

### Add Categories

```
/addcategory Netflix
/addcategory CapCut Premium
```

### Add Products

```
/addproduct [category_id] | [name] | [price] | [stock] | [description]

Example:
/addproduct CAT-ABC123 | Netflix Premium | 15.00 | 10 | 1 month subscription
```

**All products are manual delivery** - Admin will deliver items to customers after verification.

### Upload QR Payment

Place your payment QR code image in the `qr/` folder and update `data/settings.json`:

```json
{
  "qrPayment": {
    "path": "./qr/payment.jpg"
  }
}
```

## 👤 User Features

- 🛒 Browse and buy products
- 💳 QR code payment with proof upload (`/send` command)
- 📦 Order history and status tracking
- 🎁 Access purchased digital items
- 💬 Live chat support with session system
- 🌐 Switch language (Malay/English/Chinese/Tamil)
- ❓ FAQ - View frequently asked questions
- 📖 User Guide - Complete bot usage guide
- 📋 `/list` - View all available commands with buttons

## 👨‍💼 Admin Features

### Order Management
- 📥 View and verify pending orders
- ✅ Approve orders: `/verify [order_id]`
- ❌ Reject orders: `/reject [order_id]`
- 🔍 Advanced order search: `/searchorder [query]`
- 📊 Filter orders: `/filterorders`
- ✅ Check all order IDs: `/checkallorderid`

### Product Management
- 📦 Add/manage products and categories
- 🔄 Duplicate products: `/duplicate [product_id]`
- 📊 View inventory history: `/inventory [product_id]`
- 📈 Adjust stock: `/adjuststock [product_id] [+/-num] [note]`
- 📋 List all products: `/listproducts`

### User Management
- 🚫 Ban user: `/ban [user_id] [reason]`
- ✅ Unban user: `/unban [user_id]`
- 🏷️ Tag user: `/tag [user_id] [tag]`
- ❌ Remove tag: `/untag [user_id] [tag]`
- 📋 List banned users: `/bannedlist`

### Quick Reply & FAQ System
- 📝 Add template: `/addtemplate [keyword] | [response]`
- ⚡ Quick template: `/qt [keyword]`
- 📋 List templates: `/templates`
- 🗑️ Delete template: `/deletetemplate [keyword]`
- ❓ Add FAQ: `/addfaq [question] | [answer]`
- 📋 List FAQs: `/listfaqs`
- 🗑️ Delete FAQ: `/deletefaq [faq_id]`

### Communication & Support
- 💬 Join support sessions: `/join [token]`
- 🚪 Leave session: `/leave`
- 🔚 Close session: `/close`
- 📢 Broadcast messages to users
- 📊 View user feedbacks: `/feedbacks`

### Other Admin Tools
- 💱 Change currency: `/currency`
- 📋 View all commands: `/list`

## 👑 Owner Features

- 👥 Manage admins
  - `/setowner` - Set yourself as owner
  - `/addadmin [user_id]` - Add admin
  - `/removeadmin [user_id]` - Remove admin
- ⚙️ Store settings
- 💾 Backup & restore
- 🔧 Full system control
- 📊 Analytics and reports

## 📁 Project Structure

```
├── index.js              # Main bot file
├── config.js             # Configuration (tokens, settings)
├── handlers/             # Bot command handlers
│   ├── start.js          # Welcome & main menu
│   ├── products.js       # Product browsing & purchase
│   ├── payment.js        # Payment proof handling
│   ├── orders.js         # Order history
│   ├── admin.js          # Admin panel & functions
│   ├── owner.js          # Owner panel & management
│   ├── session.js        # Live chat support
│   ├── userManagement.js # Ban/unban/tag users
│   ├── orderSearch.js    # Advanced order search
│   ├── productManagement.js # Product operations
│   ├── autoReply.js      # Templates & FAQ system
│   ├── currency.js       # Currency settings
│   └── feedback.js       # User feedback system
├── utils/                # Utility functions
│   ├── database.js       # JSON database operations
│   ├── translations.js   # Multi-language support
│   ├── helpers.js        # Helper functions
│   └── messageHelper.js  # Safe message editing
├── data/                 # JSON database files
│   ├── users.json        # User accounts
│   ├── products.json     # Product catalog
│   ├── categories.json   # Product categories
│   ├── transactions.json # Order history
│   ├── sessions.json     # Support sessions
│   ├── admins.json       # Admin & owner list
│   ├── settings.json     # Store settings
│   ├── templates.json    # Quick reply templates (30+ templates)
│   ├── faqs.json         # FAQ database (15+ FAQs)
│   └── feedbacks.json    # User feedback
├── media/                # Media files
├── qr/                   # QR code images
└── logs/                 # Log files & receipts
```

## 🔐 Payment Flow

1. User browses products and clicks "Buy Now"
2. Bot sends QR payment code
3. User makes payment
4. User sends payment proof using `/send` (reply with photo)
5. Admin receives notification
6. Admin verifies: `/verify [order_id]`
7. Admin manually delivers item to customer

## 💬 Support Session System

- User clicks "Live Chat Support"
- System creates session with unique token
- Admin joins: `/join [token]`
- Messages are forwarded between user and admin
- Session auto-expires after 4 hours

## 📊 Data Files

All data stored in `data/` folder as JSON:

- `users.json` - User accounts
- `products.json` - Product catalog
- `categories.json` - Product categories
- `transactions.json` - Order history
- `sessions.json` - Support chat sessions
- `admins.json` - Admin & owner list
- `settings.json` - Store settings
- `templates.json` - Quick reply templates (30+ pre-loaded)
- `faqs.json` - Frequently asked questions (15+ pre-loaded)
- `feedbacks.json` - User feedback & ratings

## 🌐 Multi-Language Support

Bot supports:
- 🇲🇾 Bahasa Melayu (Default) - Full support
- 🇬🇧 English - Full support
- 🇨🇳 中文 (Mandarin) - Partial support (UI translations only)
- 🇮🇳 தமிழ் (Tamil) - Partial support (UI translations only)

**Note:** FAQ and Quick Reply templates are available in Malay and English only.

Users can toggle language from main menu.

## 📝 Complete Commands Reference

### User Commands
- `/start` - Start bot and show main menu
- `/send` - Upload payment proof (reply with photo)
- `/searchorder [order_id]` - Search specific order
- `/faq` - View FAQ list
- `/list` - View all available commands with buttons

### Admin Commands

**Order Management:**
- `/verify [order_id]` - Approve order
- `/reject [order_id]` - Reject order
- `/checkallorderid` - View all order IDs
- `/searchorder [query]` - Advanced search (ID/User/Status/Date)
- `/filterorders` - Filter orders by status

**Product Management:**
- `/addcategory [name]` - Add category
- `/addproduct [...]` - Add product (shows format)
- `/listproducts` - List all products
- `/duplicate [product_id]` - Duplicate product
- `/inventory [product_id]` - View inventory history
- `/adjuststock [product_id] [+/-num] [note]` - Adjust stock

**User Management:**
- `/ban [user_id] [reason]` - Ban user
- `/unban [user_id]` - Unban user
- `/tag [user_id] [tag]` - Tag user
- `/untag [user_id] [tag]` - Remove user tag
- `/bannedlist` - List banned users

**Quick Reply & FAQ:**
- `/addtemplate [keyword] | [response]` - Add quick reply template
- `/qt [keyword]` - Use quick template
- `/templates` - List all templates
- `/deletetemplate [keyword]` - Delete template
- `/addfaq [question] | [answer]` - Add FAQ
- `/listfaqs` - List all FAQs
- `/deletefaq [faq_id]` - Delete FAQ

**Support & Communication:**
- `/join [token]` - Join support session
- `/leave` - Leave current session
- `/close` - Close support session
- `/feedbacks` - View user feedbacks

**Other:**
- `/currency` - Change store currency
- `/list` - View all commands

### Owner Commands
- `/setowner` - Set yourself as owner
- `/addadmin [user_id]` - Add admin
- `/removeadmin [user_id]` - Remove admin

## ✨ Pre-loaded Features

### 14 FAQs Included:
1. How to place order
2. Payment methods
3. Delivery time
4. Contact admin
5. Refund policy
6. Available products
7. Order status
8. Safety & security
9. Language settings
10. Warranty & guarantee
11. Gift purchases
12. Using /send command
13. Order rejection reasons
14. Viewing purchased items

### 30+ Templates Included:
- Welcome messages (MS/EN)
- Order received confirmations
- Processing notifications
- Payment reminders
- Stock availability updates
- Thank you messages
- Error handling responses
- Operating hours info
- Login instructions
- Help & support guides
- And more...

## 🎯 Advanced Features

### Auto-Reply System
- FAQ auto-response based on keywords
- Quick reply templates for admins
- Bilingual support for all responses

### Order Search & Filter
- Search by Order ID, User ID, Status, Date
- Advanced filtering options
- Export order history

### User Management
- Ban/unban users with reasons
- Tag system for user categorization
- Track user activity

### Session Management
- Live chat between users and admins
- Session tokens for secure access
- Auto-expiry after 4 hours
- Message history tracking

### Feedback System
- User ratings (1-5 stars)
- Comment collection
- Admin review dashboard

### Analytics (Owner Panel)
- Sales reports
- User statistics
- Product performance
- Revenue tracking

## 🛠️ Tech Stack

- Node.js
- Telegraf (Telegram Bot Framework)
- Dropbox API (Primary backup storage)
- Google Drive API (Secondary backup storage)
- PDFKit (Receipt generation)
- Sharp (Image processing)
- UUID (ID generation)
- Archiver (ZIP compression for backups)
- JSON file-based database

## 🔧 Maintenance & Updates

### 💾 Dual API Backup System

Bot ini dilengkapi dengan sistem backup dual API yang automatik! This bot includes an automatic dual API backup system!

#### 🚀 Automatic Backup Features:
- ⏱️ **Auto Backup setiap 20 saat** / Auto backup every 20 seconds
- ☁️ **Dual Cloud Storage**: Dropbox (Primary) + Google Drive (Secondary)
- 🔄 **Auto-Failover**: Automatic switch when storage is full
- 📥 **Auto-Restore**: Load new data from cloud automatically
- 💪 **No Data Loss**: Always backed up to available storage

#### 📋 How It Works:

1. **Primary Storage (Dropbox)**:
   - System uploads backups to Dropbox every 20 seconds
   - Automatically checks for new data and restores it
   - Creates ZIP archives of all data files

2. **Automatic Failover**:
   - If Dropbox storage is full, system automatically detects it
   - Switches to Google Drive (secondary storage) immediately
   - Logs: `🔄 FAILOVER: Switched from dropbox to googleDrive`
   - Continues backing up without interruption

3. **Active Provider Tracking**:
   - Current active provider saved in `data/backup/sync_state.json`
   - Check which provider is active: `cat data/backup/sync_state.json`
   - Shows: `"activeProvider": "dropbox"` or `"googleDrive"`

#### ⚙️ Configuration:

**Dropbox Setup** (Primary):
```javascript
// config.js
DROPBOX_TOKEN: 'your_dropbox_token_here'
```

**Google Drive Setup** (Secondary):
```bash
# Set environment variable or add to config
export GOOGLE_DRIVE_TOKEN='your_google_drive_token_here'
```

To get Google Drive token:
1. Go to Google Cloud Console
2. Enable Google Drive API
3. Create OAuth 2.0 credentials
4. Get access token

#### 📊 Backup Logs:

View backup activity:
```bash
cat data/backup/backup.log
```

Log format:
```
[2025-10-10 19:07:23] UPLOAD (dropbox): backup-xxx.zip → /backups/backup-xxx.zip
[2025-10-10 19:07:25] DOWNLOAD (dropbox): /backups/backup-xxx.zip → local
[2025-10-10 19:07:26] RESTORE: backup-xxx.zip
```

#### 🔧 Manual Backup:

Owner can trigger manual backup:
```
/backupnow
```

#### 🛡️ Storage Full Protection:

When Dropbox is full:
1. ❌ System detects: `insufficient_space` error
2. 🔄 Auto-switches to Google Drive
3. ✅ Backup continues on Google Drive
4. 📝 Updates `activeProvider` in sync_state.json
5. 🎉 No data loss!

#### 📁 Backup Files Location:

- Local: `./data/backup/backup-*.zip`
- Dropbox: `/backups/backup-*.zip`
- Google Drive: `/backups/backup-*.zip`

### Backup Data
All data files in `data/` folder are automatically backed up every 20 seconds to cloud storage with dual API failover protection.

### Adding New FAQs
```
/addfaq How to reset password? | Contact admin via Support to reset your password
```

### Adding New Templates
```
/addtemplate reset | To reset your password, please contact admin via Support
```

## 📱 User Interface

### Main Menu Buttons:
- 🛍️ Buy Products
- 📋 My Orders / 📦 My Items
- 💬 Support
- 📋 Search Order / ❓ FAQ
- 📖 Guide
- 🌐 Language
- (Admin Panel - for admins)
- (Owner Panel - for owner)

### Command List (/list):
- For Users: Interactive buttons for all features + Back button
- For Admins/Owner: Complete text list of all commands

## 🚀 Next Features (Roadmap)

- Reward points system
- Voucher/promo codes
- Product reviews & ratings
- Advanced statistics & reports
- Wishlist functionality
- Automated backup scheduling
- Broadcast scheduling
- Multi-admin chat sessions
- Product bundles & packages
- Subscription management

## 📞 Support

For issues or questions:
1. Use the in-bot Support feature
2. Check FAQ section
3. Review the User Guide
4. Contact bot owner/admin

---

**CexiStore Ultimate Pro** - Your complete digital store solution on Telegram! 🚀

Built with ❤️ for seamless e-commerce experience.
