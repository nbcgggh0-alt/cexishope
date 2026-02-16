const { Markup } = require('telegraf');
const db = require('../utils/database');
const { generateId } = require('../utils/helpers');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');

const scheduleState = new Map();

async function handleScheduledProducts(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const scheduledProducts = products.filter(p => p.scheduledPublish && new Date(p.scheduledPublish) > new Date());

  const text = lang === 'ms'
    ? `📅 *Penerbitan Berjadual*\n\n` +
    `📊 Produk berjadual: ${scheduledProducts.length}\n\n` +
    (scheduledProducts.length > 0
      ? scheduledProducts.map(p => {
        const publishDate = new Date(p.scheduledPublish);
        return `📦 *${p.name.ms}*\n` +
          `   Terbit: ${publishDate.toLocaleString('ms-MY')}\n` +
          `   Status semasa: ${p.active ? '✅ Aktif' : '❌ Tidak Aktif'}`;
      }).join('\n\n')
      : '📭 Tiada produk berjadual') +
    `\n\nProduk akan diterbitkan secara automatik pada tarikh yang ditetapkan.`
    : `📅 *Scheduled Publishing*\n\n` +
    `📊 Scheduled products: ${scheduledProducts.length}\n\n` +
    (scheduledProducts.length > 0
      ? scheduledProducts.map(p => {
        const publishDate = new Date(p.scheduledPublish);
        return `📦 *${p.name.en || p.name.ms}*\n` +
          `   Publish: ${publishDate.toLocaleString('en-US')}\n` +
          `   Current status: ${p.active ? '✅ Active' : '❌ Inactive'}`;
      }).join('\n\n')
      : '📭 No scheduled products') +
    `\n\nProducts will be automatically published on the scheduled date.`;

  const buttons = scheduledProducts.slice(0, 10).map(p => [
    Markup.button.callback(
      `${p.name.ms} - ${new Date(p.scheduledPublish).toLocaleDateString()}`,
      `sched_detail_${p.id}`
    )
  ]);

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleScheduleProduct(ctx, productId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Produk tidak dijumpai' : 'Product not found');
    return;
  }

  scheduleState.set(adminId, { productId, step: 'datetime' });

  await ctx.answerCbQuery();
  await ctx.reply(
    lang === 'ms'
      ? `📅 *Jadualkan Penerbitan Produk*\n\n` +
      `Produk: ${product.name.ms}\n\n` +
      `Sila hantar tarikh dan masa untuk terbitkan produk secara automatik.\n\n` +
      `Format: DD/MM/YYYY HH:MM\n` +
      `Contoh: 31/12/2025 23:59\n` +
      `Contoh: 15/11/2025 09:00`
      : `📅 *Schedule Product Publishing*\n\n` +
      `Product: ${product.name.en || product.name.ms}\n\n` +
      `Please send date and time to automatically publish the product.\n\n` +
      `Format: DD/MM/YYYY HH:MM\n` +
      `Example: 31/12/2025 23:59\n` +
      `Example: 15/11/2025 09:00`,
    { parse_mode: 'Markdown' }
  );
}

async function processScheduleInput(ctx) {
  const userId = ctx.from.id;
  const state = scheduleState.get(userId);

  if (!state) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const text = ctx.message.text.trim();

  const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/;
  const match = text.match(dateRegex);

  if (!match) {
    await ctx.reply(
      lang === 'ms'
        ? `❌ Format tarikh tidak sah!\n\nFormat: DD/MM/YYYY HH:MM\nContoh: 31/12/2025 23:59`
        : `❌ Invalid date format!\n\nFormat: DD/MM/YYYY HH:MM\nExample: 31/12/2025 23:59`
    );
    return;
  }

  const [, day, month, year, hour, minute] = match;
  const scheduledDate = new Date(year, month - 1, day, hour, minute);

  if (isNaN(scheduledDate.getTime())) {
    await ctx.reply(lang === 'ms' ? '❌ Tarikh tidak sah!' : '❌ Invalid date!');
    return;
  }

  if (scheduledDate <= new Date()) {
    await ctx.reply(
      lang === 'ms'
        ? '❌ Tarikh mesti pada masa hadapan!'
        : '❌ Date must be in the future!'
    );
    return;
  }

  const products = await db.getProducts();
  const productIdx = products.findIndex(p => p.id === state.productId);

  if (productIdx === -1) {
    scheduleState.delete(userId);
    await ctx.reply(lang === 'ms' ? '❌ Produk tidak dijumpai' : '❌ Product not found');
    return;
  }

  await db.updateProduct(state.productId, { scheduledPublish: scheduledDate.toISOString(), active: false });

  scheduleState.delete(userId);

  await ctx.reply(
    lang === 'ms'
      ? `✅ *Penerbitan dijadualkan!*\n\n` +
      `📦 Produk: ${products[productIdx].name.ms}\n` +
      `📅 Akan diterbitkan: ${scheduledDate.toLocaleString('ms-MY')}\n\n` +
      `Produk akan diaktifkan secara automatik pada masa yang ditetapkan.`
      : `✅ *Publishing scheduled!*\n\n` +
      `📦 Product: ${products[productIdx].name.en || products[productIdx].name.ms}\n` +
      `📅 Will be published: ${scheduledDate.toLocaleString('en-US')}\n\n` +
      `Product will be automatically activated at the scheduled time.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleCancelSchedule(ctx, productId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const productIdx = products.findIndex(p => p.id === productId);

  if (productIdx === -1) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Produk tidak dijumpai' : 'Product not found');
    return;
  }

  await db.updateProduct(productId, { scheduledPublish: null });

  await ctx.answerCbQuery(
    lang === 'ms'
      ? '✅ Jadual penerbitan dibatalkan'
      : '✅ Publishing schedule cancelled'
  );

  await handleScheduledProducts(ctx);
}

async function checkScheduledProducts(bot) {
  try {
    const products = await db.getProducts();
    const now = new Date();

    let publishedCount = 0;

    for (let i = 0; i < products.length; i++) {
      if (products[i].scheduledPublish) {
        const scheduledDate = new Date(products[i].scheduledPublish);

        if (scheduledDate <= now && !products[i].active) {
          await db.updateProduct(products[i].id, { active: true, scheduledPublish: null });
          publishedCount++;

          const admins = await db.getAdmins();
          const settings = await db.getSettings();
          const ownerId = admins.owner;

          if (ownerId) {
            try {
              await bot.telegram.sendMessage(
                ownerId,
                `📅 *Produk Diterbitkan Secara Automatik*\n\n` +
                `📦 ${products[i].name.ms}\n` +
                `💰 RM${products[i].price}\n\n` +
                `Produk telah diaktifkan mengikut jadual.`,
                { parse_mode: 'Markdown' }
              );
            } catch (err) {
              console.log('Could not notify owner:', err.message);
            }
          }
        }
      }
    }

    if (publishedCount > 0) {
      console.log(`✅ ${publishedCount} scheduled product(s) published`);
    }
  } catch (error) {
    console.error('Error checking scheduled products:', error);
  }
}

module.exports = {
  handleScheduledProducts,
  handleScheduleProduct,
  processScheduleInput,
  handleCancelSchedule,
  checkScheduledProducts
};
