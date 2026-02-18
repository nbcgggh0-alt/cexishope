const { Markup } = require('telegraf');
const db = require('../utils/database');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');

const discountState = new Map();

// Helper: Parse duration string (e.g. "1h", "30m", "1d")
function parseDuration(input) {
  if (!input) return null;
  const regex = /^(\d+)([mhd])$/i;
  const match = input.match(regex);

  if (!match) return null;

  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();

  let multiplier = 0;
  switch (unit) {
    case 'm': multiplier = 60 * 1000; break;
    case 'h': multiplier = 60 * 60 * 1000; break;
    case 'd': multiplier = 24 * 60 * 60 * 1000; break;
  }

  return value * multiplier;
}

// Helper: Format remaining time
function formatRemaining(expiry) {
  if (!expiry) return '';
  const now = Date.now();
  if (now > expiry) return 'EXPIRED';

  const diff = expiry - now;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Helper: safely extract category name string
function getCatName(cat, lang = 'ms') {
  if (!cat || !cat.name) return 'Unknown';
  if (typeof cat.name === 'string') return cat.name;
  return cat.name[lang] || cat.name['ms'] || cat.name['en'] || 'Unknown';
}

// Helper: safely get icon
function getCatIcon(cat) {
  return cat?.icon || '📂';
}

async function handleCategoryDiscounts(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const categories = await db.getCategories();
  const categoriesWithDiscounts = categories.filter(c => c.discount);

  const text = lang === 'ms'
    ? `🏷️ *Diskaun Kategori*\n\n` +
    `📊 Kategori dengan diskaun: ${categoriesWithDiscounts.length}/${categories.length}\n\n` +
    (categoriesWithDiscounts.length > 0
      ? categoriesWithDiscounts.map(c => {
        const discountText = c.discount.type === 'percentage'
          ? `${c.discount.value}%`
          : `RM${c.discount.value}`;

        // Expiry check
        let expiryText = '';
        if (c.discount.expiry) {
          const remain = formatRemaining(c.discount.expiry);
          expiryText = remain === 'EXPIRED' ? ' (⚠️ Expired)' : ` (⏳ ${remain})`;
        }

        return `${getCatIcon(c)} *${getCatName(c, 'ms')}*\n   💰 Diskaun: ${discountText}${expiryText}`;
      }).join('\n\n')
      : '📭 Tiada diskaun kategori aktif') +
    `\n\nPilih kategori untuk urus diskaun:`
    : `🏷️ *Category Discounts*\n\n` +
    `📊 Categories with discounts: ${categoriesWithDiscounts.length}/${categories.length}\n\n` +
    (categoriesWithDiscounts.length > 0
      ? categoriesWithDiscounts.map(c => {
        const discountText = c.discount.type === 'percentage'
          ? `${c.discount.value}%`
          : `RM${c.discount.value}`;

        let expiryText = '';
        if (c.discount.expiry) {
          const remain = formatRemaining(c.discount.expiry);
          expiryText = remain === 'EXPIRED' ? ' (⚠️ Expired)' : ` (⏳ ${remain})`;
        }

        return `${getCatIcon(c)} *${getCatName(c, 'en')}*\n   💰 Discount: ${discountText}${expiryText}`;
      }).join('\n\n')
      : '📭 No active category discounts') +
    `\n\nSelect category to manage discount:`;

  const buttons = categories.map(c => {
    const hasDiscount = c.discount ? '🏷️ ' : '';
    return [Markup.button.callback(
      `${hasDiscount}${getCatIcon(c)} ${getCatName(c, 'ms')}`,
      `cat_disc_${c.id}`
    )];
  });

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'cat_management')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleCategoryDiscountDetail(ctx, categoryId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const categories = await db.getCategories();
  const category = categories.find(c => c.id === categoryId);

  if (!category) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Kategori tidak dijumpai' : 'Category not found');
    return;
  }

  const products = await db.getProducts();
  const categoryProducts = products.filter(p => p.categoryId === categoryId && p.active);

  // Check expiry for display
  let expiryDisplay = '';
  if (category.discount && category.discount.expiry) {
    const remain = formatRemaining(category.discount.expiry);
    expiryDisplay = remain === 'EXPIRED'
      ? `\n⚠️ Status: *Tamat Tempoh (Expired)*`
      : `\n⏳ Tamat: *${remain} lagi*`;
  }

  const text = lang === 'ms'
    ? `🏷️ *Diskaun: ${getCatIcon(category)} ${getCatName(category, 'ms')}*\n\n` +
    `📦 Produk dalam kategori: ${categoryProducts.length}\n\n` +
    (category.discount
      ? `✅ *Diskaun Aktif*\n` +
      `Jenis: ${category.discount.type === 'percentage' ? 'Peratusan' : 'Tetap'}\n` +
      `Nilai: ${category.discount.type === 'percentage' ? `${category.discount.value}%` : `RM${category.discount.value}`}` +
      `${expiryDisplay}\n\n` +
      `Semua ${categoryProducts.length} produk dalam kategori ini mendapat diskaun.`
      : `❌ *Tiada Diskaun*\n\nTambah diskaun untuk kategori ini.`) +
    `\n\nPilih tindakan:`
    : `🏷️ *Discount: ${getCatIcon(category)} ${getCatName(category, 'en')}*\n\n` +
    `📦 Products in category: ${categoryProducts.length}\n\n` +
    (category.discount
      ? `✅ *Active Discount*\n` +
      `Type: ${category.discount.type === 'percentage' ? 'Percentage' : 'Fixed'}\n` +
      `Value: ${category.discount.type === 'percentage' ? `${category.discount.value}%` : `RM${category.discount.value}`}` +
      `${expiryDisplay}\n\n` +
      `All ${categoryProducts.length} products in this category get discount.`
      : `❌ *No Discount*\n\nAdd discount for this category.`) +
    `\n\nChoose action:`;

  const buttons = [];

  if (category.discount) {
    buttons.push(
      [Markup.button.callback(lang === 'ms' ? '✏️ Edit Diskaun' : '✏️ Edit Discount', `cat_disc_edit_${categoryId}`)],
      [Markup.button.callback(lang === 'ms' ? '🗑️ Padam Diskaun' : '🗑️ Remove Discount', `cat_disc_remove_${categoryId}`)]
    );
  } else {
    buttons.push(
      [Markup.button.callback(lang === 'ms' ? '➕ Diskaun Peratusan' : '➕ Percentage Discount', `cat_disc_add_pct_${categoryId}`)],
      [Markup.button.callback(lang === 'ms' ? '➕ Diskaun Tetap' : '➕ Fixed Discount', `cat_disc_add_fix_${categoryId}`)]
    );
  }

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'category_discounts')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleAddCategoryDiscount(ctx, categoryId, type) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  // Initialize state with step 'value'
  discountState.set(adminId, { categoryId, type, step: 'value' });

  await ctx.answerCbQuery();
  await ctx.reply(
    lang === 'ms'
      ? `💰 *Tambah Diskaun ${type === 'percentage' ? 'Peratusan' : 'Tetap'}*\n\n` +
      (type === 'percentage'
        ? `Sila hantar peratusan diskaun (1-100)\nContoh: 10 untuk 10% off\nContoh: 25 untuk 25% off`
        : `Sila hantar nilai diskaun dalam RM\nContoh: 5 untuk RM5 off\nContoh: 10 untuk RM10 off`)
      : `💰 *Add ${type === 'percentage' ? 'Percentage' : 'Fixed'} Discount*\n\n` +
      (type === 'percentage'
        ? `Please send discount percentage (1-100)\nExample: 10 for 10% off\nExample: 25 for 25% off`
        : `Please send discount value in RM\nExample: 5 for RM5 off\nExample: 10 for RM10 off`),
    { parse_mode: 'Markdown' }
  );
}

async function processDiscountInput(ctx) {
  const userId = ctx.from.id;
  const state = discountState.get(userId);

  if (!state) return false;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  // --- STEP 1: VALUE ---
  if (state.step === 'value') {
    const value = parseFloat(ctx.message.text.trim());

    if (isNaN(value) || value <= 0) {
      await ctx.reply(lang === 'ms' ? '❌ Nilai tidak sah!' : '❌ Invalid value!');
      return true;
    }

    if (state.type === 'percentage' && value > 100) {
      await ctx.reply(lang === 'ms' ? '❌ Max 100%!' : '❌ Max 100%!');
      return true;
    }

    // Save temp value and move to step 2
    state.tempValue = value;
    state.step = 'expiry';
    discountState.set(userId, state); // Update state

    await ctx.reply(
      lang === 'ms'
        ? `⏳ *Tetapkan Tamat Tempoh?*\n\nMasukkan tempoh masa (contoh: \`1h\`, \`30m\`, \`1d\`).\n\nAtau balas **0** atau **no** untuk diskaun kekal (tiada expired).`
        : `⏳ *Set Expiry?*\n\nEnter duration (e.g. \`1h\`, \`30m\`, \`1d\`).\n\nOr reply **0** or **no** for permanent discount (no expiry).`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  // --- STEP 2: EXPIRY ---
  if (state.step === 'expiry') {
    const input = ctx.message.text.trim().toLowerCase();
    let expiry = null;

    if (input !== '0' && input !== 'no' && input !== 'none') {
      const duration = parseDuration(input);
      if (!duration) {
        await ctx.reply(lang === 'ms'
          ? '❌ Format salah! Guna format seperti `1h`, `30m`, `1d`.'
          : '❌ Invalid format! Use format like `1h`, `30m`, `1d`.'
        );
        return true;
      }
      // Calculate expiry timestamp
      expiry = Date.now() + duration;
    }

    const value = state.tempValue;
    const categories = await db.getCategories();
    const categoryIdx = categories.findIndex(c => c.id === state.categoryId);

    if (categoryIdx === -1) {
      discountState.delete(userId);
      await ctx.reply(lang === 'ms' ? '❌ Kategori hilang.' : '❌ Category missing.');
      return true;
    }

    // Save with expiry
    categories[categoryIdx].discount = {
      type: state.type,
      value: value,
      expiry: expiry
    };

    await db.saveCategories(categories);
    discountState.delete(userId);

    const discountText = state.type === 'percentage' ? `${value}%` : `RM${value}`;
    const expiryText = expiry
      ? (lang === 'ms' ? `\n⏳ Tamat: ${formatRemaining(expiry)}` : `\n⏳ Ends: ${formatRemaining(expiry)}`)
      : (lang === 'ms' ? '\n♾️ Tiada had masa' : '\n♾️ Permanent');

    await ctx.reply(
      lang === 'ms'
        ? `✅ *Diskaun Saved!*\n\n🏷️ Kategori: ${getCatName(categories[categoryIdx], 'ms')}\n💰 Diskaun: ${discountText}${expiryText}\n\nSemua produk dalam kategori ini kini mendapat diskaun.`
        : `✅ *Discount Saved!*\n\n🏷️ Category: ${getCatName(categories[categoryIdx], 'en')}\n💰 Discount: ${discountText}${expiryText}\n\nAll products in this category now get this discount.`,
      { parse_mode: 'Markdown' }
    );
    return true;
  }

  return false;
}

async function handleRemoveCategoryDiscount(ctx, categoryId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const categories = await db.getCategories();
  const categoryIdx = categories.findIndex(c => c.id === categoryId);

  if (categoryIdx === -1) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Kategori tidak dijumpai' : 'Category not found');
    return;
  }

  delete categories[categoryIdx].discount;
  await db.saveCategories(categories);

  await ctx.answerCbQuery(
    lang === 'ms'
      ? '✅ Diskaun dipadam'
      : '✅ Discount removed'
  );

  await handleCategoryDiscountDetail(ctx, categoryId);
}

function getDiscountedPrice(product, categories) {
  const category = categories.find(c => c.id === product.categoryId);

  if (!category || !category.discount) {
    return product.price;
  }

  // Expiry Check
  if (category.discount.expiry && Date.now() > category.discount.expiry) {
    return product.price; // Return original price if expired
  }

  if (category.discount.type === 'percentage') {
    return product.price * (1 - category.discount.value / 100);
  } else {
    return Math.max(0, product.price - category.discount.value);
  }
}

module.exports = {
  handleCategoryDiscounts,
  handleCategoryDiscountDetail,
  handleAddCategoryDiscount,
  processDiscountInput,
  handleRemoveCategoryDiscount,
  getDiscountedPrice
};
