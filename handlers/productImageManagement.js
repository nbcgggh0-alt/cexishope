const { Markup } = require('telegraf');
const db = require('../utils/database');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');
const path = require('path');
const fs = require('fs-extra');

const imageState = new Map();

async function handleProductImages(ctx, productId) {
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

  const images = product.images || [];

  const text = lang === 'ms'
    ? `🖼️ *Pengurusan Imej: ${product.name.ms}*\n\n` +
    `📸 Imej sedia ada: ${images.length}\n\n` +
    (images.length > 0
      ? `Imej produk:\n` + images.map((img, i) => `${i + 1}. ${img.filename || 'image.jpg'}`).join('\n')
      : '📭 Tiada imej lagi\n\n' +
      'Tambah imej produk untuk menarik pelanggan!') +
    `\n\nPilih tindakan:`
    : `🖼️ *Image Management: ${product.name.en || product.name.ms}*\n\n` +
    `📸 Existing images: ${images.length}\n\n` +
    (images.length > 0
      ? `Product images:\n` + images.map((img, i) => `${i + 1}. ${img.filename || 'image.jpg'}`).join('\n')
      : '📭 No images yet\n\n' +
      'Add product images to attract customers!') +
    `\n\nChoose action:`;

  const buttons = [];

  if (images.length > 0) {
    buttons.push([Markup.button.callback(lang === 'ms' ? '👁️ Lihat Imej' : '👁️ View Images', `img_view_${productId}`)]);
    images.forEach((img, index) => {
      buttons.push([Markup.button.callback(
        `🗑️ ${lang === 'ms' ? 'Padam' : 'Delete'} ${index + 1}`,
        `img_delete_${productId}_${index}`
      )]);
    });
  }

  buttons.push(
    [Markup.button.callback(lang === 'ms' ? '➕ Tambah Imej' : '➕ Add Image', `img_add_${productId}`)],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', `prod_detail_${productId}`)]
  );

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleAddProductImage(ctx, productId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  imageState.set(adminId, { productId, action: 'add' });

  await ctx.answerCbQuery();
  await ctx.reply(
    lang === 'ms'
      ? `📸 *Tambah Imej Produk*\n\n` +
      `Sila hantar imej produk (format: JPG, PNG)\n\n` +
      `Tips:\n` +
      `• Gunakan imej berkualiti tinggi\n` +
      `• Saiz disyorkan: 800x800px\n` +
      `• Latar belakang bersih\n` +
      `• Tunjukkan produk dengan jelas`
      : `📸 *Add Product Image*\n\n` +
      `Please send product image (format: JPG, PNG)\n\n` +
      `Tips:\n` +
      `• Use high quality images\n` +
      `• Recommended size: 800x800px\n` +
      `• Clean background\n` +
      `• Show product clearly`,
    { parse_mode: 'Markdown' }
  );
}

async function processProductImage(ctx) {
  const userId = ctx.from.id;
  const state = imageState.get(userId);

  if (!state) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  if (!ctx.message.photo) {
    await ctx.reply(
      lang === 'ms'
        ? '❌ Sila hantar imej (foto)'
        : '❌ Please send an image (photo)'
    );
    return;
  }

  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const file = await ctx.telegram.getFile(photo.file_id);
    const fileExtension = file.file_path.split('.').pop();
    const filename = `${state.productId}_${Date.now()}.${fileExtension}`;
    const filePath = path.join('./media/products', filename);

    await fs.ensureDir('./media/products');

    const fileUrl = `https://api.telegram.org/file/bot${ctx.botInfo.token}/${file.file_path}`;
    const fetch = require('node-fetch');
    const response = await fetch(fileUrl);
    const buffer = await response.buffer();

    await fs.writeFile(filePath, buffer);

    const products = await db.getProducts();
    const product = products.find(p => p.id === state.productId);

    if (!product) {
      imageState.delete(userId);
      await ctx.reply(lang === 'ms' ? '❌ Produk tidak dijumpai' : '❌ Product not found');
      return;
    }

    if (!product.images) {
      product.images = [];
    }

    product.images.push({
      filename: filename,
      fileId: photo.file_id,
      path: filePath,
      uploadedAt: new Date().toISOString(),
      uploadedBy: userId
    });

    await db.updateProduct(product.id, { images: product.images });
    imageState.delete(userId);

    await ctx.reply(
      lang === 'ms'
        ? `✅ *Imej berjaya ditambah!*\n\n` +
        `📦 Produk: ${product.name.ms}\n` +
        `📸 Jumlah imej: ${product.images.length}`
        : `✅ *Image successfully added!*\n\n` +
        `📦 Product: ${product.name.en || product.name.ms}\n` +
        `📸 Total images: ${product.images.length}`,
      { parse_mode: 'Markdown' }
    );

  } catch (error) {
    console.error('Error processing image:', error);
    await ctx.reply(
      lang === 'ms'
        ? '❌ Ralat memproses imej. Sila cuba lagi.'
        : '❌ Error processing image. Please try again.'
    );
  }
}

async function handleViewProductImages(ctx, productId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product || !product.images || product.images.length === 0) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Tiada imej' : 'No images');
    return;
  }

  await ctx.answerCbQuery();

  for (let i = 0; i < product.images.length; i++) {
    const img = product.images[i];
    try {
      await ctx.replyWithPhoto(img.fileId, {
        caption: lang === 'ms'
          ? `📸 Imej ${i + 1}/${product.images.length}\n📦 ${product.name.ms}`
          : `📸 Image ${i + 1}/${product.images.length}\n📦 ${product.name.en || product.name.ms}`
      });
    } catch (error) {
      console.error('Error sending image:', error);
    }
  }
}

async function handleDeleteProductImage(ctx, productId, imageIndex) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product || !product.images || !product.images[imageIndex]) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Imej tidak dijumpai' : 'Image not found');
    return;
  }

  const image = product.images[imageIndex];

  try {
    if (image.path && await fs.pathExists(image.path)) {
      await fs.unlink(image.path);
    }
  } catch (error) {
    console.error('Error deleting image file:', error);
  }

  product.images.splice(imageIndex, 1);
  await db.updateProduct(productId, { images: product.images });

  await ctx.answerCbQuery(
    lang === 'ms'
      ? '✅ Imej dipadam'
      : '✅ Image deleted'
  );

  await handleProductImages(ctx, productId);
}

module.exports = {
  handleProductImages,
  handleAddProductImage,
  processProductImage,
  handleViewProductImages,
  handleDeleteProductImage
};
