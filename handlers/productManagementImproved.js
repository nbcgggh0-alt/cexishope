const { Markup } = require('telegraf');
const db = require('../utils/database');
const { generateId } = require('../utils/helpers');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');

const productEditState = new Map();

async function handleProductManagementMenu(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const categories = await db.getCategories();
  const lowStockProducts = products.filter(p => p.stock < 5 && p.active);

  const text = lang === 'ms'
    ? `📦 *Pengurusan Produk*\n\n` +
    `📊 Jumlah Produk: ${products.length}\n` +
    `📂 Kategori: ${categories.length}\n` +
    `⚠️ Stok Rendah: ${lowStockProducts.length}\n\n` +
    `Pilih tindakan:`
    : `📦 *Product Management*\n\n` +
    `📊 Total Products: ${products.length}\n` +
    `📂 Categories: ${categories.length}\n` +
    `⚠️ Low Stock: ${lowStockProducts.length}\n\n` +
    `Choose action:`;

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '📋 Senarai Produk' : '📋 List Products', 'prod_list_page_0')],
    [
      Markup.button.callback(lang === 'ms' ? '🔍 Cari' : '🔍 Search', 'product_search'),
      Markup.button.callback(lang === 'ms' ? '🔽 Tapis' : '🔽 Filter', 'product_filter')
    ],
    [
      Markup.button.callback(lang === 'ms' ? '⚡ Edit Pantas' : '⚡ Quick Edit', 'quick_edit_menu'),
      Markup.button.callback(lang === 'ms' ? '🔄 Bulk Ops' : '🔄 Bulk Ops', 'bulk_operations')
    ],
    [
      Markup.button.callback(lang === 'ms' ? '📅 Produk Berjadual' : '📅 Scheduled Products', 'scheduled_products'),
      Markup.button.callback(lang === 'ms' ? '📊 Statistik' : '📊 Statistics', 'all_products_stats')
    ],
    [Markup.button.callback(lang === 'ms' ? '📂 Urus Kategori' : '📂 Manage Categories', 'cat_management')],
    [Markup.button.callback(lang === 'ms' ? '⚠️ Produk Stok Rendah' : '⚠️ Low Stock Products', 'prod_low_stock')],
    [Markup.button.callback(lang === 'ms' ? '➕ Tambah Produk' : '➕ Add Product', 'prod_add_new')],
    [Markup.button.callback(lang === 'ms' ? '🔙 Panel Admin' : '🔙 Admin Panel', 'admin_panel')]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleProductList(ctx, page = 0) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const itemsPerPage = 8;
  const startIndex = page * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = products.slice(startIndex, endIndex);
  const totalPages = Math.ceil(products.length / itemsPerPage);

  const text = lang === 'ms'
    ? `📋 *Senarai Produk*\n\nHalaman ${page + 1}/${totalPages} (${products.length} produk)\n\nKlik produk untuk edit/delete:`
    : `📋 *Product List*\n\nPage ${page + 1}/${totalPages} (${products.length} products)\n\nClick product to edit/delete:`;

  const buttons = [];

  paginatedProducts.forEach(prod => {
    const stockIcon = prod.stock < 5 ? '⚠️' : (prod.active ? '✅' : '❌');
    const productLabel = `${stockIcon} ${prod.name.ms} - RM${prod.price} (${prod.stock})`;
    buttons.push([Markup.button.callback(productLabel, `prod_detail_${prod.id}`)]);
  });

  const navButtons = [];
  if (page > 0) {
    navButtons.push(Markup.button.callback('⬅️ Prev', `prod_list_page_${page - 1}`));
  }
  if (endIndex < products.length) {
    navButtons.push(Markup.button.callback('Next ➡️', `prod_list_page_${page + 1}`));
  }
  if (navButtons.length > 0) {
    buttons.push(navButtons);
  }

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleProductDetail(ctx, productId) {
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

  const categories = await db.getCategories();
  const category = categories.find(c => c.id === product.categoryId);

  const text = lang === 'ms'
    ? `📦 *${product.name.ms}*\n\n` +
    `🆔 ID: \`${product.id}\`\n` +
    `📂 Kategori: ${category?.name.ms || 'Unknown'}\n` +
    `💰 Harga: RM${product.price}\n` +
    `📊 Stok: ${product.stock}\n` +
    `🔄 Jenis: ${product.deliveryType}\n` +
    `${product.active ? '✅' : '❌'} Status: ${product.active ? 'Aktif' : 'Tidak Aktif'}\n\n` +
    `📝 Penerangan:\n${product.description?.ms || product.description?.en || '-'}\n\n` +
    `Pilih tindakan:`
    : `📦 *${product.name.en || product.name.ms}*\n\n` +
    `🆔 ID: \`${product.id}\`\n` +
    `📂 Category: ${category?.name.en || category?.name.ms || 'Unknown'}\n` +
    `💰 Price: RM${product.price}\n` +
    `📊 Stock: ${product.stock}\n` +
    `🔄 Type: ${product.deliveryType}\n` +
    `${product.active ? '✅' : '❌'} Status: ${product.active ? 'Active' : 'Inactive'}\n\n` +
    `📝 Description:\n${product.description?.en || product.description?.ms || '-'}\n\n` +
    `Choose action:`;

  const buttons = [
    [
      Markup.button.callback(lang === 'ms' ? '✏️ Edit Harga' : '✏️ Edit Price', `prod_edit_price_${productId}`),
      Markup.button.callback(lang === 'ms' ? '📊 Edit Stok' : '📊 Edit Stock', `prod_edit_stock_${productId}`)
    ],
    [
      Markup.button.callback(lang === 'ms' ? '📝 Edit Nama' : '📝 Edit Name', `prod_edit_name_${productId}`),
      Markup.button.callback(lang === 'ms' ? '📄 Edit Desc' : '📄 Edit Desc', `prod_edit_desc_${productId}`)
    ],
    [
      Markup.button.callback(lang === 'ms' ? '🎨 Pilihan Produk' : '🎨 Product Options', `prod_options_${productId}`),
      Markup.button.callback(lang === 'ms' ? '🖼️ Imej Produk' : '🖼️ Product Images', `prod_images_${productId}`)
    ],
    [
      Markup.button.callback(lang === 'ms' ? '📅 Jadual Terbit' : '📅 Schedule Publish', `schedule_prod_${productId}`),
      Markup.button.callback(lang === 'ms' ? '⭐ Lihat Ulasan' : '⭐ View Reviews', `prod_reviews_${productId}`)
    ],
    [Markup.button.callback(
      lang === 'ms' ? '📦 Urus Stok/Item' : '📦 Manage Stock/Items',
      `flow_stock_${productId}`
    )],
    [Markup.button.callback(
      product.active
        ? (lang === 'ms' ? '🔴 Nyahaktifkan' : '🔴 Deactivate')
        : (lang === 'ms' ? '🟢 Aktifkan' : '🟢 Activate'),
      `prod_toggle_${productId}`
    )],
    [Markup.button.callback(lang === 'ms' ? '🗑️ Padam Produk' : '🗑️ Delete Product', `prod_delete_confirm_${productId}`)],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'prod_list_page_0')]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleToggleProduct(ctx, productId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    await ctx.answerCbQuery('Product not found');
    return;
  }

  product.active = !product.active;
  await db.updateProduct(productId, { active: product.active });

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  await ctx.answerCbQuery(
    product.active
      ? (lang === 'ms' ? '✅ Produk diaktifkan' : '✅ Product activated')
      : (lang === 'ms' ? '🔴 Produk dinyahaktifkan' : '🔴 Product deactivated')
  );

  await handleProductDetail(ctx, productId);
}

async function handleDeleteProductConfirm(ctx, productId) {
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

  const text = lang === 'ms'
    ? `⚠️ *Sahkan Padam Produk*\n\n📦 ${product.name.ms}\n💰 RM${product.price}\n\nAdakah anda pasti mahu memadam produk ini?\n\n*Tindakan ini tidak boleh dibatalkan!*`
    : `⚠️ *Confirm Delete Product*\n\n📦 ${product.name.en || product.name.ms}\n💰 RM${product.price}\n\nAre you sure you want to delete this product?\n\n*This action cannot be undone!*`;

  const buttons = [
    [
      Markup.button.callback(lang === 'ms' ? '❌ Batal' : '❌ Cancel', `prod_detail_${productId}`),
      Markup.button.callback(lang === 'ms' ? '🗑️ Ya, Padam' : '🗑️ Yes, Delete', `prod_delete_${productId}`)
    ]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleDeleteProduct(ctx, productId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const products = await db.getProducts();
  const productIndex = products.findIndex(p => p.id === productId);

  if (productIndex === -1) {
    await ctx.answerCbQuery('Product not found');
    return;
  }

  const product = products[productIndex];
  await db.deleteProduct(productId);

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const message = lang === 'ms'
    ? `✅ *Produk berjaya dipadam!*\n\n📦 ${product.name.ms}\n💰 RM${product.price}`
    : `✅ *Product deleted successfully!*\n\n📦 ${product.name.en || product.name.ms}\n💰 RM${product.price}`;

  await ctx.answerCbQuery(lang === 'ms' ? '✅ Produk dipadam' : '✅ Product deleted');
  await ctx.reply(message, { parse_mode: 'Markdown' });

  await handleProductList(ctx, 0);
}

async function handleEditProductField(ctx, productId, field) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  productEditState.set(adminId, { productId, field });

  let message = '';

  switch (field) {
    case 'price':
      message = lang === 'ms'
        ? '💰 *Edit Harga Produk*\n\nHantar harga baru (nombor sahaja).\n\nContoh: 15.00'
        : '💰 *Edit Product Price*\n\nSend the new price (numbers only).\n\nExample: 15.00';
      break;
    case 'stock':
      message = lang === 'ms'
        ? '📊 *Edit Stok Produk*\n\nHantar jumlah stok baru.\n\nContoh: 50'
        : '📊 *Edit Product Stock*\n\nSend the new stock quantity.\n\nExample: 50';
      break;
    case 'name':
      message = lang === 'ms'
        ? '📝 *Edit Nama Produk*\n\nHantar nama baru untuk produk.\n\nContoh: Netflix Premium 1 Bulan'
        : '📝 *Edit Product Name*\n\nSend the new product name.\n\nExample: Netflix Premium 1 Month';
      break;
    case 'description':
      message = lang === 'ms'
        ? '📄 *Edit Penerangan Produk*\n\nHantar penerangan baru untuk produk.\n\nContoh: Akaun Netflix Premium dengan 4K streaming dan 4 peranti serentak'
        : '📄 *Edit Product Description*\n\nSend the new product description.\n\nExample: Netflix Premium account with 4K streaming and 4 simultaneous devices';
      break;
  }

  await ctx.answerCbQuery();
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function processProductEdit(ctx) {
  const adminId = ctx.from.id;

  if (!productEditState.has(adminId)) {
    return false;
  }

  const editData = productEditState.get(adminId);
  const newValue = ctx.message.text.trim();

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const product = products.find(p => p.id === editData.productId);

  if (!product) {
    await ctx.reply(lang === 'ms' ? '❌ Produk tidak dijumpai' : '❌ Product not found');
    productEditState.delete(adminId);
    return true;
  }

  switch (editData.field) {
    case 'price':
      const price = parseFloat(newValue);
      if (isNaN(price) || price < 0) {
        await ctx.reply(lang === 'ms' ? '❌ Harga tidak sah!' : '❌ Invalid price!');
        productEditState.delete(adminId);
        return true;
      }
      product.price = price;
      await ctx.reply(
        lang === 'ms'
          ? `✅ Harga dikemaskini ke RM${price}`
          : `✅ Price updated to RM${price}`
      );
      break;

    case 'stock':
      const stock = parseInt(newValue);
      if (isNaN(stock) || stock < 0) {
        await ctx.reply(lang === 'ms' ? '❌ Stok tidak sah!' : '❌ Invalid stock!');
        productEditState.delete(adminId);
        return true;
      }
      product.stock = stock;
      await ctx.reply(
        lang === 'ms'
          ? `✅ Stok dikemaskini ke ${stock} unit`
          : `✅ Stock updated to ${stock} units`
      );
      break;

    case 'name':
      product.name = { ms: newValue, en: newValue };
      await ctx.reply(
        lang === 'ms'
          ? `✅ Nama dikemaskini: ${newValue}`
          : `✅ Name updated: ${newValue}`
      );
      break;

    case 'description':
      product.description = { ms: newValue, en: newValue };
      await ctx.reply(
        lang === 'ms'
          ? '✅ Penerangan dikemaskini'
          : '✅ Description updated'
      );
      break;
  }

  let updates = {};
  switch (editData.field) {
    case 'price': updates = { price: product.price }; break;
    case 'stock': updates = { stock: product.stock }; break;
    case 'name': updates = { name: product.name }; break;
    case 'description': updates = { description: product.description }; break;
  }

  await db.updateProduct(editData.productId, updates);
  productEditState.delete(adminId);
  return true;
}

async function handleLowStockProducts(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const lowStockProducts = products.filter(p => p.stock < 5 && p.active);

  if (lowStockProducts.length === 0) {
    const text = lang === 'ms'
      ? '✅ *Tiada Produk Stok Rendah*\n\nSemua produk mempunyai stok yang mencukupi.'
      : '✅ *No Low Stock Products*\n\nAll products have sufficient stock.';

    await safeEditMessage(ctx, text, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]
      ])
    });
    return;
  }

  let text = lang === 'ms'
    ? `⚠️ *Produk Stok Rendah*\n\n${lowStockProducts.length} produk dengan stok kurang dari 5:\n\n`
    : `⚠️ *Low Stock Products*\n\n${lowStockProducts.length} products with stock below 5:\n\n`;

  const buttons = [];

  lowStockProducts.forEach(prod => {
    text += `📦 ${prod.name.ms}\n📊 Stok: ${prod.stock}\n💰 RM${prod.price}\n🆔 ${prod.id}\n\n`;
    buttons.push([Markup.button.callback(`📊 ${prod.name.ms} (${prod.stock})`, `prod_detail_${prod.id}`)]);
  });

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

module.exports = {
  handleProductManagementMenu,
  handleProductList,
  handleProductDetail,
  handleToggleProduct,
  handleDeleteProductConfirm,
  handleDeleteProduct,
  handleEditProductField,
  processProductEdit,
  handleLowStockProducts,
  productEditState
};
