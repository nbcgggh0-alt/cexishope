const { Markup } = require('telegraf');
const db = require('../utils/database');
const { generateId } = require('../utils/helpers');
const { isOwnerOrAdmin } = require('./userManagement');

// Auto-Reply Templates
async function handleAddTemplate(ctx, keyword, response) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can add templates.');
    return;
  }

  if (!keyword || !response) {
    await ctx.reply(
      '📝 *Add Quick Reply Template*\n\n' +
      'Usage: /addtemplate [keyword] | [response]\n\n' +
      'Example:\n' +
      '/addtemplate payment | Please scan the QR code and upload your payment proof using /send command\n\n' +
      'Admins can use /qt [keyword] to send templates quickly!',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const templates = await db.getTemplates();

  const existingTemplate = templates.find(t => t.keyword.toLowerCase() === keyword.toLowerCase());

  if (existingTemplate) {
    await ctx.reply(`⚠️ Template with keyword "${keyword}" already exists. Use /edittemplate to update it.`);
    return;
  }

  const newTemplate = {
    id: generateId('TPL'),
    keyword: keyword.toLowerCase(),
    response: response,
    createdBy: adminId,
    createdAt: new Date().toISOString(),
    usageCount: 0
  };

  templates.push(newTemplate);
  await db.saveTemplates(templates);

  await ctx.reply(
    `✅ *Template Added!*\n\n` +
    `🔑 Keyword: \`${keyword}\`\n` +
    `📝 Response:\n${response}\n\n` +
    `Use: /qt ${keyword}`,
    { parse_mode: 'Markdown' }
  );
}

async function handleQuickTemplate(ctx, keyword) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can use quick templates.');
    return;
  }

  if (!keyword) {
    const templates = await db.getTemplates();

    if (templates.length === 0) {
      await ctx.reply('No templates found. Use /addtemplate to create one.');
      return;
    }

    let message = '📝 *Available Templates:*\n\n';
    templates.forEach((t, index) => {
      message += `${index + 1}. \`/qt ${t.keyword}\`\n   📝 ${t.response.substring(0, 50)}${t.response.length > 50 ? '...' : ''}\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }

  const templates = await db.getTemplates();
  const template = templates.find(t => t.keyword.toLowerCase() === keyword.toLowerCase());

  if (!template) {
    await ctx.reply(`❌ Template "${keyword}" not found. Use /qt to see available templates.`);
    return;
  }

  // Update usage count
  template.usageCount = (template.usageCount || 0) + 1;
  await db.saveTemplates(templates);

  // Send template response
  await ctx.reply(template.response);
}

async function handleListTemplates(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized.');
    return;
  }

  const templates = await db.getTemplates();

  if (templates.length === 0) {
    await ctx.reply('No templates found. Use /addtemplate to create one.');
    return;
  }

  let message = '📝 *Quick Reply Templates*\n\n';

  templates.forEach((t, index) => {
    message += `${index + 1}. 🔑 \`${t.keyword}\`\n`;
    message += `   📝 ${t.response}\n`;
    message += `   📊 Used: ${t.usageCount || 0} times\n\n`;
  });

  message += '\nUse /qt [keyword] to send a template';

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

// FAQ Bot
async function handleAddFAQ(ctx, question, answer) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can add FAQs.');
    return;
  }

  if (!question || !answer) {
    await ctx.reply(
      '❓ *Add FAQ*\n\n' +
      'Usage: /addfaq [question] | [answer]\n\n' +
      'Example:\n' +
      '/addfaq How to pay? | Scan the QR code and upload payment proof using /send\n\n' +
      'Users will get auto-replies when they ask these questions!',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const faqs = await db.getFAQs();

  const newFAQ = {
    id: generateId('FAQ'),
    question: question.toLowerCase(),
    answer: answer,
    keywords: question.toLowerCase().split(' ').filter(w => w.length > 2),
    createdBy: adminId,
    createdAt: new Date().toISOString(),
    triggerCount: 0
  };

  faqs.push(newFAQ);
  await db.saveFAQs(faqs);

  await ctx.reply(
    `✅ *FAQ Added!*\n\n` +
    `❓ Question: ${question}\n` +
    `💬 Answer:\n${answer}\n\n` +
    `Users asking similar questions will get this auto-reply!`,
    { parse_mode: 'Markdown' }
  );
}

async function handleFAQList(ctx) {
  try {
    const faqs = await db.getFAQs();
    const user = await db.getUser(ctx.from.id);
    const lang = user?.language || 'ms';

    if (faqs.length === 0) {
      await ctx.reply('No FAQs available yet. Contact admin for help.');
      return;
    }

    const MAX_LENGTH = 4000;
    let messages = [];
    let currentMessage = '❓ *Frequently Asked Questions*\n\n';

    for (let index = 0; index < faqs.length; index++) {
      const faq = faqs[index];
      let question = faq.question;
      let answer = faq.answer;

      if (question && typeof question === 'object' && question !== null) {
        question = question[lang] || question['ms'] || question['en'] || 'No question available';
      }

      if (answer && typeof answer === 'object' && answer !== null) {
        answer = answer[lang] || answer['ms'] || answer['en'] || 'No answer available';
      }

      question = String(question || 'No question available');
      answer = String(answer || 'No answer available');

      const faqEntry = `${index + 1}. *${question}*\n   💬 ${answer}\n\n`;

      if ((currentMessage + faqEntry).length > MAX_LENGTH) {
        messages.push(currentMessage);
        currentMessage = faqEntry;
      } else {
        currentMessage += faqEntry;
      }
    }

    if (currentMessage.length > 0) {
      messages.push(currentMessage);
    }

    for (const msg of messages) {
      await ctx.reply(msg, { parse_mode: 'Markdown' });
    }
  } catch (error) {
    console.error('Error in handleFAQList:', error);
    await ctx.reply('❌ Error loading FAQs. Please try again later or contact admin.');
  }
}

async function checkFAQResponse(message, userId) {
  const faqs = await db.getFAQs();

  if (faqs.length === 0) {
    return null;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const messageLower = message.toLowerCase();
  const messageWords = messageLower.split(' ').filter(w => w.length > 2);

  // Find matching FAQ
  for (const faq of faqs) {
    let question = faq.question;
    let answer = faq.answer;

    if (question && typeof question === 'object' && question !== null) {
      question = question[lang] || question['ms'] || question['en'] || '';
    }

    if (answer && typeof answer === 'object' && answer !== null) {
      answer = answer[lang] || answer['ms'] || answer['en'] || '';
    }

    question = String(question || '');
    answer = String(answer || '');

    // Check if question matches exactly or partially
    if (messageLower.includes(question.toLowerCase())) {
      faq.triggerCount = (faq.triggerCount || 0) + 1;
      await db.saveFAQs(faqs);
      return answer;
    }

    // Check keyword matching (at least 50% keywords match)
    if (faq.keywords && Array.isArray(faq.keywords)) {
      const matchingKeywords = faq.keywords.filter(k => messageWords.includes(k));
      if (matchingKeywords.length >= Math.ceil(faq.keywords.length * 0.5)) {
        faq.triggerCount = (faq.triggerCount || 0) + 1;
        await db.saveFAQs(faqs);
        return answer;
      }
    }
  }

  return null;
}

async function handleDeleteTemplate(ctx, keyword) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized.');
    return;
  }

  if (!keyword) {
    await ctx.reply('Usage: /deletetemplate [keyword]');
    return;
  }

  const templates = await db.getTemplates();
  const updatedTemplates = templates.filter(t => t.keyword.toLowerCase() === keyword.toLowerCase());

  if (templates.length === updatedTemplates.length) {
    await ctx.reply(`❌ Template "${keyword}" not found.`);
    return;
  }

  await db.saveTemplates(updatedTemplates);
  await ctx.reply(`✅ Template "${keyword}" deleted.`);
}

async function handleDeleteFAQ(ctx, faqId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized.');
    return;
  }

  if (!faqId) {
    await ctx.reply('Usage: /deletefaq [faq_id]\n\nUse /listfaqs to see all FAQ IDs.');
    return;
  }

  const faqs = await db.getFAQs();
  const updatedFAQs = faqs.filter(f => f.id !== faqId);

  if (faqs.length === updatedFAQs.length) {
    await ctx.reply(`❌ FAQ "${faqId}" not found.`);
    return;
  }

  await db.saveFAQs(updatedFAQs);
  await ctx.reply(`✅ FAQ deleted.`);
}

async function handleListFAQs(ctx) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized.');
    return;
  }

  const faqs = await db.getFAQs();

  if (faqs.length === 0) {
    await ctx.reply('No FAQs found. Use /addfaq to create one.');
    return;
  }

  let message = '❓ *All FAQs*\n\n';

  faqs.forEach((faq, index) => {
    message += `${index + 1}. 🆔 \`${faq.id}\`\n`;

    if (typeof faq.question === 'object') {
      message += `   ❓ MS: ${faq.question.ms || 'N/A'}\n`;
      message += `   ❓ EN: ${faq.question.en || 'N/A'}\n`;
    } else {
      message += `   ❓ ${faq.question}\n`;
    }

    if (typeof faq.answer === 'object') {
      const answerMs = faq.answer.ms || 'N/A';
      const answerEn = faq.answer.en || 'N/A';
      message += `   💬 MS: ${answerMs.substring(0, 50)}${answerMs.length > 50 ? '...' : ''}\n`;
      message += `   💬 EN: ${answerEn.substring(0, 50)}${answerEn.length > 50 ? '...' : ''}\n`;
    } else {
      message += `   💬 ${faq.answer}\n`;
    }

    message += `   📊 Triggered: ${faq.triggerCount || 0} times\n\n`;
  });

  message += '\nUse /deletefaq [id] to remove an FAQ';

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

module.exports = {
  handleAddTemplate,
  handleQuickTemplate,
  handleListTemplates,
  handleDeleteTemplate,
  handleAddFAQ,
  handleFAQList,
  handleListFAQs,
  handleDeleteFAQ,
  checkFAQResponse
};
