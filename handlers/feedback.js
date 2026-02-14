const { Markup } = require('telegraf');
const db = require('../utils/database');
const { generateId } = require('../utils/helpers');

const feedbackState = new Map();

async function sendFeedbackRequest(ctx, orderId, userId) {
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const messages = {
    ms: `📝 *Feedback & Review*\n\nTerima kasih kerana membeli dengan kami!\n\n🆔 Order: ${orderId}\n\nBolehkah anda berikan rating dan feedback?`,
    en: `📝 *Feedback & Review*\n\nThank you for your purchase!\n\n🆔 Order: ${orderId}\n\nWould you like to provide a rating and feedback?`,
    zh: `📝 *反馈与评价*\n\n感谢您的购买！\n\n🆔 订单：${orderId}\n\n您愿意提供评分和反馈吗？`,
    ta: `📝 *கருத்து மற்றும் மதிப்பாய்வு*\n\nஉங்கள் வாங்குதலுக்கு நன்றி!\n\n🆔 ஆர்டர்: ${orderId}\n\nமதிப்பீடு மற்றும் கருத்தை வழங்க விரும்புகிறீர்களா?`
  };

  const buttons = [
    [
      Markup.button.callback('⭐', `rating_${orderId}_1`),
      Markup.button.callback('⭐⭐', `rating_${orderId}_2`),
      Markup.button.callback('⭐⭐⭐', `rating_${orderId}_3`)
    ],
    [
      Markup.button.callback('⭐⭐⭐⭐', `rating_${orderId}_4`),
      Markup.button.callback('⭐⭐⭐⭐⭐', `rating_${orderId}_5`)
    ],
    [Markup.button.callback(lang === 'ms' ? '❌ Tidak sekarang' : '❌ Not now', `feedback_skip_${orderId}`)]
  ];

  try {
    await ctx.telegram.sendMessage(
      userId,
      messages[lang] || messages.en,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      }
    );
  } catch (error) {
    console.error('Failed to send feedback request:', error.message);
  }
}

async function handleRating(ctx, orderId, rating) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  feedbackState.set(userId, { orderId, rating, step: 'waiting_comment' });

  const messages = {
    ms: `⭐ Terima kasih! Anda memberi ${rating} bintang.\n\n💬 Sila taip komen atau feedback anda (atau skip dengan /skipfeedback):`,
    en: `⭐ Thank you! You gave ${rating} stars.\n\n💬 Please type your comment or feedback (or skip with /skipfeedback):`,
    zh: `⭐ 谢谢！您给了${rating}星。\n\n💬 请输入您的评论或反馈（或使用 /skipfeedback 跳过）：`,
    ta: `⭐ நன்றி! நீங்கள் ${rating} நட்சத்திரங்கள் கொடுத்தீர்கள்.\n\n💬 உங்கள் கருத்து அல்லது கருத்தை தட்டச்சு செய்யவும் (அல்லது /skipfeedback மூலம் தவிர்க்கவும்):`
  };

  await ctx.editMessageText(messages[lang] || messages.en, { parse_mode: 'Markdown' });
}

async function handleFeedbackComment(ctx) {
  const userId = ctx.from.id;
  const state = feedbackState.get(userId);

  if (!state || state.step !== 'waiting_comment') {
    return false;
  }

  const comment = ctx.message.text;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const feedback = {
    id: generateId('FBK'),
    orderId: state.orderId,
    userId: userId,
    rating: state.rating,
    comment: comment,
    createdAt: new Date().toISOString()
  };

  const feedbacks = await db.getFeedbacks();
  feedbacks.push(feedback);
  await db.saveFeedbacks(feedbacks);

  feedbackState.delete(userId);

  const messages = {
    ms: `✅ *Terima kasih atas feedback anda!*\n\n⭐ Rating: ${state.rating}/5\n💬 Komen: ${comment}\n\nFeedback anda sangat dihargai! 🙏`,
    en: `✅ *Thank you for your feedback!*\n\n⭐ Rating: ${state.rating}/5\n💬 Comment: ${comment}\n\nYour feedback is greatly appreciated! 🙏`,
    zh: `✅ *感谢您的反馈！*\n\n⭐ 评分：${state.rating}/5\n💬 评论：${comment}\n\n非常感谢您的反馈！🙏`,
    ta: `✅ *உங்கள் கருத்துக்கு நன்றி!*\n\n⭐ மதிப்பீடு: ${state.rating}/5\n💬 கருத்து: ${comment}\n\nஉங்கள் கருத்து மிகவும் பாராட்டப்படுகிறது! 🙏`
  };

  await ctx.reply(messages[lang] || messages.en, { parse_mode: 'Markdown' });

  return true;
}

async function handleSkipFeedback(ctx, orderId) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  feedbackState.delete(userId);

  const messages = {
    ms: '✅ Feedback dilangkau. Terima kasih!',
    en: '✅ Feedback skipped. Thank you!',
    zh: '✅ 已跳过反馈。谢谢！',
    ta: '✅ கருத்து தவிர்க்கப்பட்டது. நன்றி!'
  };

  await ctx.answerCbQuery(messages[lang] || messages.en);
}

async function handleViewFeedbacks(ctx) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');

  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized. Only admins can view feedbacks.');
    return;
  }

  const feedbacks = await db.getFeedbacks();

  if (feedbacks.length === 0) {
    await ctx.reply('No feedbacks yet.');
    return;
  }

  const sortedFeedbacks = feedbacks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);

  let message = '📝 *Customer Feedbacks*\n\n';

  sortedFeedbacks.forEach((fb, index) => {
    const stars = '⭐'.repeat(fb.rating);
    message += `${index + 1}. ${stars} (${fb.rating}/5)\n`;
    message += `   🆔 Order: ${fb.orderId}\n`;
    message += `   👤 User: ${fb.userId}\n`;
    message += `   💬 ${fb.comment || 'No comment'}\n`;
    message += `   📅 ${new Date(fb.createdAt).toLocaleDateString()}\n\n`;
  });

  if (feedbacks.length > 20) {
    message += `... and ${feedbacks.length - 20} more feedbacks`;
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

function clearFeedbackState(userId) {
  feedbackState.delete(userId);
}

module.exports = {
  sendFeedbackRequest,
  handleRating,
  handleFeedbackComment,
  handleSkipFeedback,
  handleViewFeedbacks,
  clearFeedbackState
};
