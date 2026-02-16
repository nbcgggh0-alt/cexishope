const { Markup } = require('telegraf');
const db = require('../utils/database');
const { generateId } = require('../utils/helpers');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');

const optionEditState = new Map();

async function handleProductOptions(ctx, productId) {
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

  const options = product.options || [];

  const text = lang === 'ms'
    ? `🎨 *Pilihan Produk: ${product.name.ms}*\n\n` +
    `📋 Pilihan sedia ada: ${options.length}\n\n` +
    `Pilihan produk membolehkan pelanggan memilih varian seperti saiz, warna, dll.\n\n` +
    (options.length > 0
      ? options.map((opt, i) => `${i + 1}. *${opt.name.ms}*\n   Pilihan: ${opt.values.join(', ')}\n   ${opt.required ? '⚠️ Wajib' : '📌 Opsional'} | ${opt.priceModifier ? `+RM${opt.priceModifier}` : 'Tiada caj tambahan'}`).join('\n\n')
      : '📭 Tiada pilihan lagi') +
    `\n\nPilih tindakan:`
    : `🎨 *Product Options: ${product.name.en || product.name.ms}*\n\n` +
    `📋 Existing options: ${options.length}\n\n` +
    `Product options allow customers to select variants like size, color, etc.\n\n` +
    (options.length > 0
      ? options.map((opt, i) => `${i + 1}. *${opt.name.en || opt.name.ms}*\n   Values: ${opt.values.join(', ')}\n   ${opt.required ? '⚠️ Required' : '📌 Optional'} | ${opt.priceModifier ? `+RM${opt.priceModifier}` : 'No extra charge'}`).join('\n\n')
      : '📭 No options yet') +
    `\n\nChoose action:`;

  const buttons = [];

  options.forEach((opt, index) => {
    buttons.push([Markup.button.callback(
      `${opt.name.ms} - ${lang === 'ms' ? 'Edit/Padam' : 'Edit/Delete'}`,
      `opt_detail_${productId}_${index}`
    )]);
  });

  buttons.push(
    [Markup.button.callback(lang === 'ms' ? '➕ Tambah Pilihan' : '➕ Add Option', `opt_add_${productId}`)],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', `prod_detail_${productId}`)]
  );

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleAddOption(ctx, productId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  optionEditState.set(adminId, { productId, step: 'name' });

  await ctx.answerCbQuery();
  await ctx.reply(
    lang === 'ms'
      ? `➕ *Tambah Pilihan Produk*\n\nSila hantar nama pilihan (contoh: Saiz, Warna, Tempoh Langganan)\n\nFormat: Nama Melayu | Nama Inggeris\nContoh: Saiz | Size`
      : `➕ *Add Product Option*\n\nPlease send option name (example: Size, Color, Subscription Duration)\n\nFormat: Malay Name | English Name\nExample: Saiz | Size`,
    { parse_mode: 'Markdown' }
  );
}

async function handleOptionDetail(ctx, productId, optionIndex) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product || !product.options || !product.options[optionIndex]) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Pilihan tidak dijumpai' : 'Option not found');
    return;
  }

  const option = product.options[optionIndex];

  const text = lang === 'ms'
    ? `🎨 *Detail Pilihan*\n\n` +
    `📝 Nama: ${option.name.ms}\n` +
    `🌐 Name (EN): ${option.name.en}\n` +
    `📋 Nilai: ${option.values.join(', ')}\n` +
    `${option.required ? '⚠️ Wajib' : '📌 Opsional'}\n` +
    `💰 Tambahan Harga: ${option.priceModifier ? `+RM${option.priceModifier}` : 'Tiada'}\n\n` +
    `Pilih tindakan:`
    : `🎨 *Option Detail*\n\n` +
    `📝 Name (MS): ${option.name.ms}\n` +
    `🌐 Name: ${option.name.en}\n` +
    `📋 Values: ${option.values.join(', ')}\n` +
    `${option.required ? '⚠️ Required' : '📌 Optional'}\n` +
    `💰 Price Modifier: ${option.priceModifier ? `+RM${option.priceModifier}` : 'None'}\n\n` +
    `Choose action:`;

  const buttons = [
    [Markup.button.callback(
      option.required
        ? (lang === 'ms' ? '📌 Set Opsional' : '📌 Set Optional')
        : (lang === 'ms' ? '⚠️ Set Wajib' : '⚠️ Set Required'),
      `opt_toggle_req_${productId}_${optionIndex}`
    )],
    [Markup.button.callback(lang === 'ms' ? '🗑️ Padam Pilihan' : '🗑️ Delete Option', `opt_delete_${productId}_${optionIndex}`)],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', `prod_options_${productId}`)]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleToggleOptionRequired(ctx, productId, optionIndex) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product || !product.options || !product.options[optionIndex]) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Pilihan tidak dijumpai' : 'Option not found');
    return;
  }

  product.options[optionIndex].required = !product.options[optionIndex].required;
  await db.updateProduct(productId, { options: product.options });

  await ctx.answerCbQuery(
    lang === 'ms'
      ? `✅ Status keutamaan dikemaskini`
      : `✅ Required status updated`
  );

  await handleOptionDetail(ctx, productId, optionIndex);
}

async function handleDeleteOption(ctx, productId, optionIndex) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product || !product.options || !product.options[optionIndex]) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Pilihan tidak dijumpai' : 'Option not found');
    return;
  }

  product.options.splice(optionIndex, 1);
  await db.updateProduct(productId, { options: product.options });

  await ctx.answerCbQuery(
    lang === 'ms'
      ? `✅ Pilihan dipadam`
      : `✅ Option deleted`
  );

  await handleProductOptions(ctx, productId);
}

async function processOptionInput(ctx) {
  const userId = ctx.from.id;
  const state = optionEditState.get(userId);

  if (!state) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const text = ctx.message.text.trim();

  const products = await db.getProducts();
  const productIdx = products.findIndex(p => p.id === state.productId);

  if (productIdx === -1) {
    optionEditState.delete(userId);
    await ctx.reply(lang === 'ms' ? '❌ Produk tidak dijumpai' : '❌ Product not found');
    return;
  }

  if (!products[productIdx].options) {
    products[productIdx].options = [];
  }

  if (state.step === 'name') {
    const parts = text.split('|').map(p => p.trim());
    if (parts.length !== 2) {
      await ctx.reply(
        lang === 'ms'
          ? `❌ Format salah!\n\nFormat: Nama Melayu | Nama Inggeris\nContoh: Saiz | Size`
          : `❌ Wrong format!\n\nFormat: Malay Name | English Name\nExample: Saiz | Size`
      );
      return;
    }

    state.name = { ms: parts[0], en: parts[1] };
    state.step = 'values';

    await ctx.reply(
      lang === 'ms'
        ? `✅ Nama disimpan: ${parts[0]} / ${parts[1]}\n\n📋 Sila hantar nilai-nilai pilihan (dipisahkan dengan koma)\n\nContoh: Kecil, Sederhana, Besar\nContoh: Merah, Biru, Hijau`
        : `✅ Name saved: ${parts[0]} / ${parts[1]}\n\n📋 Please send option values (separated by commas)\n\nExample: Small, Medium, Large\nExample: Red, Blue, Green`
    );

  } else if (state.step === 'values') {
    const values = text.split(',').map(v => v.trim()).filter(v => v);

    if (values.length === 0) {
      await ctx.reply(
        lang === 'ms'
          ? `❌ Sila masukkan sekurang-kurangnya satu nilai!`
          : `❌ Please enter at least one value!`
      );
      return;
    }

    state.values = values;
    state.step = 'required';

    const buttons = [
      [Markup.button.callback(lang === 'ms' ? '⚠️ Wajib' : '⚠️ Required', `opt_req_yes_${state.productId}`)],
      [Markup.button.callback(lang === 'ms' ? '📌 Opsional' : '📌 Optional', `opt_req_no_${state.productId}`)]
    ];

    await ctx.reply(
      lang === 'ms'
        ? `✅ Nilai disimpan: ${values.join(', ')}\n\n⚠️ Adakah pilihan ini wajib?`
        : `✅ Values saved: ${values.join(', ')}\n\n⚠️ Is this option required?`,
      Markup.inlineKeyboard(buttons)
    );

  } else if (state.step === 'priceModifier') {
    const price = parseFloat(text);

    if (isNaN(price) && text !== '0') {
      await ctx.reply(
        lang === 'ms'
          ? `❌ Harga tidak sah! Sila masukkan nombor atau 0 untuk tiada caj tambahan.`
          : `❌ Invalid price! Please enter a number or 0 for no extra charge.`
      );
      return;
    }

    const newOption = {
      id: generateId('OPT'),
      name: state.name,
      values: state.values,
      required: state.required,
      priceModifier: price === 0 ? null : price
    };

    products[productIdx].options.push(newOption);
    await db.updateProduct(state.productId, { options: products[productIdx].options });

    optionEditState.delete(userId);

    await ctx.reply(
      lang === 'ms'
        ? `✅ *Pilihan berjaya ditambah!*\n\n` +
        `📝 ${newOption.name.ms}\n` +
        `📋 ${newOption.values.join(', ')}\n` +
        `${newOption.required ? '⚠️ Wajib' : '📌 Opsional'}\n` +
        `${newOption.priceModifier ? `💰 +RM${newOption.priceModifier}` : '💰 Tiada caj tambahan'}`
        : `✅ *Option successfully added!*\n\n` +
        `📝 ${newOption.name.en}\n` +
        `📋 ${newOption.values.join(', ')}\n` +
        `${newOption.required ? '⚠️ Required' : '📌 Optional'}\n` +
        `${newOption.priceModifier ? `💰 +RM${newOption.priceModifier}` : '💰 No extra charge'}`,
      { parse_mode: 'Markdown' }
    );
  }
}

async function handleOptionRequired(ctx, productId, required) {
  const userId = ctx.from.id;
  const state = optionEditState.get(userId);

  if (!state || state.productId !== productId) {
    await ctx.answerCbQuery('❌ Session expired');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  state.required = required;
  state.step = 'priceModifier';

  await ctx.answerCbQuery();
  await ctx.reply(
    lang === 'ms'
      ? `💰 Adakah pilihan ini menambah harga?\n\nSila hantar tambahan harga (contoh: 5 untuk +RM5)\nAtau hantar 0 jika tiada caj tambahan`
      : `💰 Does this option add to the price?\n\nPlease send price modifier (example: 5 for +RM5)\nOr send 0 for no extra charge`
  );
}

module.exports = {
  handleProductOptions,
  handleAddOption,
  handleOptionDetail,
  handleToggleOptionRequired,
  handleDeleteOption,
  processOptionInput,
  handleOptionRequired
};
