const { Markup } = require('telegraf');
const db = require('../utils/database');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');

const quickEditState = new Map();

async function handleQuickEditMenu(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const text = lang === 'ms'
    ? `⚡ *Edit Pantas Produk*\n\n` +
    `Kemaskini produk dengan cepat tanpa perlu pergi ke menu edit penuh.\n\n` +
    `Pilih tindakan:`
    : `⚡ *Quick Edit Product*\n\n` +
    `Quickly update products without going through the full edit flow.\n\n` +
    `Choose action:`;

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '💰 Edit Harga' : '💰 Edit Price', 'qedit_price')],
    [Markup.button.callback(lang === 'ms' ? '📊 Edit Stok' : '📊 Edit Stock', 'qedit_stock')],
    [Markup.button.callback(lang === 'ms' ? '✏️ Edit Nama' : '✏️ Edit Name', 'qedit_name')],
    [Markup.button.callback(lang === 'ms' ? '📝 Edit Penerangan' : '📝 Edit Description', 'qedit_desc')],
    [Markup.button.callback(lang === 'ms' ? '🔄 Toggle Status' : '🔄 Toggle Status', 'qedit_toggle')],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleQuickEditAction(ctx, action) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  quickEditState.set(adminId, { action, step: 'product_id' });

  const prompts = {
    price: lang === 'ms'
      ? `💰 *Edit Harga Pantas*\n\nSila hantar ID produk dan harga baru:\n\nFormat: PROD-XXXXX | HARGA\nContoh: PROD-ABC123 | 25.50`
      : `💰 *Quick Edit Price*\n\nPlease send product ID and new price:\n\nFormat: PROD-XXXXX | PRICE\nExample: PROD-ABC123 | 25.50`,
    stock: lang === 'ms'
      ? `📊 *Edit Stok Pantas*\n\nSila hantar ID produk dan stok baru:\n\nFormat: PROD-XXXXX | STOK\nContoh: PROD-ABC123 | 100`
      : `📊 *Quick Edit Stock*\n\nPlease send product ID and new stock:\n\nFormat: PROD-XXXXX | STOCK\nExample: PROD-ABC123 | 100`,
    name: lang === 'ms'
      ? `✏️ *Edit Nama Pantas*\n\nSila hantar ID produk dan nama baru:\n\nFormat: PROD-XXXXX | Nama Melayu | Nama Inggeris\nContoh: PROD-ABC123 | Netflix Premium | Netflix Premium`
      : `✏️ *Quick Edit Name*\n\nPlease send product ID and new name:\n\nFormat: PROD-XXXXX | Malay Name | English Name\nExample: PROD-ABC123 | Netflix Premium | Netflix Premium`,
    desc: lang === 'ms'
      ? `📝 *Edit Penerangan Pantas*\n\nSila hantar ID produk dan penerangan baru:\n\nFormat: PROD-XXXXX | Penerangan Melayu | Penerangan Inggeris\nContoh: PROD-ABC123 | Akaun 1 bulan | 1 month account`
      : `📝 *Quick Edit Description*\n\nPlease send product ID and new description:\n\nFormat: PROD-XXXXX | Malay Description | English Description\nExample: PROD-ABC123 | Akaun 1 bulan | 1 month account`,
    toggle: lang === 'ms'
      ? `🔄 *Toggle Status Pantas*\n\nSila hantar ID produk untuk toggle status aktif/tidak aktif:\n\nFormat: PROD-XXXXX\nContoh: PROD-ABC123`
      : `🔄 *Quick Toggle Status*\n\nPlease send product ID to toggle active/inactive status:\n\nFormat: PROD-XXXXX\nExample: PROD-ABC123`
  };

  await ctx.answerCbQuery();
  await ctx.reply(prompts[action], { parse_mode: 'Markdown' });
}

async function processQuickEditInput(ctx) {
  const userId = ctx.from.id;
  const state = quickEditState.get(userId);

  if (!state) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const text = ctx.message.text.trim();

  const parts = text.split('|').map(p => p.trim());

  if (state.action === 'toggle') {
    if (!parts[0].startsWith('PROD-')) {
      await ctx.reply(
        lang === 'ms'
          ? `❌ Format tidak sah! Sila hantar ID produk sahaja.\nContoh: PROD-ABC123`
          : `❌ Invalid format! Please send product ID only.\nExample: PROD-ABC123`
      );
      return;
    }

    const products = await db.getProducts();
    const productIdx = products.findIndex(p => p.id === parts[0]);

    if (productIdx === -1) {
      await ctx.reply(lang === 'ms' ? '❌ Produk tidak dijumpai' : '❌ Product not found');
      return;
    }

    const product = products[productIdx];
    const newActive = !product.active;
    await db.updateProduct(product.id, { active: newActive });

    quickEditState.delete(userId);

    await ctx.reply(
      lang === 'ms'
        ? `✅ *Status dikemaskini!*\n\n` +
        `📦 ${product.name.ms}\n` +
        `Status: ${newActive ? '✅ Aktif' : '❌ Tidak Aktif'}`
        : `✅ *Status updated!*\n\n` +
        `📦 ${product.name.en || product.name.ms}\n` +
        `Status: ${newActive ? '✅ Active' : '❌ Inactive'}`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  if (state.action === 'price' && parts.length !== 2) {
    await ctx.reply(
      lang === 'ms'
        ? `❌ Format tidak sah!\n\nFormat: PROD-XXXXX | HARGA\nContoh: PROD-ABC123 | 25.50`
        : `❌ Invalid format!\n\nFormat: PROD-XXXXX | PRICE\nExample: PROD-ABC123 | 25.50`
    );
    return;
  }

  if (state.action === 'stock' && parts.length !== 2) {
    await ctx.reply(
      lang === 'ms'
        ? `❌ Format tidak sah!\n\nFormat: PROD-XXXXX | STOK\nContoh: PROD-ABC123 | 100`
        : `❌ Invalid format!\n\nFormat: PROD-XXXXX | STOCK\nExample: PROD-ABC123 | 100`
    );
    return;
  }

  if ((state.action === 'name' || state.action === 'desc') && parts.length !== 3) {
    await ctx.reply(
      lang === 'ms'
        ? `❌ Format tidak sah!\n\nFormat: PROD-XXXXX | Melayu | Inggeris`
        : `❌ Invalid format!\n\nFormat: PROD-XXXXX | Malay | English`
    );
    return;
  }

  const products = await db.getProducts();
  const productIdx = products.findIndex(p => p.id === parts[0]);

  if (productIdx === -1) {
    await ctx.reply(lang === 'ms' ? '❌ Produk tidak dijumpai' : '❌ Product not found');
    return;
  }

  let successMsg = '';
  const product = products[productIdx];
  let updates = {};

  switch (state.action) {
    case 'price':
      const price = parseFloat(parts[1]);
      if (isNaN(price) || price < 0) {
        await ctx.reply(lang === 'ms' ? '❌ Harga tidak sah!' : '❌ Invalid price!');
        return;
      }
      updates = { price };
      successMsg = lang === 'ms'
        ? `✅ *Harga dikemaskini!*\n\n📦 ${product.name.ms}\n💰 Harga baru: RM${price}`
        : `✅ *Price updated!*\n\n📦 ${product.name.en || product.name.ms}\n💰 New price: RM${price}`;
      break;

    case 'stock':
      const stock = parseInt(parts[1]);
      if (isNaN(stock) || stock < 0) {
        await ctx.reply(lang === 'ms' ? '❌ Stok tidak sah!' : '❌ Invalid stock!');
        return;
      }
      updates = { stock };
      successMsg = lang === 'ms'
        ? `✅ *Stok dikemaskini!*\n\n📦 ${product.name.ms}\n📊 Stok baru: ${stock}`
        : `✅ *Stock updated!*\n\n📦 ${product.name.en || product.name.ms}\n📊 New stock: ${stock}`;
      break;

    case 'name':
      updates = { name: { ms: parts[1], en: parts[2] } };
      successMsg = lang === 'ms'
        ? `✅ *Nama dikemaskini!*\n\n📦 Nama baru:\nMelayu: ${parts[1]}\nInggeris: ${parts[2]}`
        : `✅ *Name updated!*\n\n📦 New name:\nMalay: ${parts[1]}\nEnglish: ${parts[2]}`;
      break;

    case 'desc':
      updates = { description: { ms: parts[1], en: parts[2] } };
      successMsg = lang === 'ms'
        ? `✅ *Penerangan dikemaskini!*\n\n📦 ${product.name.ms}\n📝 Penerangan baru disimpan`
        : `✅ *Description updated!*\n\n📦 ${product.name.en || product.name.ms}\n📝 New description saved`;
      break;
  }

  await db.updateProduct(product.id, updates);
  quickEditState.delete(userId);

  await ctx.reply(successMsg, { parse_mode: 'Markdown' });
}

module.exports = {
  handleQuickEditMenu,
  handleQuickEditAction,
  processQuickEditInput
};
