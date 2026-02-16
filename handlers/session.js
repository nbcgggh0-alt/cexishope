const { Markup } = require('telegraf');
const db = require('../utils/database');
const { t } = require('../utils/translations');
const { generateSessionToken, isSessionExpired } = require('../utils/helpers');
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
    await ctx.reply('Unauthorized');
    return;
  }

  const session = await db.getSession(token);

  if (!session) {
    await ctx.reply('Session not found');
    return;
  }

  if (session.status !== 'active') {
    await ctx.reply('Session is not active');
    return;
  }

  const adminSessions = await db.getActiveSessionsByAdminId(userId);

  if (!session.adminId) {
    session.adminId = userId;
  }

  session.lastActiveAt = new Date().toISOString();
  await db.saveSession(session);

  const queueManager = require('../utils/queueManager');
  const transactions = await db.getTransactions();
  const userOrders = transactions.filter(t =>
    t.userId === session.userId &&
    (t.status === 'pending' || t.status === 'awaiting_verification')
  );

  for (const order of userOrders) {
    const queuePos = await queueManager.getQueuePosition(order.id);
    if (queuePos && queuePos.status === 'waiting') {
      await queueManager.startProcessing(order.id, userId);
    }
  }

  const totalActiveSessions = adminSessions.length + 1;
  let replyMessage = `✅ Joined session ${token}\n\nUser: ${session.userId}\nActive Sessions: ${totalActiveSessions}\n\n`;

  if (totalActiveSessions > 1) {
    replyMessage += `📋 Managing multiple sessions:\n`;
    replyMessage += `• Use /sessions to view all active sessions\n`;
    replyMessage += `• Use /active ${token} to set this as active session\n`;
    replyMessage += `• Use /msg ${token} [message] to send to specific session\n`;
    replyMessage += `• Use /leave ${token} to leave this session\n\n`;
    replyMessage += `💡 Tip: Set active session to send messages directly`;
  } else {
    replyMessage += `Use /leave to exit session`;
  }

  await ctx.reply(replyMessage);

  try {
    await ctx.telegram.sendMessage(
      session.userId,
      '✅ Admin has joined your support session! You can now chat.'
    );
  } catch (error) {
    console.error('Failed to notify user:', error.message);
  }
}

async function handleEndSession(ctx, token) {
  const session = await db.getSession(token);

  if (!session) {
    await ctx.answerCbQuery('Session not found');
    return;
  }

  session.status = 'ended';
  session.endedAt = new Date().toISOString();
  await db.saveSession(session);

  const user = await db.getUser(ctx.from.id);
  const lang = user?.language || 'ms';

  await safeEditMessage(ctx, t('sessionEnded', lang), {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(t('btnHome', lang), 'main_menu')]
    ])
  });

  if (session.adminId) {
    try {
      await ctx.telegram.sendMessage(session.adminId, `Session ${token} ended by user`);
    } catch (error) {
      console.error('Failed to notify admin:', error.message);
    }
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

  const messageText = ctx.message.text;
  const messagePhoto = ctx.message.photo;
  const messageDocument = ctx.message.document;
  const messageAudio = ctx.message.audio;
  const messageVoice = ctx.message.voice;
  const messageVideo = ctx.message.video;
  const messageLocation = ctx.message.location;

  if (adminSession) {
    const messageData = {
      from: 'admin',
      timestamp: new Date().toISOString()
    };

    if (messageText) {
      messageData.text = messageText;
      messageData.type = 'text';
    } else if (messagePhoto) {
      messageData.photo = messagePhoto[messagePhoto.length - 1].file_id;
      messageData.type = 'photo';
      messageData.caption = ctx.message.caption || '';
    } else if (messageDocument) {
      messageData.document = messageDocument.file_id;
      messageData.fileName = messageDocument.file_name;
      messageData.mimeType = messageDocument.mime_type;
      messageData.type = 'document';
      messageData.caption = ctx.message.caption || '';
    } else if (messageAudio) {
      messageData.audio = messageAudio.file_id;
      messageData.duration = messageAudio.duration;
      messageData.type = 'audio';
      messageData.caption = ctx.message.caption || '';
    } else if (messageVoice) {
      messageData.voice = messageVoice.file_id;
      messageData.duration = messageVoice.duration;
      messageData.type = 'voice';
    } else if (messageVideo) {
      messageData.video = messageVideo.file_id;
      messageData.duration = messageVideo.duration;
      messageData.type = 'video';
      messageData.caption = ctx.message.caption || '';
    } else if (messageLocation) {
      messageData.location = {
        latitude: messageLocation.latitude,
        longitude: messageLocation.longitude
      };
      messageData.type = 'location';
    }

    await db.addSessionMessage(adminSession.token, messageData);

    try {
      if (messageText) {
        await ctx.telegram.sendMessage(
          adminSession.userId,
          `👨‍💼 Admin: ${messageText}`
        );
      } else if (messagePhoto) {
        await ctx.telegram.sendPhoto(
          adminSession.userId,
          messagePhoto[messagePhoto.length - 1].file_id,
          {
            caption: `👨‍💼 Admin sent a photo${ctx.message.caption ? ':\n' + ctx.message.caption : ''}`
          }
        );
      } else if (messageDocument) {
        await ctx.telegram.sendDocument(
          adminSession.userId,
          messageDocument.file_id,
          {
            caption: `👨‍💼 Admin sent a file${ctx.message.caption ? ':\n' + ctx.message.caption : ''}`
          }
        );
      } else if (messageAudio) {
        await ctx.telegram.sendAudio(
          adminSession.userId,
          messageAudio.file_id,
          {
            caption: `👨‍💼 Admin sent an audio${ctx.message.caption ? ':\n' + ctx.message.caption : ''}`
          }
        );
      } else if (messageVoice) {
        await ctx.telegram.sendVoice(
          adminSession.userId,
          messageVoice.file_id,
          {
            caption: `👨‍💼 Admin sent a voice message`
          }
        );
      } else if (messageVideo) {
        await ctx.telegram.sendVideo(
          adminSession.userId,
          messageVideo.file_id,
          {
            caption: `👨‍💼 Admin sent a video${ctx.message.caption ? ':\n' + ctx.message.caption : ''}`
          }
        );
      } else if (messageLocation) {
        await ctx.telegram.sendLocation(
          adminSession.userId,
          messageLocation.latitude,
          messageLocation.longitude
        );
        await ctx.telegram.sendMessage(
          adminSession.userId,
          `👨‍💼 Admin shared a location`
        );
      }
    } catch (error) {
      console.error('Failed to forward message:', error.message);
    }
  } else if (userSession) {
    const messageData = {
      from: 'user',
      timestamp: new Date().toISOString()
    };

    if (messageText) {
      messageData.text = messageText;
      messageData.type = 'text';
    } else if (messagePhoto) {
      messageData.photo = messagePhoto[messagePhoto.length - 1].file_id;
      messageData.type = 'photo';
      messageData.caption = ctx.message.caption || '';
    } else if (messageDocument) {
      messageData.document = messageDocument.file_id;
      messageData.fileName = messageDocument.file_name;
      messageData.mimeType = messageDocument.mime_type;
      messageData.type = 'document';
      messageData.caption = ctx.message.caption || '';
    } else if (messageAudio) {
      messageData.audio = messageAudio.file_id;
      messageData.duration = messageAudio.duration;
      messageData.type = 'audio';
      messageData.caption = ctx.message.caption || '';
    } else if (messageVoice) {
      messageData.voice = messageVoice.file_id;
      messageData.duration = messageVoice.duration;
      messageData.type = 'voice';
    } else if (messageVideo) {
      messageData.video = messageVideo.file_id;
      messageData.duration = messageVideo.duration;
      messageData.type = 'video';
      messageData.caption = ctx.message.caption || '';
    } else if (messageLocation) {
      messageData.location = {
        latitude: messageLocation.latitude,
        longitude: messageLocation.longitude
      };
      messageData.type = 'location';
    }

    await db.addSessionMessage(userSession.token, messageData);

    if (userSession.adminId) {
      try {
        if (messageText) {
          await ctx.telegram.sendMessage(
            userSession.adminId,
            `👤 User ${userId}: ${messageText}`
          );
        } else if (messagePhoto) {
          await ctx.telegram.sendPhoto(
            userSession.adminId,
            messagePhoto[messagePhoto.length - 1].file_id,
            {
              caption: `👤 User ${userId} sent a photo${ctx.message.caption ? ':\n' + ctx.message.caption : ''}`
            }
          );
        } else if (messageDocument) {
          await ctx.telegram.sendDocument(
            userSession.adminId,
            messageDocument.file_id,
            {
              caption: `👤 User ${userId} sent a file${ctx.message.caption ? ':\n' + ctx.message.caption : ''}`
            }
          );
        } else if (messageAudio) {
          await ctx.telegram.sendAudio(
            userSession.adminId,
            messageAudio.file_id,
            {
              caption: `👤 User ${userId} sent an audio${ctx.message.caption ? ':\n' + ctx.message.caption : ''}`
            }
          );
        } else if (messageVoice) {
          await ctx.telegram.sendVoice(
            userSession.adminId,
            messageVoice.file_id,
            {
              caption: `👤 User ${userId} sent a voice message`
            }
          );
        } else if (messageVideo) {
          await ctx.telegram.sendVideo(
            userSession.adminId,
            messageVideo.file_id,
            {
              caption: `👤 User ${userId} sent a video${ctx.message.caption ? ':\n' + ctx.message.caption : ''}`
            }
          );
        } else if (messageLocation) {
          await ctx.telegram.sendLocation(
            userSession.adminId,
            messageLocation.latitude,
            messageLocation.longitude
          );
          await ctx.telegram.sendMessage(
            userSession.adminId,
            `👤 User ${userId} shared a location`
          );
        }
      } catch (error) {
        console.error('Failed to forward message:', error.message);
      }
    } else {
      try {
        await ctx.reply('⏳ Your message has been saved. Waiting for an admin to join the session...');
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

  const adminSessions = await db.getActiveSessionsByAdminId(userId);

  if (adminSessions.length === 0) {
    await ctx.reply('❌ You are not in any active sessions');
    return;
  }

  let message = `📋 *Your Active Sessions (${adminSessions.length})*\n\n`;

  for (const session of adminSessions) {
    const isActive = session.isActiveSession ? '✅ ' : '';
    message += `${isActive}Token: \`${session.token}\`\n`;
    message += `User: ${session.userId}\n`;
    message += `Messages: ${session.messages.length}\n`;
    message += `Started: ${new Date(session.createdAt).toLocaleString()}\n\n`;
  }

  message += `\n💡 *Commands:*\n`;
  message += `• /active [token] - Set active session\n`;
  message += `• /msg [token] [message] - Send to specific session\n`;
  message += `• /leave [token] - Leave specific session`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
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

module.exports = {
  handleSupport,
  handleJoinSession,
  handleLeaveSession,
  handleCloseSession,
  handleEndSession,
  handleSessionMessage,
  handleListSessions,
  handleSetActiveSession,
  handleSendToSession
};
