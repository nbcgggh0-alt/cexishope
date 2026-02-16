const translations = {
  mainMenu: {
    en: '🏠 *Main Menu*\n\nWelcome to CexiStore! Choose an option below:',
    ms: '🏠 *Menu Utama*\n\nSelamat datang ke CexiStore! Pilih pilihan di bawah:',
    zh: '🏠 *主菜单*\n\n欢迎来到CexiStore！请选择以下选项：',
    ta: '🏠 *பிரதான மெனு*\n\nCexiStore க்கு வரவேற்கிறோம்! கீழே ஒரு விருப்பத்தை தேர்ந்தெடுக்கவும்:'
  },
  btnBuyProducts: {
    en: '🛒 Buy Products',
    ms: '🛒 Beli Produk',
    zh: '🛒 购买产品',
    ta: '🛒 தயாரிப்புகளை வாங்கவும்'
  },
  btnMyOrders: {
    en: '📦 My Orders',
    ms: '📦 Order Saya',
    zh: '📦 我的订单',
    ta: '📦 எனது ஆர்டர்கள்'
  },
  btnMyItems: {
    en: '🎁 My Items',
    ms: '🎁 Item Saya',
    zh: '🎁 我的物品',
    ta: '🎁 எனது பொருட்கள்'
  },
  btnSupport: {
    en: '💬 Live Chat Support',
    ms: '💬 Sokongan Live Chat',
    zh: '💬 在线客服支持',
    ta: '💬 நேரடி அரட்டை ஆதரவு'
  },
  btnLanguage: {
    en: '🌐 Language: English',
    ms: '🌐 Bahasa: Melayu',
    zh: '🌐 语言：中文',
    ta: '🌐 மொழி: தமிழ்'
  },
  btnAdminPanel: {
    en: '👨‍💼 Admin Panel',
    ms: '👨‍💼 Panel Admin',
    zh: '👨‍💼 管理面板',
    ta: '👨‍💼 நிர்வாக பேனல்'
  },
  btnOwnerPanel: {
    en: '👑 Owner Panel',
    ms: '👑 Panel Owner',
    zh: '👑 所有者面板',
    ta: '👑 உரிமையாளர் பேனல்'
  },
  btnBack: {
    en: '◀️ Back',
    ms: '◀️ Kembali',
    zh: '◀️ 返回',
    ta: '◀️ திரும்பு'
  },
  btnHome: {
    en: '🏠 Home',
    ms: '🏠 Utama',
    zh: '🏠 主页',
    ta: '🏠 முகப்பு'
  },
  selectCategory: {
    en: '📂 *Select Category*\n\nChoose a product category:',
    ms: '📂 *Pilih Kategori*\n\nPilih kategori produk:',
    zh: '📂 *选择类别*\n\n选择产品类别：',
    ta: '📂 *வகையைத் தேர்ந்தெடுக்கவும்*\n\nதயாரிப்பு வகையை தேர்ந்தெடுக்கவும்:'
  },
  noProducts: {
    en: '❌ No products available in this category.',
    ms: '❌ Tiada produk tersedia dalam kategori ini.',
    zh: '❌ 此类别中没有可用的产品。',
    ta: '❌ இந்த வகையில் தயாரிப்புகள் இல்லை.'
  },
  productDetail: {
    en: (name, price, stock, desc) => `🛍️ *${name}*\n\n💰 Price: RM ${price}\n📦 Stock: ${stock}\n\n📝 ${desc}`,
    ms: (name, price, stock, desc) => `🛍️ *${name}*\n\n💰 Harga: RM ${price}\n📦 Stok: ${stock}\n\n📝 ${desc}`
  },
  btnBuyNow: {
    en: '💳 Buy Now',
    ms: '💳 Beli Sekarang'
  },
  paymentQR: {
    en: '💳 *Payment*\n\nPlease scan the QR code above to make payment.\n\n📸 *How to send payment proof:*\n1. Take a screenshot of your payment receipt\n2. Reply to this message\n3. Attach the screenshot/photo\n4. Type: /send\n\n✅ Admin will verify within 5-10 minutes!',
    ms: '💳 *Pembayaran*\n\nSila imbas kod QR di atas untuk membuat pembayaran.\n\n📸 *Cara hantar bukti pembayaran:*\n1. Screenshot resit pembayaran anda\n2. Balas mesej ini\n3. Attach screenshot/gambar\n4. Taip: /send\n\n✅ Admin akan sahkan dalam 5-10 minit!'
  },
  orderCreated: {
    en: (orderId) => `✅ *Order Created Successfully!*\n\n🆔 Order ID: \`${orderId}\`\n\n💬 Need help? Click "Support" button or contact admin directly via Live Chat!`,
    ms: (orderId) => `✅ *Order Berjaya Dibuat!*\n\n🆔 ID Order: \`${orderId}\`\n\n💬 Perlu bantuan? Tekan butang "Sokongan" atau hubungi admin terus melalui Live Chat!`
  },
  paymentProofReceived: {
    en: '✅ Payment proof received! Admin will verify your payment shortly.',
    ms: '✅ Bukti pembayaran diterima! Admin akan sahkan pembayaran anda tidak lama lagi.'
  },
  noOrders: {
    en: '❌ You have no orders yet.',
    ms: '❌ Anda belum mempunyai sebarang order.'
  },
  myOrders: {
    en: '📦 *My Orders*\n\nYour order history:',
    ms: '📦 *Order Saya*\n\nSejarah pesanan anda:'
  },
  orderStatus: {
    pending: { en: '⏳ Pending', ms: '⏳ Menunggu' },
    paid: { en: '✅ Paid', ms: '✅ Dibayar' },
    completed: { en: '✅ Completed', ms: '✅ Selesai' },
    rejected: { en: '❌ Rejected', ms: '❌ Ditolak' }
  },
  adminPanel: {
    en: '👨‍💼 *Admin Panel*\n\nSelect an option:',
    ms: '👨‍💼 *Panel Admin*\n\nPilih pilihan:'
  },
  btnNewOrders: {
    en: '📥 New Orders',
    ms: '📥 Order Baru'
  },
  btnManageProducts: {
    en: '📦 Manage Products',
    ms: '📦 Urus Produk'
  },
  btnBroadcast: {
    en: '📢 Broadcast',
    ms: '📢 Siarkan'
  },
  btnActiveSessions: {
    en: '💬 Active Sessions',
    ms: '💬 Sesi Aktif'
  },
  ownerPanel: {
    en: '👑 *Owner Panel*\n\nSelect an option:',
    ms: '👑 *Panel Owner*\n\nPilih pilihan:'
  },
  btnManageAdmins: {
    en: '👥 Manage Admins',
    ms: '👥 Urus Admin'
  },
  btnStoreSettings: {
    en: '⚙️ Store Settings',
    ms: '⚙️ Tetapan Kedai'
  },
  btnBackup: {
    en: '💾 Backup & Restore',
    ms: '💾 Backup & Pulih'
  },
  unauthorized: {
    en: '❌ You are not authorized to access this feature.',
    ms: '❌ Anda tidak dibenarkan mengakses ciri ini.'
  },
  sessionCreated: {
    en: (token) => `💬 *Live Chat Session Created*\n\nSession Token: \`${token}\`\n\nAn admin will join shortly. Session will auto-expire in 4 hours.`,
    ms: (token) => `💬 *Sesi Live Chat Dibuat*\n\nToken Sesi: \`${token}\`\n\nAdmin akan join tidak lama lagi. Sesi akan tamat automatik dalam 4 jam.`
  },
  sessionEnded: {
    en: '✅ Chat session has ended.',
    ms: '✅ Sesi chat telah tamat.'
  },
  itemDelivered: {
    en: (item) => `🎁 *Your Digital Product*\n\n${item}\n\nThank you for your purchase!`,
    ms: (item) => `🎁 *Produk Digital Anda*\n\n${item}\n\nTerima kasih atas pembelian anda!`
  }
};

function t(key, lang = 'ms', ...args) {
  const translation = translations[key];
  if (!translation) return key;
  
  const text = translation[lang] || translation['ms'];
  
  if (typeof text === 'function') {
    return text(...args);
  }
  
  return text;
}

module.exports = { translations, t };
