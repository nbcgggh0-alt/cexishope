const { getDiscountedPrice } = require('./categoryDiscounts'); // Import helper
const { Markup } = require('telegraf');
const db = require('../utils/database');
const { t } = require('../utils/translations');
const { generateOrderId, generateSessionToken, isSessionExpired } = require('../utils/helpers');
const { safeEditMessage } = require('../utils/messageHelper');
const { setAwaitingProof } = require('./paymentProof');
const { getPriceDisplay, convertPrice, formatPrice } = require('../utils/currencyHelper');
const fs = require('fs').promises;
const path = require('path');
const { escapeMarkdown } = require('../utils/security'); // Security Utils
const config = require('../config');

async function handleBuyProducts(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const categories = await db.getCategories();

  if (categories.length === 0) {
    const message = lang === 'ms'
      ? '❌ Tiada kategori produk ditemui.'
      : '❌ No product categories found.';
    await safeEditMessage(ctx, message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t('btnBack', lang), 'main_menu')]
      ])
    });
    return;
  }

  const buttons = [];
  categories.forEach(cat => {
    const catName = typeof cat.name === 'object'
      ? (cat.name[lang] || cat.name['ms'] || cat.name['en'] || 'Unknown')
      : cat.name;
    buttons.push([Markup.button.callback(catName, `cat_${cat.id}`)]);
  });
  buttons.push([Markup.button.callback(t('btnBack', lang), 'main_menu')]);

  const message = lang === 'ms'
    ? '📂 *Pilih Kategori Produk:*'
    : '📂 *Select Product Category:*';

  await safeEditMessage(ctx, message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

const PRODUCTS_PER_PAGE = 5;

async function handleCategory(ctx, categoryId, page = 0) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const userCurrency = user?.currency || 'MYR';

  const category = (await db.getCategories()).find(c => c.id === categoryId);
  if (!category) {
    await ctx.answerCbQuery('Category not found');
    return;
  }

  const allProducts = await db.getProducts();
  // Filter active products in this category
  const products = allProducts.filter(p => p.categoryId === categoryId && p.active && p.stock > 0);

  const catName = typeof category.name === 'object'
    ? (category.name[lang] || category.name['ms'] || category.name['en'] || 'Unknown')
    : category.name;

  if (products.length === 0) {
    const message = lang === 'ms'
      ? `📂 Kategori: *${catName}*\n\n❌ Tiada produk tersedia dalam kategori ini.`
      : `📂 Category: *${catName}*\n\n❌ No products available in this category.`;

    await safeEditMessage(ctx, message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t('btnBack', lang), 'buy_products')]
      ])
    });
    return;
  }

  // Pagination
  const totalPages = Math.ceil(products.length / PRODUCTS_PER_PAGE);
  const currentPage = Math.max(0, Math.min(page, totalPages - 1));
  const start = currentPage * PRODUCTS_PER_PAGE;
  const pageProducts = products.slice(start, start + PRODUCTS_PER_PAGE);

  const pageInfo = totalPages > 1
    ? (lang === 'ms'
      ? ` (Halaman ${currentPage + 1}/${totalPages})`
      : ` (Page ${currentPage + 1}/${totalPages})`)
    : '';

  // Generate product list message
  let message = lang === 'ms'
    ? `📂 Kategori: *${catName}*${pageInfo}\n\nSilih pilih produk:\n\n`
    : `📂 Category: *${catName}*${pageInfo}\n\nPlease select a product:\n\n`;

  const buttons = [];

  // Calculate discounts for display
  const { getDiscountedPrice } = require('./categoryDiscounts');
  const categories = await db.getCategories();

  for (const product of pageProducts) {
    const priceDisplay = await getPriceDisplay(product.price, userCurrency);
    const discountedPrice = getDiscountedPrice(product, categories);

    let priceLabel = priceDisplay;
    if (discountedPrice < product.price) {
      const discountedDisplay = await getPriceDisplay(discountedPrice, userCurrency);
      priceLabel = `${discountedDisplay} 🔥`;
    }

    // Add button: Product Name - Price
    buttons.push([Markup.button.callback(
      `${product.name[lang] || product.name['ms']} - ${priceLabel}`,
      `prod_${product.id}`
    )]);
  }

  // Pagination navigation row
  if (totalPages > 1) {
    const navRow = [];
    if (currentPage > 0) {
      navRow.push(Markup.button.callback(
        lang === 'ms' ? '◀ Sebelum' : '◀ Prev',
        `catpage_${categoryId}_${currentPage - 1}`
      ));
    }
    navRow.push(Markup.button.callback(
      `${currentPage + 1}/${totalPages}`,
      `catpage_${categoryId}_${currentPage}`
    ));
    if (currentPage < totalPages - 1) {
      navRow.push(Markup.button.callback(
        lang === 'ms' ? 'Seterus ▶' : 'Next ▶',
        `catpage_${categoryId}_${currentPage + 1}`
      ));
    }
    buttons.push(navRow);
  }

  buttons.push([Markup.button.callback(t('btnBack', lang), 'buy_products')]);

  await safeEditMessage(ctx, message, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}


// ...

async function handleProductView(ctx, productId) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const userCurrency = user?.currency || 'MYR';

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    await ctx.answerCbQuery('Product not found');
    return;
  }

  const categories = await db.getCategories(); // Fetch categories
  const discountedPrice = getDiscountedPrice(product, categories); // Calculate discount

  const stockStatus = product.stock < 5
    ? (lang === 'ms' ? '⚠️ Stok terhad!' : '⚠️ Limited stock!')
    : (lang === 'ms' ? '✅ Tersedia' : '✅ Available');

  const priceDisplay = await getPriceDisplay(product.price, userCurrency);

  let priceText = priceDisplay;
  if (discountedPrice < product.price) {
    const discountedDisplay = await getPriceDisplay(discountedPrice, userCurrency);
    priceText = `~${priceDisplay}~ *${discountedDisplay}* 🔥`;
  }

  const name = product.name ? (product.name[lang] || product.name['ms'] || 'Unknown Product') : 'Unknown Product';
  const desc = product.description ? (product.description[lang] || product.description['ms'] || '') : '';

  const safeProductName = escapeMarkdown(name);
  const safeDescription = escapeMarkdown(desc);
  const safeProductId = escapeMarkdown(product.id);

  const text = lang === 'ms'
    ? `📦 *${safeProductName}*\n\n` +
    `💰 *Harga:* ${priceText}\n` +
    `📊 *Stok:* ${product.stock} unit - ${stockStatus}\n` +
    `🔄 *Jenis:* ${product.deliveryType === 'auto' ? 'Auto Delivery' : 'Manual Delivery'}\n\n` +
    `📝 *Penerangan:*\n${safeDescription}\n\n` +
    `🆔 ID: \`${safeProductId}\``
    : `📦 *${safeProductName}*\n\n` +
    `💰 *Price:* ${priceText}\n` +
    `📊 *Stock:* ${product.stock} units - ${stockStatus}\n` +
    `🔄 *Type:* ${product.deliveryType === 'auto' ? 'Auto Delivery' : 'Manual Delivery'}\n\n` +
    `📝 *Description:*\n${safeDescription}\n\n` +
    `🆔 ID: \`${safeProductId}\``;

  const buttons = [
    [Markup.button.callback(t('btnBuyNow', lang), `buy_${productId}`)],
    [Markup.button.callback(t('btnBack', lang), `cat_${product.categoryId}`)]
  ];

  // ... rest of image handling matches original ...
  const hasImage = product.images && product.images.length > 0;

  if (hasImage) {
    try {
      const firstImage = product.images[0];
      const imageId = typeof firstImage === 'object' ? firstImage.fileId : firstImage;

      try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }

      await ctx.replyWithPhoto(imageId, {
        caption: text,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
      return;
    } catch (imgError) {
      console.error('Failed to send product image:', imgError.message);
    }
  }

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleBuyProduct(ctx, productId) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const userCurrency = user?.currency || 'MYR';

  const settings = await db.getSettings();
  const isStoreOpen = settings.storeOpen !== false;

  if (!isStoreOpen) {
    const message = lang === 'en'
      ? '🔴 *Store is Currently Closed*\n\nSorry, the store is not accepting orders at the moment. Please try again later.'
      : '🔴 *Kedai Sedang Tutup*\n\nMaaf, kedai tidak menerima pesanan buat masa ini. Sila cuba lagi kemudian.';
    await ctx.answerCbQuery(lang === 'en' ? 'Store is closed' : 'Kedai tutup');
    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product || product.stock <= 0) {
    await ctx.answerCbQuery('Product not available');
    return;
  }

  if (!product.price || isNaN(product.price) || product.price <= 0) {
    const errorMsg = lang === 'ms'
      ? '❌ Harga produk tidak sah. Sila hubungi admin.'
      : '❌ Invalid product price. Please contact admin.';
    await ctx.reply(errorMsg);
    return;
  }

  // Calculate category discount first
  const productPrice = parseFloat(product.price);
  const categories = await db.getCategories();
  const discountedPrice = getDiscountedPrice(product, categories);

  // Preview voucher discount (on top of category discount)
  const { applyVoucherToOrder } = require('./voucher');
  const voucherResult = await applyVoucherToOrder(userId, discountedPrice);
  const finalAmount = voucherResult.finalAmount || discountedPrice;
  const voucherDiscount = voucherResult.discount || 0;
  const categoryDiscountDisplay = await getPriceDisplay(productPrice - discountedPrice, userCurrency);

  const priceDisplay = await getPriceDisplay(productPrice, userCurrency);
  const finalAmountDisplay = await getPriceDisplay(finalAmount, userCurrency);

  const safeProductName = escapeMarkdown(product.name[lang] || product.name['ms']);

  let confirmText = lang === 'ms'
    ? `📋 *Sahkan Pesanan Anda*\n\n` +
    `📦 Produk: ${safeProductName}\n` +
    `💰 Harga: ${priceDisplay}\n`
    : `📋 *Confirm Your Order*\n\n` +
    `📦 Product: ${safeProductName}\n` +
    `💰 Price: ${priceDisplay}\n`;

  if (productPrice > discountedPrice) {
    confirmText += lang === 'ms'
      ? `🏷️ Diskaun Kategori: -${categoryDiscountDisplay}\n`
      : `🏷️ Category Discount: -${categoryDiscountDisplay}\n`;
  }

  if (voucherResult.voucherCode && voucherDiscount > 0) {
    const discountPct = voucherResult.discountPercentage || 0;
    // Calculate approximate discount in user currency for display
    const discountDisplay = await getPriceDisplay(discount, userCurrency);

    confirmText += lang === 'ms'
      ? `🎫 Baucher: ${voucherResult.voucherCode} (-${discountPct}%)\n` +
      `🎉 Diskaun: -${discountDisplay}\n` +
      `✅ Jumlah Akhir: *${finalAmountDisplay}*\n`
      : `🎫 Voucher: ${voucherResult.voucherCode} (-${discountPct}%)\n` +
      `🎉 Discount: -${discountDisplay}\n` +
      `✅ Final Total: *${finalAmountDisplay}*\n`;
  }

  confirmText += lang === 'ms'
    ? `\n📊 Stok: ${product.stock} unit\n\n⚠️ Tekan *Sahkan & Bayar* untuk buat pesanan.`
    : `\n📊 Stock: ${product.stock} units\n\n⚠️ Press *Confirm & Pay* to place your order.`;

  const buttons = [
    [Markup.button.callback(
      lang === 'ms' ? '✅ Sahkan & Bayar' : '✅ Confirm & Pay',
      `confirmbuy_${productId}`
    )],
    [Markup.button.callback(
      lang === 'ms' ? '❌ Batal' : '❌ Cancel',
      `prod_${productId}`
    )]
  ];

  await safeEditMessage(ctx, confirmText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

// Wrapper for error handling
async function handleConfirmBuy(ctx, productId) {
  try {
    const userId = ctx.from?.id;
    if (!userId) throw new Error("User ID missing");

    await _handleConfirmBuyInternal(ctx, productId);
  } catch (error) {
    console.error('CRITICAL ERROR during order:', error);

    // Attempt to notify user
    try {
      const userId = ctx.from?.id;
      const user = userId ? await db.getUser(userId) : null;
      const lang = user?.language || 'ms';

      const msg = lang === 'ms'
        ? `❌ Ralat Sistem: ${error.message}\nSila lapor kod error ini kepada admin.`
        : `❌ System Error: ${error.message}\nPlease report this error code to admin.`;

      await ctx.reply(msg);
    } catch (err2) {
      console.error('Failed to send error message:', err2);
      await ctx.reply('❌ Critical System Error. Please contact admin.');
    }
  }
}

// Original logic moved here
async function _handleConfirmBuyInternal(ctx, productId) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const userCurrency = user?.currency || 'MYR';

  const settings = await db.getSettings();
  const isStoreOpen = settings.storeOpen !== false;

  if (!isStoreOpen) {
    await ctx.answerCbQuery(lang === 'en' ? 'Store is closed' : 'Kedai tutup');
    return;
  }

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product || product.stock <= 0) {
    await ctx.answerCbQuery('Product not available');
    return;
  }

  if (!product.price || isNaN(product.price) || product.price <= 0) {
    const errorMsg = lang === 'ms'
      ? '❌ Harga produk tidak sah. Sila hubungi admin.'
      : '❌ Invalid product price. Please contact admin.';
    await ctx.reply(errorMsg);
    return;
  }

  // Duplicate purchase guard REMOVED by request to allow multiple orders
  // Old code block: lines 373-400 deleted

  // Calculate category discount first
  const productPrice = parseFloat(product.price);
  const categories = await db.getCategories();
  const discountedPrice = getDiscountedPrice(product, categories);

  const { applyVoucherToOrder } = require('./voucher');
  const voucherResult = await applyVoucherToOrder(userId, discountedPrice, true); // Consume voucher

  const finalAmount = voucherResult.finalAmount || discountedPrice;
  const voucherDiscount = voucherResult.discount || 0;
  const totalDiscount = (productPrice - discountedPrice) + voucherDiscount;

  const orderId = generateOrderId();

  // Calculate prices in user currency for record keeping
  const rate = await convertPrice(1, userCurrency);
  const priceInUserCurrency = await convertPrice(finalAmount, userCurrency);

  const newTransaction = {
    id: orderId,
    userId: userId,
    productId: productId,
    productName: product.name,
    originalPrice: productPrice, // Store original price before any discount
    price: finalAmount,
    currency: userCurrency, // Store the currency used
    exchangeRate: rate,     // Store the rate used
    priceInUserCurrency: priceInUserCurrency, // Store the calculated amount
    discount: totalDiscount,
    voucherCode: voucherResult.voucherCode || null,
    discountPercentage: voucherResult.discountPercentage || 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
    paymentProof: null,
    deliveredItem: null
  };

  await db.addTransaction(newTransaction);

  const queueManager = require('../utils/queueManager');


  // Optimize: Get only active session for user
  let activeSession = await db.getActiveSessionByUserId(userId);

  if (activeSession && isSessionExpired(activeSession.createdAt)) {
    activeSession.status = 'expired';
    activeSession.endedAt = new Date().toISOString();
    await db.saveSession(activeSession);
    activeSession = null;
  }

  let sessionToken;
  if (!activeSession) {
    sessionToken = generateSessionToken();

    const newSession = {
      token: sessionToken,
      userId: userId,
      adminId: null,
      status: 'active',
      createdAt: new Date().toISOString(),
      messages: []
    };

    await db.saveSession(newSession);
  } else {
    sessionToken = activeSession.token;
  }


  let voucherInfo = '';
  const finalAmountDisplay = await getPriceDisplay(finalAmount, userCurrency);
  const originalPriceDisplay = await getPriceDisplay(product.price, userCurrency);
  const categoryDiscountAmount = productPrice - discountedPrice;
  const categoryDiscountDisplay = await getPriceDisplay(categoryDiscountAmount, userCurrency);

  if (voucherResult.voucherCode && voucherDiscount > 0) {
    const discountPct = voucherResult.discountPercentage || 0;
    const discountDisplay = await getPriceDisplay(voucherDiscount, userCurrency);

    voucherInfo = lang === 'ms'
      ? `\n\n🎫 *Baucher Digunakan!*\n💳 Kod: ${voucherResult.voucherCode}\n💰 Harga Asal: ${originalPriceDisplay}\nLabels Diskaun Kategori: -${categoryDiscountDisplay}\n🎉 Diskaun Baucher ${discountPct}%: -${discountDisplay}\n✅ Harga Akhir: ${finalAmountDisplay}`
      : `\n\n🎫 *Voucher Applied!*\n💳 Code: ${voucherResult.voucherCode}\n💰 Original Price: ${originalPriceDisplay}\nLabels Category Discount: -${categoryDiscountDisplay}\n🎉 Voucher Discount ${discountPct}%: -${discountDisplay}\n✅ Final Price: ${finalAmountDisplay}`;
  } else if (productPrice > discountedPrice) {
    voucherInfo = lang === 'ms'
      ? `\n\n🏷️ *Diskaun Kategori Digunakan!*\n💰 Harga Asal: ${originalPriceDisplay}\n🎉 Diskaun: -${categoryDiscountDisplay}\n✅ Harga Akhir: ${finalAmountDisplay}`
      : `\n\n🏷️ *Category Discount Applied!*\n💰 Original Price: ${originalPriceDisplay}\n🎉 Discount: -${categoryDiscountDisplay}\n✅ Final Price: ${finalAmountDisplay}`;
  }

  const safeProductName = escapeMarkdown(product.name.ms || product.name.en || 'Product');
  const safeOrderId = escapeMarkdown(orderId);

  const orderMessage = lang === 'ms'
    ? `✅ *Order Dibuat!*\n\n🆔 ID Order: \`${safeOrderId}\`\n📦 Produk: ${safeProductName}\n💰 Harga: ${finalAmountDisplay}${voucherInfo}\n\n*Sila pilih kaedah pembayaran:*`
    : `✅ *Order Created!*\n\n🆔 Order ID: \`${safeOrderId}\`\n📦 Product: ${safeProductName}\n💰 Price: ${finalAmountDisplay}${voucherInfo}\n\n*Please select payment method:*`;

  const buttons = [
    [Markup.button.callback('🇲🇾 Touch \'n Go / DuitNow (Malaysia)', `paymethod_tng_${orderId}`)],
    [Markup.button.callback('🇮🇩 QRIS / DANA (Indonesia)', `paymethod_qris_${orderId}`)],
    [Markup.button.callback(lang === 'ms' ? '💬 Chat via Telegram' : '💬 Chat via Telegram', 'support')],
    [Markup.button.callback(t('btnHome', lang), 'main_menu')]
  ];

  await ctx.reply(orderMessage, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });

  // Prompt for payment proof upload
  setAwaitingProof(userId, orderId);

  const proofPrompt = lang === 'ms'
    ? `📸 *Muat Naik Bukti Pembayaran*\n\n📷 Sila hantar gambar/tangkap skrin resit pembayaran anda sekarang.\n\n_Hantar gambar untuk muat naik bukti._`
    : `📸 *Upload Payment Proof*\n\n📷 Please send a photo/screenshot of your payment receipt now.\n\n_Send a photo to upload proof._`;

  await ctx.reply(proofPrompt, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(
        lang === 'ms' ? '❌ Langkau — saya akan chat admin' : '❌ Skip — I\'ll chat admin',
        `skipproof_${orderId}`
      )]
    ])
  });

  // Admin notification section - wrapped in try-catch so order still succeeds even if notification fails
  try {
    const admins = await db.getAdmins();
    const allAdmins = [admins.owner, ...admins.admins].filter(Boolean);
    const sessions = await db.getSessions();
    const activeSessions = sessions.filter(s => s.status === 'active' && s.adminId !== null);
    const busyAdminIds = new Set(activeSessions.map(s => s.adminId));
    const busyAdmins = busyAdminIds.size;

    const productName = typeof product.name === 'object'
      ? (product.name[lang] || product.name.ms)
      : product.name;

    if (busyAdmins >= allAdmins.length) {
      const queueResult = await queueManager.addToQueue(orderId, userId, productName, 'normal');

      if (queueResult.success) {
        const stats = await queueManager.getQueueStats();
        const position = queueResult.position;
        const estimatedTime = queueManager.formatEstimatedTime(queueResult.queueItem.estimatedCompletion);

        const queueMessage = lang === 'ms'
          ? `⏳ *Antrian Order*\n\n` +
          `Semua admin sedang sibuk melayani customer lain.\n\n` +
          `📋 Posisi anda: *${position}*\n` +
          `👥 Dalam antrian: ${stats.waiting} order\n` +
          `⚙️ Sedang diproses: ${stats.processing} order\n` +
          `⏰ Anggaran masa: ${estimatedTime}\n\n` +
          `✅ Kami akan notify anda bila giliran anda tiba!\n` +
          `💬 Anda masih boleh chat dengan support untuk pertanyaan.`
          : `⏳ *Order Queue*\n\n` +
          `All admins are currently busy serving other customers.\n\n` +
          `📋 Your position: *${position}*\n` +
          `👥 In queue: ${stats.waiting} orders\n` +
          `⚙️ Processing: ${stats.processing} orders\n` +
          `⏰ Estimated time: ${estimatedTime}\n\n` +
          `✅ We will notify you when it's your turn!\n` +
          `💬 You can still chat with support for questions.`;

        await ctx.reply(queueMessage, { parse_mode: 'Markdown' });

        for (const adminId of allAdmins) {
          try {
            await ctx.telegram.sendMessage(
              adminId,
              `📋 *Order Masuk Antrian*\n\n` +
              `🆔 Order: \`${orderId}\`\n` +
              `📦 Produk: ${productName}\n` +
              `👤 Customer: ${userId}\n` +
              `📊 Posisi: #${position}\n` +
              `⏳ Total antrian: ${stats.waiting}`,
              { parse_mode: 'Markdown' }
            );
          } catch (notifyError) {
            console.error(`Failed to notify admin ${adminId}:`, notifyError.message);
          }
        }
      }
    } else {
      await notifyAdmins(ctx, orderId, product, userId, sessionToken);
    }
  } catch (adminNotifyError) {
    console.error('Error in admin notification section:', adminNotifyError.message);
    console.error('Stack:', adminNotifyError.stack);
    // Order is already created - don't crash the user experience
  }
}

async function notifyAdmins(ctx, orderId, product, userId, sessionToken) {
  try {
    const admins = await db.getAdmins();
    const allAdmins = [admins.owner, ...admins.admins].filter(Boolean);

    if (allAdmins.length === 0) {
      console.warn('No admins to notify for order:', orderId);
      return;
    }

    const transactions = await db.getTransactions();
    const transaction = transactions.find(t => t.id === orderId);

    // Safe number formatting helper
    const safePrice = (val) => {
      const num = parseFloat(val);
      return isNaN(num) ? '0.00' : num.toFixed(2);
    };

    let priceInfo;
    if (transaction && parseFloat(transaction.discount) > 0) {
      priceInfo = `Original Price: RM${safePrice(transaction.originalPrice)}\nTotal Discount: -RM${safePrice(transaction.discount)}\nFinal Price: RM${safePrice(transaction.price)}`;
      if (transaction.voucherCode) {
        priceInfo += `\n(Includes Voucher: ${transaction.voucherCode})`;
      }
    } else {
      priceInfo = `Price: RM${safePrice(product.price)}`;
    }

    const productNameStr = typeof product.name === 'object'
      ? (product.name.ms || product.name.en || 'Unknown')
      : (product.name || 'Unknown');

    const safeProductName = escapeMarkdown(productNameStr);
    const safeOrderId = escapeMarkdown(orderId);
    const safeSessionToken = escapeMarkdown(sessionToken);

    const message = `🔔 *New Order Alert*\n\nOrder ID: \`${safeOrderId}\`\nProduct: ${safeProductName}\n${priceInfo}\nCustomer ID: ${userId}\nSession Token: \`${safeSessionToken}\``;

    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback('💬 Join Session', `join_session_${sessionToken}`)],
      [Markup.button.callback('✅ Verify Order', `verify_order_${orderId}`)],
      [Markup.button.callback('❌ Reject Order', `reject_order_${orderId}`)]
    ]);

    for (const adminId of allAdmins) {
      try {
        await ctx.telegram.sendMessage(
          adminId,
          message,
          {
            parse_mode: 'Markdown',
            ...buttons
          }
        );
      } catch (error) {
        console.error(`Failed to notify admin ${adminId}:`, error.message);
      }
    }
  } catch (error) {
    console.error('notifyAdmins error:', error.message);
    console.error('Stack:', error.stack);
  }
}

async function handlePaymentMethodSelect(ctx, method, orderId) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const order = await db.getTransaction(orderId);
  if (!order || order.userId !== userId) {
    await ctx.answerCbQuery(lang === 'ms' ? '❌ Order tidak dijumpai' : '❌ Order not found');
    return;
  }

  // Save payment method to transaction
  await db.updateTransaction(orderId, { paymentMethod: method });

  // Load Settings
  const settings = await db.getSettings();
  const bank = settings.bankDetails;
  const qrCodes = settings.paymentQr || {};
  const customQrId = qrCodes[method];

  const methodName = method === 'tng' ? 'Touch \'n Go / DuitNow' : 'QRIS / DANA';
  const methodFlag = method === 'tng' ? '🇲🇾' : '🇮🇩';

  let caption = lang === 'ms'
    ? `${methodFlag} *Pembayaran ${methodName}*\n\n🆔 Order: \`${orderId}\`\n💰 Jumlah: RM${order.price}\n\n📱 Sila scan QR di bawah untuk membuat pembayaran.`
    : `${methodFlag} *${methodName} Payment*\n\n🆔 Order: \`${orderId}\`\n💰 Amount: RM${order.price}\n\n📱 Please scan the QR below to make payment.`;

  // Add Bank Details if available and relevant (for TnG/DuitNow usually implies bank transfer too)
  // Or should we always show bank details? 
  // TnG DuitNow is often linked to bank.
  if (bank && bank.accountNo && method === 'tng') {
    caption += lang === 'ms'
      ? `\n\n🏦 *Pindahan Bank / Manual:*\nBank: ${bank.bankName}\nNama: ${bank.holderName}\nNo. Akaun: \`${bank.accountNo}\``
      : `\n\n🏦 *Bank Transfer / Manual:*\nBank: ${bank.bankName}\nName: ${bank.holderName}\nAccount No: \`${bank.accountNo}\``;
  }

  caption += lang === 'ms'
    ? `\n\n📝 *Selepas bayar, tekan butang di bawah untuk hantar bukti pembayaran.*`
    : `\n\n📝 *After paying, press button below to upload payment proof.*`;

  await ctx.answerCbQuery();

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '📸 Hantar Bukti Pembayaran' : '📸 Upload Payment Proof', `uploadproof_${orderId}`)], // Add explicit upload button here
    [Markup.button.callback(lang === 'ms' ? '📦 Lihat Order Saya' : '📦 View My Orders', 'my_orders')],
    [Markup.button.callback(lang === 'ms' ? '💬 Chat dengan Admin' : '💬 Chat with Admin', 'support')],
    [Markup.button.callback(t('btnHome', lang), 'main_menu')]
  ];

  try {
    if (customQrId) {
      // Send using file_id from DB
      await ctx.replyWithPhoto(customQrId, {
        caption: caption,
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } else {
      // Fallback to local file
      const qrPaths = {
        tng: path.join(__dirname, '..', 'qr', 'tng-qr.jpg'),
        qris: path.join(__dirname, '..', 'qr', 'qris-qr.jpg')
      };
      const qrPath = qrPaths[method];

      if (await fs.access(qrPath).then(() => true).catch(() => false)) {
        await ctx.replyWithPhoto(
          { source: qrPath },
          {
            caption: caption,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
          }
        );
      } else {
        // No QR available (local or db) -> Show text only
        await ctx.reply(caption + (lang === 'ms' ? '\n\n⚠️ QR Code belum ditetapkan.' : '\n\n⚠️ QR Code not set yet.'), {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(buttons)
        });
      }
    }
  } catch (error) {
    console.error('Error showing payment QR:', error.message);
    await ctx.reply(
      lang === 'ms' ? '⚠️ Ralat memaparkan QR. Sila hubungi admin.' : '⚠️ Error showing QR. Please contact admin.',
      { parse_mode: 'Markdown' }
    );
  }
}

module.exports = {
  handleBuyProducts,
  handleCategory,
  handleProductView,
  handleBuyProduct,
  handleConfirmBuy,
  handlePaymentMethodSelect
};
