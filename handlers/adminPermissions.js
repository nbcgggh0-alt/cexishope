const db = require('../utils/database');
const { Markup } = require('telegraf');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwner } = require('./owner');

// Permission types (using short keys to avoid Telegram 64-byte callback data limit)
const PERMISSIONS = {
  VERIFY_ORDERS: 'vo',
  MANAGE_PRODUCTS: 'mp',
  MANAGE_USERS: 'mu',
  VIEW_ANALYTICS: 'va',
  BROADCAST: 'bc',
  MANAGE_CATEGORIES: 'mc',
  EXPORT_DATA: 'ed',
  MANAGE_SETTINGS: 'ms'
};

// Full names for display
const PERMISSION_NAMES = {
  'vo': 'verify_orders',
  'mp': 'manage_products',
  'mu': 'manage_users',
  'va': 'view_analytics',
  'bc': 'broadcast',
  'mc': 'manage_categories',
  'ed': 'export_data',
  'ms': 'manage_settings'
};

async function getAdminPermissions(adminId) {
  return await db.getAdminPermissions(adminId);
}

async function setAdminPermissions(adminId, permissionsList) {
  await db.saveAdminPermissions(adminId, permissionsList);
}

async function hasPermission(adminId, permission) {
  if (await isOwner(adminId)) return true;

  const permissions = await getAdminPermissions(adminId);
  return permissions.includes(permission);
}

async function handlePermissionsManagement(ctx) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('❌ Only owner can manage permissions');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const admins = await db.getAdmins();
  const adminList = admins.admins || [];

  if (adminList.length === 0) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Tiada admin' : 'No admins');
    return;
  }

  let text = lang === 'ms'
    ? '🔐 *Pengurusan Permissions*\n\nPilih admin untuk edit permissions:'
    : '🔐 *Permissions Management*\n\nSelect admin to edit permissions:';

  const buttons = adminList.map(adminId => [
    Markup.button.callback(`👤 Admin ${adminId}`, `pm_${adminId}`)
  ]);

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'owner_panel')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleAdminPermissionsEdit(ctx, adminId) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const currentPermissions = await getAdminPermissions(parseInt(adminId));

  const permissionLabels = {
    [PERMISSIONS.VERIFY_ORDERS]: lang === 'ms' ? 'Verify Orders' : 'Verify Orders',
    [PERMISSIONS.MANAGE_PRODUCTS]: lang === 'ms' ? 'Urus Produk' : 'Manage Products',
    [PERMISSIONS.MANAGE_USERS]: lang === 'ms' ? 'Urus Pengguna' : 'Manage Users',
    [PERMISSIONS.VIEW_ANALYTICS]: lang === 'ms' ? 'Lihat Analitik' : 'View Analytics',
    [PERMISSIONS.BROADCAST]: lang === 'ms' ? 'Broadcast' : 'Broadcast',
    [PERMISSIONS.MANAGE_CATEGORIES]: lang === 'ms' ? 'Urus Kategori' : 'Manage Categories',
    [PERMISSIONS.EXPORT_DATA]: lang === 'ms' ? 'Export Data' : 'Export Data',
    [PERMISSIONS.MANAGE_SETTINGS]: lang === 'ms' ? 'Urus Tetapan' : 'Manage Settings'
  };

  let text = lang === 'ms'
    ? `🔐 *Permissions untuk Admin ${adminId}*\n\nKlik untuk toggle permissions:`
    : `🔐 *Permissions for Admin ${adminId}*\n\nClick to toggle permissions:`;

  const buttons = [];

  Object.entries(PERMISSIONS).forEach(([key, perm]) => {
    const hasP = currentPermissions.includes(perm);
    const icon = hasP ? '✅' : '❌';
    buttons.push([
      Markup.button.callback(
        `${icon} ${permissionLabels[perm]}`,
        `pt_${adminId}_${perm}`
      )
    ]);
  });

  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'perm_mgmt')]);

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleTogglePermission(ctx, adminId, permission) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const currentPermissions = await getAdminPermissions(parseInt(adminId));

  if (currentPermissions.includes(permission)) {
    // Remove permission
    const newPermissions = currentPermissions.filter(p => p !== permission);
    await setAdminPermissions(parseInt(adminId), newPermissions);
  } else {
    // Add permission
    currentPermissions.push(permission);
    await setAdminPermissions(parseInt(adminId), currentPermissions);
  }

  await ctx.answerCbQuery('✅ Updated');
  await handleAdminPermissionsEdit(ctx, adminId);
}

async function checkPermissionMiddleware(permission) {
  return async (ctx, next) => {
    const userId = ctx.from.id;

    if (await hasPermission(userId, permission)) {
      return next();
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    await ctx.reply(
      lang === 'ms'
        ? '❌ Anda tidak mempunyai permission untuk tindakan ini.'
        : '❌ You do not have permission for this action.'
    );
  };
}

async function getAdminActivity(adminId) {
  const logs = await db.getAdminLogs();
  return logs.filter(log => log.adminId === adminId)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 20);
}

async function handleAdminActivityLog(ctx, adminId) {
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const activity = await getAdminActivity(parseInt(adminId));

  if (activity.length === 0) {
    await ctx.answerCbQuery(lang === 'ms' ? 'Tiada aktiviti' : 'No activity');
    return;
  }

  let text = lang === 'ms'
    ? `📋 *Log Aktiviti Admin ${adminId}*\n\n`
    : `📋 *Activity Log for Admin ${adminId}*\n\n`;

  activity.slice(0, 10).forEach((log, index) => {
    text += `${index + 1}. ${log.action}\n`;
    text += `   📝 ${log.details || 'N/A'}\n`;
    text += `   📅 ${new Date(log.timestamp).toLocaleString()}\n\n`;
  });

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', `pm_${adminId}`)]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

module.exports = {
  PERMISSIONS,
  getAdminPermissions,
  setAdminPermissions,
  hasPermission,
  handlePermissionsManagement,
  handleAdminPermissionsEdit,
  handleTogglePermission,
  checkPermissionMiddleware,
  getAdminActivity,
  handleAdminActivityLog
};
