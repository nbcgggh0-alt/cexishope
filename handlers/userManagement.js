const { Markup } = require('telegraf');
const db = require('../utils/database');
const { t } = require('../utils/translations');
const { logAdminAction } = require('../utils/adminLogger');

async function isOwnerOrAdmin(userId) {
  const admins = await db.getAdmins();
  return admins.owner === userId || admins.admins.includes(userId);
}

async function handleBanUser(ctx, targetUserId, reason = 'No reason provided') {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can ban users.');
    return;
  }
  
  if (!targetUserId) {
    await ctx.reply('Usage: /ban [user_id] [reason]\n\nExample: /ban 123456 Spam messages');
    return;
  }
  
  const users = await db.getUsers();
  const user = users.find(u => u.id == targetUserId);
  
  if (!user) {
    await ctx.reply(`❌ User ${targetUserId} not found in database.`);
    return;
  }
  
  if (user.banned) {
    await ctx.reply(`⚠️ User ${targetUserId} is already banned.`);
    return;
  }
  
  await db.updateUser(user.id, {
    banned: true,
    bannedAt: new Date().toISOString(),
    bannedBy: adminId,
    bannedReason: reason
  });
  
  await logAdminAction(adminId, 'Banned User', `User ${targetUserId} - Reason: ${reason}`);
  
  await ctx.reply(`✅ User ${targetUserId} has been banned.\n\n📝 Reason: ${reason}\n👤 Banned by: ${adminId}`);
  
  try {
    await ctx.telegram.sendMessage(
      targetUserId,
      `🚫 *You have been banned from this store.*\n\n📝 Reason: ${reason}\n\nPlease contact admin if you think this is a mistake.`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Could not notify banned user:', error.message);
  }
}

async function handleUnbanUser(ctx, targetUserId) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can unban users.');
    return;
  }
  
  if (!targetUserId) {
    await ctx.reply('Usage: /unban [user_id]\n\nExample: /unban 123456');
    return;
  }
  
  const users = await db.getUsers();
  const user = users.find(u => u.id == targetUserId);
  
  if (!user) {
    await ctx.reply(`❌ User ${targetUserId} not found in database.`);
    return;
  }
  
  if (!user.banned) {
    await ctx.reply(`⚠️ User ${targetUserId} is not banned.`);
    return;
  }
  
  await db.updateUser(user.id, {
    banned: false,
    bannedAt: null,
    bannedBy: null,
    bannedReason: null
  });
  
  await logAdminAction(adminId, 'Unbanned User', `User ${targetUserId} was unbanned`);
  
  await ctx.reply(`✅ User ${targetUserId} has been unbanned.\n\nThey can now use the store again.`);
  
  try {
    await ctx.telegram.sendMessage(
      targetUserId,
      `✅ *You have been unbanned!*\n\nYou can now use the store again. Welcome back! 🎉`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Could not notify unbanned user:', error.message);
  }
}

async function handleTagUser(ctx, targetUserId, tag) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can tag users.');
    return;
  }
  
  if (!targetUserId || !tag) {
    await ctx.reply('Usage: /tag [user_id] [tag]\n\nExample: /tag 123456 VIP\n\nAvailable tags: VIP, Premium, Reseller, Problematic, New');
    return;
  }
  
  const users = await db.getUsers();
  const user = users.find(u => u.id == targetUserId);
  
  if (!user) {
    await ctx.reply(`❌ User ${targetUserId} not found in database.`);
    return;
  }
  
  const currentTags = user.tags || [];
  
  if (currentTags.includes(tag)) {
    await ctx.reply(`⚠️ User ${targetUserId} already has tag: ${tag}`);
    return;
  }
  
  currentTags.push(tag);
  
  await db.updateUser(user.id, {
    tags: currentTags
  });
  
  await ctx.reply(`✅ Tag "${tag}" added to user ${targetUserId}\n\n🏷️ Current tags: ${currentTags.join(', ')}`);
}

async function handleUntagUser(ctx, targetUserId, tag) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can untag users.');
    return;
  }
  
  if (!targetUserId || !tag) {
    await ctx.reply('Usage: /untag [user_id] [tag]\n\nExample: /untag 123456 VIP');
    return;
  }
  
  const users = await db.getUsers();
  const user = users.find(u => u.id == targetUserId);
  
  if (!user) {
    await ctx.reply(`❌ User ${targetUserId} not found in database.`);
    return;
  }
  
  const currentTags = user.tags || [];
  
  if (!currentTags.includes(tag)) {
    await ctx.reply(`⚠️ User ${targetUserId} does not have tag: ${tag}`);
    return;
  }
  
  const updatedTags = currentTags.filter(t => t !== tag);
  
  await db.updateUser(user.id, {
    tags: updatedTags
  });
  
  await ctx.reply(`✅ Tag "${tag}" removed from user ${targetUserId}\n\n🏷️ Remaining tags: ${updatedTags.length > 0 ? updatedTags.join(', ') : 'None'}`);
}

async function handleListBannedUsers(ctx) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can view banned users.');
    return;
  }
  
  const users = await db.getUsers();
  const bannedUsers = users.filter(u => u.banned);
  
  if (bannedUsers.length === 0) {
    await ctx.reply('✅ No banned users at the moment.');
    return;
  }
  
  let message = '🚫 *Banned Users List*\n\n';
  
  bannedUsers.forEach((user, index) => {
    message += `${index + 1}. 👤 ID: ${user.id}\n`;
    message += `   📝 Reason: ${user.bannedReason || 'N/A'}\n`;
    message += `   📅 Banned: ${new Date(user.bannedAt).toLocaleDateString()}\n\n`;
  });
  
  message += `\nUse /unban [user_id] to unban a user.`;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function checkIfBanned(userId) {
  const user = await db.getUser(userId);
  return user?.banned === true;
}

module.exports = {
  handleBanUser,
  handleUnbanUser,
  handleTagUser,
  handleUntagUser,
  handleListBannedUsers,
  checkIfBanned,
  isOwnerOrAdmin
};
