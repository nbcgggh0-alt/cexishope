const { Markup } = require('telegraf');
const db = require('../utils/database');
const { generateId } = require('../utils/helpers');
const { safeEditMessage } = require('../utils/messageHelper');

const reviewState = new Map();

async function handleProductReviews(ctx, productId) {
  const user = await db.getUser(ctx.from.id);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Produk tidak dijumpai' : 'Product not found');
    return;
  }

  const reviews = product.reviews || [];
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  const ratingDistribution = {
    5: reviews.filter(r => r.rating === 5).length,
    4: reviews.filter(r => r.rating === 4).length,
    3: reviews.filter(r => r.rating === 3).length,
    2: reviews.filter(r => r.rating === 2).length,
    1: reviews.filter(r => r.rating === 1).length
  };

  const text = lang === 'ms'
    ? `⭐ *Ulasan: ${product.name.ms}*\n\n` +
    `📊 Penilaian Purata: ${avgRating}/5.0 ⭐\n` +
    `📝 Jumlah Ulasan: ${reviews.length}\n\n` +
    `📈 *Taburan Penilaian:*\n` +
    `⭐⭐⭐⭐⭐ (${ratingDistribution[5]})\n` +
    `⭐⭐⭐⭐ (${ratingDistribution[4]})\n` +
    `⭐⭐⭐ (${ratingDistribution[3]})\n` +
    `⭐⭐ (${ratingDistribution[2]})\n` +
    `⭐ (${ratingDistribution[1]})\n\n` +
    (reviews.length > 0
      ? `📋 *Ulasan Terkini:*\n\n` +
      reviews.slice(0, 5).map((r, i) => {
        const stars = '⭐'.repeat(r.rating);
        const userName = r.userName || 'Pengguna';
        const date = new Date(r.createdAt).toLocaleDateString('ms-MY');
        return `${i + 1}. ${stars} - ${userName}\n   "${r.comment}"\n   📅 ${date}`;
      }).join('\n\n')
      : '📭 Tiada ulasan lagi')
    : `⭐ *Reviews: ${product.name.en || product.name.ms}*\n\n` +
    `📊 Average Rating: ${avgRating}/5.0 ⭐\n` +
    `📝 Total Reviews: ${reviews.length}\n\n` +
    `📈 *Rating Distribution:*\n` +
    `⭐⭐⭐⭐⭐ (${ratingDistribution[5]})\n` +
    `⭐⭐⭐⭐ (${ratingDistribution[4]})\n` +
    `⭐⭐⭐ (${ratingDistribution[3]})\n` +
    `⭐⭐ (${ratingDistribution[2]})\n` +
    `⭐ (${ratingDistribution[1]})\n\n` +
    (reviews.length > 0
      ? `📋 *Recent Reviews:*\n\n` +
      reviews.slice(0, 5).map((r, i) => {
        const stars = '⭐'.repeat(r.rating);
        const userName = r.userName || 'User';
        const date = new Date(r.createdAt).toLocaleDateString('en-US');
        return `${i + 1}. ${stars} - ${userName}\n   "${r.comment}"\n   📅 ${date}`;
      }).join('\n\n')
      : '📭 No reviews yet');

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', `prod_view_${productId}`)]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function requestReview(ctx, orderId) {
  const user = await db.getUser(ctx.from.id);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const order = transactions.find(t => t.id === orderId);

  if (!order || order.userId !== ctx.from.id) {
    await ctx.reply(lang === 'ms' ? '❌ Pesanan tidak dijumpai' : '❌ Order not found');
    return;
  }

  if (order.status !== 'verified') {
    await ctx.reply(
      lang === 'ms'
        ? '❌ Anda hanya boleh ulas pesanan yang telah disahkan'
        : '❌ You can only review verified orders'
    );
    return;
  }

  const products = await db.getProducts();
  const product = products.find(p => p.id === order.productId);

  if (!product) {
    await ctx.reply(lang === 'ms' ? '❌ Produk tidak dijumpai' : '❌ Product not found');
    return;
  }

  const alreadyReviewed = product.reviews?.some(r => r.orderId === orderId);
  if (alreadyReviewed) {
    await ctx.reply(
      lang === 'ms'
        ? '❌ Anda sudah mengulas pesanan ini'
        : '❌ You have already reviewed this order'
    );
    return;
  }

  const text = lang === 'ms'
    ? `⭐ *Ulas Produk*\n\n` +
    `📦 ${product.name.ms}\n\n` +
    `Bagaimana pengalaman anda dengan produk ini?\n` +
    `Pilih penilaian anda:`
    : `⭐ *Review Product*\n\n` +
    `📦 ${product.name.en || product.name.ms}\n\n` +
    `How was your experience with this product?\n` +
    `Choose your rating:`;

  const buttons = [
    [Markup.button.callback('⭐⭐⭐⭐⭐ (5)', `review_rate_${orderId}_5`)],
    [Markup.button.callback('⭐⭐⭐⭐ (4)', `review_rate_${orderId}_4`)],
    [Markup.button.callback('⭐⭐⭐ (3)', `review_rate_${orderId}_3`)],
    [Markup.button.callback('⭐⭐ (2)', `review_rate_${orderId}_2`)],
    [Markup.button.callback('⭐ (1)', `review_rate_${orderId}_1`)]
  ];

  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleRatingSelect(ctx, orderId, rating) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  reviewState.set(userId, { orderId, rating });

  await ctx.answerCbQuery();
  await ctx.reply(
    lang === 'ms'
      ? `⭐ Penilaian: ${'⭐'.repeat(rating)}\n\n📝 Sila hantar ulasan anda (atau hantar 'skip' untuk langkau)`
      : `⭐ Rating: ${'⭐'.repeat(rating)}\n\n📝 Please send your review (or send 'skip' to skip)`,
    { parse_mode: 'Markdown' }
  );
}

async function processReviewComment(ctx) {
  const userId = ctx.from.id;
  const state = reviewState.get(userId);

  if (!state) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const comment = ctx.message.text.trim();

  const transactions = await db.getTransactions();
  const order = transactions.find(t => t.id === state.orderId);

  if (!order || order.userId !== userId) {
    reviewState.delete(userId);
    await ctx.reply(lang === 'ms' ? '❌ Pesanan tidak dijumpai' : '❌ Order not found');
    return;
  }

  const products = await db.getProducts();
  const product = products.find(p => p.id === order.productId);

  if (!product) {
    reviewState.delete(userId);
    await ctx.reply(lang === 'ms' ? '❌ Produk tidak dijumpai' : '❌ Product not found');
    return;
  }

  if (!product.reviews) {
    product.reviews = [];
  }

  const review = {
    id: generateId('REV'),
    orderId: state.orderId,
    userId: userId,
    userName: user.firstName || 'User',
    rating: state.rating,
    comment: comment.toLowerCase() === 'skip' ? '' : comment,
    createdAt: new Date().toISOString()
  };

  product.reviews.push(review);
  await db.updateProduct(product.id, { reviews: product.reviews });

  reviewState.delete(userId);

  await ctx.reply(
    lang === 'ms'
      ? `✅ *Terima kasih atas ulasan anda!*\n\n` +
      `⭐ Penilaian: ${'⭐'.repeat(state.rating)}\n` +
      (review.comment ? `📝 Ulasan: "${review.comment}"\n\n` : '\n') +
      `Ulasan anda membantu pelanggan lain membuat keputusan yang lebih baik.`
      : `✅ *Thank you for your review!*\n\n` +
      `⭐ Rating: ${'⭐'.repeat(state.rating)}\n` +
      (review.comment ? `📝 Review: "${review.comment}"\n\n` : '\n') +
      `Your review helps other customers make better decisions.`,
    { parse_mode: 'Markdown' }
  );
}

async function handleViewAllReviews(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const allReviews = [];

  products.forEach(product => {
    if (product.reviews && product.reviews.length > 0) {
      product.reviews.forEach(review => {
        allReviews.push({
          ...review,
          productName: product.name,
          productId: product.id
        });
      });
    }
  });

  allReviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const text = lang === 'ms'
    ? `📋 *Semua Ulasan*\n\n` +
    `Jumlah: ${allReviews.length} ulasan\n\n` +
    (allReviews.length > 0
      ? allReviews.slice(0, 10).map((r, i) => {
        const stars = '⭐'.repeat(r.rating);
        const date = new Date(r.createdAt).toLocaleDateString('ms-MY');
        return `${i + 1}. ${stars} - ${r.userName}\n` +
          `   📦 ${r.productName.ms}\n` +
          (r.comment ? `   "${r.comment}"\n` : '') +
          `   📅 ${date}`;
      }).join('\n\n')
      : '📭 Tiada ulasan lagi')
    : `📋 *All Reviews*\n\n` +
    `Total: ${allReviews.length} reviews\n\n` +
    (allReviews.length > 0
      ? allReviews.slice(0, 10).map((r, i) => {
        const stars = '⭐'.repeat(r.rating);
        const date = new Date(r.createdAt).toLocaleDateString('en-US');
        return `${i + 1}. ${stars} - ${r.userName}\n` +
          `   📦 ${r.productName.en || r.productName.ms}\n` +
          (r.comment ? `   "${r.comment}"\n` : '') +
          `   📅 ${date}`;
      }).join('\n\n')
      : '📭 No reviews yet');

  await ctx.reply(text, { parse_mode: 'Markdown' });
}

module.exports = {
  handleProductReviews,
  requestReview,
  handleRatingSelect,
  processReviewComment,
  handleViewAllReviews
};
