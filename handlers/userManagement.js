const { Markup } = require('telegraf');
const db = require('../utils/database');
const { t } = require('../utils/translations');
const { logAdminAction } = require('../utils/adminLogger');
const supabase = require('../utils/supabase');

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

async function handleUserSearch(ctx) {
  const adminId = ctx.from.id;
  if (!await isOwnerOrAdmin(adminId)) return;

  const query = ctx.message.text.split(' ').slice(1).join(' '); // /searchuser query

  if (!query) {
    await ctx.reply('Usage: /searchuser [id|username]');
    return;
  }

  const users = await db.searchUsers(query);

  if (users.length === 0) {
    await ctx.reply('❌ No users found.');
    return;
  }

  if (users.length > 1) {
    let msg = `🔍 *Found ${users.length} users:*\n\n`;
    users.forEach(u => {
      msg += `• \`${u.id}\` - ${u.username ? '@' + u.username : 'No Username'}\n`;
    });
    msg += `\nUse specific ID to select.`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
    return;
  }

  const user = users[0];

  // Get Order Stats
  const { count: orderCount } = await supabase
    .from('cexi_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { data: lastOrder } = await supabase
    .from('cexi_transactions')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const lastActive = lastOrder ? new Date(lastOrder.created_at).toLocaleDateString() : 'Never';
  const joined = new Date(user.created_at || Date.now()).toLocaleDateString();

  const text = `👤 *USER PROFILE*\n\n` +
    `🆔 ID: \`${user.id}\`\n` +
    `👤 Username: ${user.username ? '@' + user.username : 'None'}\n` +
    `🏷️ Tags: ${user.tags ? user.tags.join(', ') : 'None'}\n` +
    `🚫 Banned: ${user.banned ? 'YES 🔴' : 'NO 🟢'}\n` +
    `📅 Joined: ${joined}\n` +
    `📦 Orders: ${orderCount || 0}\n` +
    `🕒 Last Order: ${lastActive}\n` +
    `🌐 Language: ${user.language || 'ms'}`;

  const buttons = [
    [
      Markup.button.callback(user.banned ? '✅ Unban' : '🚫 Ban', user.banned ? `unban_user_${user.id}` : `ban_user_prompt_${user.id}`),
      Markup.button.callback('🏷️ Modify Tags', `tag_user_prompt_${user.id}`)
    ],
    [Markup.button.callback('📦 View Orders', `admin_orders_${user.id}`)] // Reuse admin order view? Or new handler
  ];

  await ctx.reply(text, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
}

async function handleAdminUserOrders(ctx, targetUserId) {
  if (!await isOwnerOrAdmin(ctx.from.id)) return;

  const transactions = await db.getTransactions();
  const userOrders = transactions
    .filter(t => t.userId == targetUserId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10); // Last 10

  if (userOrders.length === 0) {
    await ctx.reply('❌ No orders found for this user.');
    return;
  }

  let msg = `📦 *Recent Orders for User ${targetUserId}*\n\n`;
  userOrders.forEach((o, i) => {
    const date = new Date(o.createdAt).toLocaleDateString();
    const statusIcon = o.status === 'completed' ? '✅' : (o.status === 'pending' ? '⏳' : '❌');
    msg += `${i + 1}. \`${o.id}\` | RM${o.price} | ${statusIcon} ${o.status}\n   📅 ${date} | 📦 ${o.productName?.en || o.productName}\n\n`;
  });

  await ctx.reply(msg, { parse_mode: 'Markdown' });
}

module.exports = {
  handleBanUser,
  handleUnbanUser,
  handleTagUser,
  handleUntagUser,
  handleListBannedUsers,
  handleUserSearch,
  handleAdminUserOrders,
  checkIfBanned,
  isOwnerOrAdmin
};
