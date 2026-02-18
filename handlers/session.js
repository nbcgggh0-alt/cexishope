const { Markup } = require('telegraf');
const db = require('../utils/database');
const { t } = require('../utils/translations');
const { generateSessionToken, isSessionExpired, sanitizeText } = require('../utils/helpers');
const { safeEditMessage } = require('../utils/messageHelper');

async function handleSupport(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  // Optimize: Get only active session for user
  let activeSession = await db.getActiveSessionByUserId(userId);

  if (activeSession && isSessionExpired(activeSession.createdAt)) {
    activeSession.status = 'expired';
    activeSession.endedAt = new Date().toISOString();
    await db.saveSession(activeSession);
    activeSession = null;
  }

  if (!activeSession) {
    const token = generateSessionToken();

    const newSession = {
      token: token,
      userId: userId,
      adminId: null,
      status: 'active',
      createdAt: new Date().toISOString(),
      messages: []
    };

    await db.saveSession(newSession);

    await safeEditMessage(ctx, t('sessionCreated', lang, token), {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback(t('btnBack', lang), 'main_menu')]
      ])
    });

    const admins = await db.getAdmins();
    const allAdmins = [admins.owner, ...admins.admins].filter(Boolean);

    for (const adminId of allAdmins) {
      try {
        await ctx.telegram.sendMessage(
          adminId,
          `💬 *New Support Session*\n\nToken: \`${token}\`\nUser: ${userId}\n\nUse /join ${token} to enter session`,
          { parse_mode: 'Markdown' }
        );
      } catch (error) {
        console.error(`Failed to notify admin ${adminId}:`, error.message);
      }
    }
  } else {
    await safeEditMessage(ctx,
      `💬 You already have an active session.\n\nToken: \`${activeSession.token}\`\n\nType your message to chat with admin.`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔚 End Session', `end_session_${activeSession.token}`)],
          [Markup.button.callback(t('btnBack', lang), 'main_menu')]
        ])
      }
    );
  }
}

async function handleJoinSession(ctx, token) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('Unauthorized');
    return;
  }

  const session = await db.getSession(token);

  if (!session) {
    await ctx.reply('❌ Session not found');
    return;
  }

  if (session.status !== 'active') {
    await ctx.reply('⚠️ This session is no longer active.');
    return;
  }

  // If already claimed by another admin
  if (session.adminId && session.adminId !== userId) {
    await ctx.reply(`⚠️ This session is already claimed by Admin ${session.adminId}`);
    return;
  }

  // Claim logic
  // Update DB refetch to ensure we have fresh state if needed, but 'session' var is usually fine
  session.adminId = userId;
  session.lastActiveAt = new Date().toISOString();
  await db.saveSession(session);

  // Set this as the ONLY active session for convenience (focus mode)
  const adminSessions = await db.getActiveSessionsByAdminId(userId);
  for (const s of adminSessions) {
    if (s.token !== token) {
      s.isActiveSession = false;
      await db.saveSession(s);
    }
  }
  // Re-fetch to update local obj
  session.isActiveSession = true;
  await db.saveSession(session);

  // 1. Notify User
  try {
    await ctx.telegram.sendMessage(
      session.userId,
      '👨‍💼 *Support Admin Connected!*\n\nAn admin has joined the chat. You can now talk directly.',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Failed to notify user:', error.message);
  }

  // 2. Show Admin the "User Profile Card"
  const user = await db.getUser(session.userId);
  const transactions = await db.getTransactions();
  const userOrders = transactions.filter(t => t.userId === session.userId);
  const lastOrder = userOrders.length > 0 ? userOrders[userOrders.length - 1] : null;
  const lang = user?.language || 'ms';

  let profileMsg = `✅ *CONNECTED TO TICKET*\n`;
  profileMsg += `🎫 Token: \`${token}\`\n\n`;

  profileMsg += `👤 *User Profile*\n`;
  profileMsg += `🆔 ID: \`${session.userId}\`\n`;
  profileMsg += `🗣️ Lang: ${lang.toUpperCase()}\n`;
  profileMsg += `📦 Total Orders: ${userOrders.length}\n`;

  if (user.notes) {
    profileMsg += `\n📝 *ADMIN NOTES:*\n_${user.notes}_\n`;
  }


  if (lastOrder) {
    profileMsg += `🛒 *Last Order*\n`;
    profileMsg += `🆔 ${lastOrder.id} (${lastOrder.status})\n`;
    profileMsg += `📅 ${new Date(lastOrder.createdAt).toLocaleDateString()}\n`;
  } else {
    profileMsg += `🛒 *No orders yet*\n`;
  }

  profileMsg += `\n💬 *You are now chatting with this user.*`;

  const controls = [
    [Markup.button.callback('🛑 Close Ticket', `end_session_${token}`), Markup.button.callback('🔙 Dashboard', 'refresh_sessions')],
    [Markup.button.callback('📝 Quick Reply', `quick_reply_${token}`)] // Placeholder for future feature
  ];

  await ctx.reply(profileMsg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(controls) });
}

async function handleEndSession(ctx, token) {
  const session = await db.getSession(token);

  if (!session) {
    await ctx.answerCbQuery('Session not found');
    return;
  }

  if (session.status === 'ended') {
    await ctx.answerCbQuery('Session already ended');
    return;
  }

  session.status = 'ended';
  session.endedAt = new Date().toISOString();
  await db.saveSession(session);

  // 1. Notify User
  try {
    const user = await db.getUser(session.userId);
    const lang = user?.language || 'ms';

    // If triggered by admin (ctx.from.id != session.userId), send msg to user
    // If triggered by user, send msg to user (edit)
    // We'll just assume standard notification

    await ctx.telegram.sendMessage(
      session.userId,
      lang === 'ms'
        ? '✅ *Sesi Tamat*\nTerima kasih kerana menghubungi kami. Hubungi kami semula jika ada sebarang pertanyaan.'
        : '✅ *Session Ended*\nThank you for contacting support. Feel free to contact us again if you have more questions.',
      { parse_mode: 'Markdown' }
    );
    // Send Rating Prompt (only if admin was involved)
    if (session.adminId) {
      const ratingMsg = lang === 'ms'
        ? '⭐ *Bagaimana perkhidmatan kami?*\n\nSila beri rating pengalaman anda:'
        : '⭐ *How was our service?*\n\nPlease rate your experience:';

      const ratingButtons = Markup.inlineKeyboard([
        [
          Markup.button.callback('⭐', `rate_${token}_1`),
          Markup.button.callback('⭐⭐', `rate_${token}_2`),
          Markup.button.callback('⭐⭐⭐', `rate_${token}_3`),
          Markup.button.callback('⭐⭐⭐⭐', `rate_${token}_4`),
          Markup.button.callback('⭐⭐⭐⭐⭐', `rate_${token}_5`)
        ]
      ]);

      await ctx.telegram.sendMessage(
        session.userId,
        ratingMsg,
        { parse_mode: 'Markdown', ...ratingButtons }
      );
    }
  } catch (e) {
    console.error('Failed to notify user on close:', e);
  }

  // 2. Generate Transcript for Admin (if there's an admin involved)
  if (session.adminId || (ctx.from.id !== session.userId)) {
    const adminToNotify = session.adminId || ctx.from.id; // Fallback to closer if no assigned admin

    let transcript = `TRANSCRIPT FOR TICKET: ${token}\n`;
    transcript += `User ID: ${session.userId}\n`;
    transcript += `Started: ${session.createdAt}\n`;
    transcript += `Ended: ${session.endedAt}\n`;
    transcript += `----------------------------------------\n\n`;

    session.messages.forEach(m => {
      const time = new Date(m.timestamp).toLocaleString();
      const sender = m.from === 'admin' ? 'ADMIN' : 'USER';
      let content = '';
      if (m.type === 'text') content = m.text;
      else content = `[${m.type.toUpperCase()}]`;

      transcript += `[${time}] ${sender}: ${content}\n`;
    });

    try {
      // Send file directly
      await ctx.telegram.sendDocument(adminToNotify, {
        source: Buffer.from(transcript, 'utf8'),
        filename: `ticket_${token}.txt`
      }, { caption: `✅ Ticket ${token} closed.` });
    } catch (err) {
      console.error('Failed to send transcript:', err);
    }
  }

  // If this was a callback query, answer it
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery('Ticket closed.');
    // Refresh list if called from dashboard
    // We can't easily jump back to handleListSessions from here without passing ctx cleanly or just sending new msg
    // Let's just suggest using /sessions
    await ctx.reply('🔒 Ticket closed. Use /sessions to return to dashboard.');
  }
}

async function handleLeaveSession(ctx, specificToken = null) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');

  if (!await isAdmin(userId)) {
    await ctx.reply('Unauthorized');
    return;
  }

  let adminSession;

  if (specificToken) {
    adminSession = await db.getSession(specificToken);
    if (!adminSession || adminSession.adminId !== userId || adminSession.status !== 'active') {
      adminSession = null;
    }
  } else {
    const activeSessions = await db.getActiveSessionsByAdminId(userId);

    if (activeSessions.length === 0) {
      await ctx.reply('You are not in any active session');
      return;
    }

    if (activeSessions.length > 1) {
      await ctx.reply('⚠️ You are in multiple sessions. Please specify which session to leave:\n\n`/leave [session_token]`\n\nUse /sessions to see all active sessions.', { parse_mode: 'Markdown' });
      return;
    }

    adminSession = activeSessions[0];
  }

  if (!adminSession) {
    await ctx.reply('❌ Session not found or you are not in this session');
    return;
  }

  const token = adminSession.token;
  adminSession.adminId = null;
  adminSession.isActiveSession = false;
  await db.saveSession(adminSession);

  const remainingSessions = (await db.getActiveSessionsByAdminId(userId)).length;
  let replyMsg = `✅ You have left session ${token}`;

  if (remainingSessions > 0) {
    replyMsg += `\n\nRemaining active sessions: ${remainingSessions}\nUse /sessions to view them`;
  }

  await ctx.reply(replyMsg);

  try {
    await ctx.telegram.sendMessage(
      adminSession.userId,
      '👨‍💼 Admin has left the support session.'
    );
  } catch (error) {
    console.error('Failed to notify user:', error.message);
  }
}

async function handleCloseSession(ctx) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');

  if (!await isAdmin(userId)) {
    await ctx.reply('Unauthorized');
    return;
  }

  const activeSessions = await db.getActiveSessionsByAdminId(userId);
  // Close the current active session (or first one)
  const adminSession = activeSessions.find(s => s.isActiveSession) || activeSessions[0];

  if (!adminSession) {
    await ctx.reply('You are not in any active session');
    return;
  }

  const token = adminSession.token;
  adminSession.status = 'ended';
  adminSession.endedAt = new Date().toISOString();
  await db.saveSession(adminSession);

  await ctx.reply(`✅ Session ${token} has been closed successfully`);

  try {
    await ctx.telegram.sendMessage(
      adminSession.userId,
      '✅ Support session has been closed by admin. Issue resolved!\n\nThank you for contacting support.'
    );
  } catch (error) {
    console.error('Failed to notify user:', error.message);
  }
}

async function handleSessionMessage(ctx) {
  const userId = ctx.from.id;
  const userSession = await db.getActiveSessionByUserId(userId);
  const adminSessions = await db.getActiveSessionsByAdminId(userId); // If user is admin

  let adminSession = null;

  if (adminSessions.length > 0) {
    adminSession = adminSessions.find(s => s.isActiveSession === true);

    if (!adminSession && adminSessions.length === 1) {
      adminSession = adminSessions[0];
    } else if (!adminSession && adminSessions.length > 1) {
      await ctx.reply(
        '⚠️ *Multiple Active Sessions Detected*\n\n' +
        'You are in multiple support sessions. Please choose an option:\n\n' +
        '1️⃣ Set active session: `/active [token]`\n' +
        '2️⃣ Send to specific session: `/msg [token] [message]`\n' +
        '3️⃣ View all sessions: `/sessions`\n\n' +
        '💡 Tip: Setting an active session allows you to send messages directly without specifying the token each time.',
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }

  // Check if message is a command (starts with /) - ignore commands handled by other handlers
  if (ctx.message.text && ctx.message.text.startsWith('/')) {
    return;
  }

  // 1. ADMIN REPLYING TO USER
  if (adminSession) {
    const messageData = {
      from: 'admin',
      type: 'unknown', // Detailed type will be inferred or we can just store 'copy'
      timestamp: new Date().toISOString()
    };

    // Attempt to store basic info (text/caption) for transcript
    if (ctx.message.text) {
      messageData.text = ctx.message.text;
      messageData.type = 'text';
    } else {
      messageData.type = 'media';
      messageData.caption = ctx.message.caption || '';
    }

    await db.addSessionMessage(adminSession.token, messageData);

    try {
      // Use copyMessage for robust media support (Stickers, functional features, etc.)
      await ctx.copyMessage(adminSession.userId);
    } catch (error) {
      console.error('Failed to copy message to user:', error.message);
      await ctx.reply('❌ Failed to send message.');
    }
  }

  // 2. USER MESSAGING ADMIN
  else if (userSession) {
    const messageData = {
      from: 'user',
      type: 'unknown',
      timestamp: new Date().toISOString()
    };

    if (ctx.message.text) {
      messageData.text = ctx.message.text;
      messageData.type = 'text';
    } else {
      messageData.type = 'media';
      messageData.caption = ctx.message.caption || '';
    }

    await db.addSessionMessage(userSession.token, messageData);

    if (userSession.adminId) {
      try {
        // Forward to Admin
        await ctx.copyMessage(userSession.adminId);
      } catch (error) {
        console.error('Failed to copy message to admin:', error.message);
      }
    } else {
      // WAITING FOR ADMIN (Debounce Logic)
      try {
        // Check sending history to prevent spam
        // We look for the last 'system_waiting' message in the session
        const messages = userSession.messages || [];
        const lastWaitingMsg = [...messages].reverse().find(m => m.type === 'system_waiting');

        const now = Date.now();
        const COOLDOWN = 30 * 60 * 1000; // 30 Minutes

        let shouldSend = true;
        if (lastWaitingMsg) {
          const lastTime = new Date(lastWaitingMsg.timestamp).getTime();
          if (now - lastTime < COOLDOWN) {
            shouldSend = false;
          }
        }

        if (shouldSend) {
          await ctx.reply('⏳ Your message has been saved. Waiting for an admin to join the session...');

          // Log this system message so we can debounce next time
          await db.addSessionMessage(userSession.token, {
            from: 'system',
            type: 'system_waiting',
            text: 'Waiting for admin prompt sent',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Failed to send waiting message:', error.message);
      }
    }
  }
}

async function handleListSessions(ctx) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');

  if (!await isAdmin(userId)) {
    await ctx.reply('Unauthorized');
    return;
  }

  // Fetch all sessions to separate them
  const allSessions = await db.getSessions();
  const activeSessions = allSessions.filter(s => s.status === 'active');

  const mySessions = activeSessions.filter(s => s.adminId === userId);
  const openSessions = activeSessions.filter(s => !s.adminId);
  const otherSessions = activeSessions.filter(s => s.adminId && s.adminId !== userId);

  let message = '🎫 *SUPPORT TICKET DASHBOARD*\n\n';

  const buttons = [];

  // 1. My Active Sessions
  if (mySessions.length > 0) {
    message += `👤 *YOUR ACTIVE TICKETS (${mySessions.length})*\n`;
    for (const s of mySessions) {
      const lastMsg = s.messages.length > 0 ? s.messages[s.messages.length - 1] : null;
      const lastTextRaw = lastMsg ? (lastMsg.type === 'text' ? lastMsg.text.substring(0, 20) : `[${lastMsg.type}]`) : 'No messages';
      const lastText = sanitizeText(lastTextRaw);
      const time = new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      message += `• \`${s.token}\` (User ${s.userId}) - ${time}\n`;
      message += `  └ _${lastText}_\n\n`;

      buttons.push([Markup.button.callback(`🟢 Resume: ${s.token}`, `active_session_${s.token}`)]);
    }
  } else {
    message += '👤 *YOUR ACTIVE TICKETS*\n_No active tickets._\n\n';
  }

  // 2. Open Sessions (Waiting)
  if (openSessions.length > 0) {
    message += `🆕 *OPEN TICKETS (${openSessions.length})* - Waiting for support\n`;
    for (const s of openSessions) {
      const lastMsg = s.messages.length > 0 ? s.messages[s.messages.length - 1] : null;
      const lastTextRaw = lastMsg ? (lastMsg.type === 'text' ? lastMsg.text.substring(0, 20) : `[${lastMsg.type}]`) : 'No messages';
      const lastText = sanitizeText(lastTextRaw);
      const waitingTime = Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 60000); // minutes

      message += `• \`${s.token}\` (User ${s.userId}) - ${waitingTime}m ago\n`;
      message += `  └ _${lastText}_\n\n`;

      buttons.push([Markup.button.callback(`✋ Claim: ${s.token}`, `join_session_${s.token}`)]);
    }
  } else {
    message += '🆕 *OPEN TICKETS*\n_No pending tickets._\n\n';
  }

  // 3. Other Admin Sessions
  if (otherSessions.length > 0) {
    message += `👨‍💼 *OTHER AGENTS (${otherSessions.length})*\n`;
    message += `_Other admins are handling ${otherSessions.length} tickets._\n`;
  }

  buttons.push([Markup.button.callback('🔄 Refresh Dashboard', 'refresh_sessions')]);

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    } else {
      await ctx.reply(message, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    }
  } catch (e) {
    // Fallback if edit fails (e.g. same content)
    if (!ctx.callbackQuery) await ctx.reply('Error updating dashboard');
  }
}

async function handleSetActiveSession(ctx, token) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');

  if (!await isAdmin(userId)) {
    await ctx.reply('Unauthorized');
    return;
  }

  const adminSessions = await db.getActiveSessionsByAdminId(userId);
  const session = adminSessions.find(s => s.token === token && s.adminId === userId && s.status === 'active');

  if (!session) {
    await ctx.reply('❌ Session not found or you are not in this session');
    return;
  }

  // Deactivate others
  for (const s of adminSessions) {
    if (s.token !== token && s.isActiveSession) {
      s.isActiveSession = false;
      await db.saveSession(s);
    }
  }

  session.isActiveSession = true;
  session.lastActiveAt = new Date().toISOString();
  await db.saveSession(session);

  await ctx.reply(`✅ Active session set to ${token}\n\nYou can now send messages directly to this session.`);
}

async function handleSendToSession(ctx, token, message) {
  const userId = ctx.from.id;
  const { isAdmin } = require('./admin');

  if (!await isAdmin(userId)) {
    await ctx.reply('Unauthorized');
    return;
  }

  const session = await db.getSession(token);

  if (!session || session.adminId !== userId || session.status !== 'active') {
    await ctx.reply('❌ Session not found or you are not in this session');
    return;
  }

  const messageData = {
    from: 'admin',
    text: message,
    type: 'text',
    timestamp: new Date().toISOString()
  };

  await db.addSessionMessage(session.token, messageData);

  // Update last active
  session.lastActiveAt = new Date().toISOString();
  await db.saveSession(session);

  try {
    await ctx.telegram.sendMessage(
      session.userId,
      `👨‍💼 Admin: ${message}`
    );
    await ctx.reply(`✅ Message sent to session ${token}`);
  } catch (error) {
    console.error('Failed to send message:', error.message);
    await ctx.reply('❌ Failed to send message');
  }
}

async function handleRating(ctx, token, rating) {
  const userId = ctx.from.id;
  const session = await db.getSession(token);

  if (!session || session.userId !== userId) {
    await ctx.answerCbQuery('Invalid session');
    return;
  }

  // Save rating
  session.rating = rating;
  await db.saveSession(session);

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const thankYouMsg = lang === 'ms'
    ? `✅ Terima kasih atas rating ${rating} bintang!\n\nMaklum balas anda sangat dihargai. 🙏`
    : `✅ Thank you for your ${rating} star rating!\n\nYour feedback is greatly appreciated. 🙏`;

  try {
    // Edit the message to remove buttons
    await ctx.editMessageText(thankYouMsg, { parse_mode: 'Markdown' });
    await ctx.answerCbQuery('Rating received!');
  } catch (e) {
    // Fallback if edit fails
    await ctx.answerCbQuery('Rating received!');
    await ctx.reply(thankYouMsg, { parse_mode: 'Markdown' });
  }
}

module.exports = {
  handleSupport,
  handleJoinSession,
  handleLeaveSession,
  handleCloseSession,
  handleEndSession,
  handleSessionMessage,
  handleListSessions,
  handleSetActiveSession,
  handleSendToSession,
  handleRating
};
