const { Telegraf, Markup } = require('telegraf');
const { handleStart, handleMainMenu, handleSettingsMenu, handleLanguageToggle, handleLanguageSelect, handleGuideMenu, handleUserGuide, handleAdminGuide, handleOwnerGuide } = require('./handlers/start');
const { handleBuyProducts, handleCategory, handleProductView, handleBuyProduct, handleConfirmBuy, handlePaymentMethodSelect } = require('./handlers/products');
const { handleSendPayment, handlePaymentSelection, handleViewPendingOrders } = require('./handlers/payment');
const { handleMyOrders, handleMyItems } = require('./handlers/orders');
const { handleCreateVoucher, handleRedeemVoucher, handleListVouchers, handleToggleVoucher, handleCheckVoucher } = require('./handlers/voucher');
const { handleAdminPanel, handleAdminOrders, handleVerifyOrder, handleRejectOrder, handleAdminProducts, handleAdminSessions, handleAdminBroadcast, handleBroadcastMessage, handleCheckAllOrderId, handleAdminStatistics, handleAllOrders, handleViewOrder, handleDeleteOrderConfirm, handleDeleteOrder } = require('./handlers/admin');
const { handleCategoryManagement, handleCategoryDetail, handleDeleteCategory, handleEditCategoryName, handleEditCategoryIcon, processCategoryEdit } = require('./handlers/categoryManagement');
const { handleProductManagementMenu, handleProductList, handleProductDetail, handleToggleProduct, handleDeleteProductConfirm, handleDeleteProduct, handleEditProductField, processProductEdit, handleLowStockProducts } = require('./handlers/productManagementImproved');
const { handleOwnerPanel, handleOwnerAdmins, handleSetOwner, handleAddAdmin, handleRemoveAdmin, handleOwnerSettings, handleOwnerBackup, handleOwnerAdvanced } = require('./handlers/owner');
const { handleAnalytics } = require('./handlers/ownerAnalytics');
const { handleServerPanel, handleViewPanel, handleServerPower, handleCreateServer, handleCreateServerWithUser, handleSetPrimary, handleDeletePanel, handleConfirmDeletePanel, handleHealthCheck: handlePteroHealthCheck, handleAddPanelStart } = require('./handlers/serverPanel');
const { handleSupport, handleJoinSession, handleLeaveSession, handleCloseSession, handleEndSession, handleSessionMessage, handleListSessions, handleSetActiveSession, handleSendToSession } = require('./handlers/session');
const { handleBanUser, handleUnbanUser, handleTagUser, handleUntagUser, handleListBannedUsers, checkIfBanned, handleUserSearch, handleAdminUserOrders } = require('./handlers/userManagement');
const { handleSearchOrders, handleFilterOrders, handleFilterCallback } = require('./handlers/orderSearch');
const { handleDuplicateProduct, handleInventoryHistory, handleStockAdjustment, handleAddItem, handleAddItems, handleAddItemsFile } = require('./handlers/productManagement');
const { handleAddTemplate, handleQuickTemplate, handleListTemplates, handleDeleteTemplate, handleAddFAQ, handleFAQList, handleListFAQs, handleDeleteFAQ, checkFAQResponse } = require('./handlers/autoReply');
const { handleSetCurrency, handleCurrencySelect, handleAdminRates, handleSetRate, handleResetRate, handleForceUpdateRates } = require('./handlers/currency');
const { handleRating, handleFeedbackComment, handleSkipFeedback, handleViewFeedbacks } = require('./handlers/feedback');
const { handlePaymentProof, isAwaitingProof, handleUploadProofPrompt, handleSkipProof } = require('./handlers/paymentProof');
const { handlePaymentSettings, handleSetBank, handleSetQR } = require('./handlers/paymentSettings');
const { handlePing } = require('./handlers/ping');
const { handleAutoPromotePanel, handleCreateBroadcast, handleScheduleMessage, handlePromoTemplates, handleUserTargeting, handlePromoAnalytics, handleABTesting, handleDiscountCodes, handleFlashSales, handleRepeatCampaigns, handleActiveCampaigns, handleBroadcastAll, handleBroadcastActive, handleBroadcastTagged, handleTargetAll, handleTargetActive, handleTargetTagged, handleTargetBuyers, handlePromoDetailedReport, handleCreateABTest, handleABTestResults, handlePauseAllCampaigns, handleViewSchedule, handleUsePromoTemplate, handleViewDiscount, handleDeleteDiscount, handleViewFlash, handleViewRepeat, handleScheduleMsg, handleAddPromoTemplate, handleCreateABTestCommand, handleCreateDiscount, handleCreateFlash, handleRepeatCampaign } = require('./handlers/autoPromote');
// ... imports ...
const {
  handleSystemPanel, handleUserStats, handleSalesAnalytics, handleAdminLogs,
  handleHealthCheck, handleStorageUsage, handleExportData, handleMaintenanceMode,
  handleBackupUI, handleErrorMonitor, handlePerformance, handleAPILimits,
  handleWebhookLogs, handleTransactionReports, handleInventoryAlerts,
  handleSessionAnalytics, handleEngagement, handleRevenue, handleImportData,
  handleSystemSettings, handleCacheManagement, handleExportUsers,
  handleExportProducts, handleExportTransactions, handleExportAll,
  handleStoreStatus, handleToggleStoreStatus, handleToggleMaintenance,
  handleEditSystemSettings, handleClearAdminLogs, handleCleanBackups,
  handleDetailedSalesReport, handleProcessImport
} = require('./handlers/systemFunctions');

// ...


const db = require('./utils/database');
const AutoUpdater = require('./utils/autoUpdater');
const { generateId } = require('./utils/helpers');
const { safeEditMessage } = require('./utils/messageHelper');
const { t } = require('./utils/translations');
const config = require('./config');
const { checkRateLimit } = require('./utils/security'); // Security Utils

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.static('public'));

// Express API to fetch initial session data
app.get('/', (req, res) => {
  res.send('CexiStore Web Server is Running. Append /chat.html?token=YOUR_TOKEN to enter a chat session.');
});

app.get('/api/session/:token', async (req, res) => {
  try {
    const session = await db.getSession(req.params.token);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

const bot = new Telegraf(config.TELEGRAM_BOT_TOKEN);

// Attach io to bot context so handlers can use it
bot.context.io = io;

// Setup socket.io connections
io.on('connection', (socket) => {
  console.log('🌐 Web Chat user connected:', socket.id);

  socket.on('join_session', (token) => {
    socket.join(token);
    console.log(`Socket ${socket.id} joined session ${token}`);
  });

  socket.on('send_message', async (data) => {
    try {
      if (!data.token || !data.text) return;
      const session = await db.getSession(data.token);
      if (!session || session.status !== 'active') {
        socket.emit('error', 'Session not active or not found');
        return;
      }

      const messageData = {
        from: data.sender || 'user',
        type: 'text',
        text: data.text,
        timestamp: new Date().toISOString()
      };

      await db.addSessionMessage(session.token, messageData);
      io.to(session.token).emit('new_message', messageData);

      // Forward to Telegram
      if (messageData.from === 'admin') {
        bot.telegram.sendMessage(session.userId, `👨‍💼 [Admin Web]: ${data.text}`);
      } else {
        if (session.adminId) {
          bot.telegram.sendMessage(session.adminId, `🌐 [User Web]: ${data.text}`);
        } else {
          socket.emit('new_message', {
            from: 'system',
            type: 'system_waiting',
            text: 'Waiting for an admin to join the session...',
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error('Socket message error:', err);
    }
  });

  socket.on('disconnect', () => {
    console.log('🌐 Web Chat user disconnected:', socket.id);
  });
});

// Start web server
const webPort = config.WEB_PORT || 3000;
server.listen(webPort, () => {
  console.log(`🌐 Web Server & WebSocket running on port ${webPort}`);
});

// Rate Limiting Middleware
bot.use(async (ctx, next) => {
  if (ctx.from) {
    const isAllowed = checkRateLimit(ctx.from.id);
    if (!isAllowed) {
      // Optional: Reply only once per blocked window to avoid spamming the blocked user
      // For now, we just ignore the request to save resources
      console.warn(`Rate limit exceeded for user ${ctx.from.id}`);
      return;
    }
  }
  return next();
});

// Safe wrapper for callback handlers to prevent crashes
function safeHandler(handler) {
  return async (ctx) => {
    try {
      await handler(ctx);
    } catch (error) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('🔴 HANDLER ERROR:');
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
      console.error('Handler:', handler.name || 'anonymous');
      console.error('User:', ctx?.from?.id, ctx?.from?.username);
      if (ctx.callbackQuery) {
        console.error('Callback data:', ctx.callbackQuery.data);
      }
      if (ctx.message?.text) {
        console.error('Message text:', ctx.message.text);
      }
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      try {
        if (ctx.callbackQuery) {
          await ctx.answerCbQuery('Error occurred. Please try again.').catch(() => { });
        }

        const user = await db.getUser(ctx?.from?.id);
        const lang = user?.language || 'ms';
        const msg = lang === 'ms' ? '❌ Ralat. Sila cuba lagi.' : '❌ Error. Please try again.';
        await ctx.reply(msg);
      } catch (replyErr) {
        console.error('Failed to send error response:', replyErr);
      }
    }
  };
}

// ... bot.action registrations ...

bot.action('edit_system_settings', safeHandler(async (ctx) => {
  await handleEditSystemSettings(ctx);
}));

bot.action('clear_admin_logs', safeHandler(async (ctx) => {
  // Add confirmation step? For now direct action as logic is simple
  await handleClearAdminLogs(ctx);
}));

bot.action('clean_old_backups', safeHandler(async (ctx) => {
  await handleCleanBackups(ctx);
}));

// NEW IMPROVEMENTS
const { handleBulkOperations, handleBulkActivateAll, handleBulkDeactivateAll, handleBulkPriceByCategory, handleBulkPriceCategorySelect, handleBulkStockByCategory, handleBulkStockCategorySelect, processBulkEdit, handleBulkDeleteInactive, handleBulkDeleteConfirm } = require('./handlers/productBulkOperations');
const { handleProductSearch, processProductSearch, handleProductFilter, handleFilterCallback: handleProductFilterCallback } = require('./handlers/productSearch');
const { handleCategorySort, handleCategorySortCallback, handleCategoryAnalytics, handleCategoryIconSelector, handleSetCategoryIcon } = require('./handlers/categoryAdvanced');
const { handleOwnerDashboard, handleDetailedReport, handleTrendAnalysis } = require('./handlers/ownerDashboard');
const { handleQuickActionsMenu, handleQuickVerify, handleQuickVerifyOrder, handleQuickRejectOrder, handleQuickVerifyAll, handleQuickStock, processQuickStock, handleQuickPrice, processQuickPrice } = require('./handlers/adminQuickActions');
const { initializeStockAlerts, sendManualStockAlert } = require('./handlers/stockAlerts');
const { handleProductStats, handleAllProductsStats } = require('./handlers/productStats');
const { exportProductsCSV, exportTransactionsCSV, exportUsersCSV, exportSalesReport, handleExportMenu } = require('./handlers/exportReports');
const { handlePermissionsManagement, handleAdminPermissionsEdit, handleTogglePermission, handleAdminActivityLog } = require('./handlers/adminPermissions');

// NEWEST FEATURES (November 2025)
const { handleProductOptions, handleAddOption, handleOptionDetail, handleToggleOptionRequired, handleDeleteOption, processOptionInput, handleOptionRequired } = require('./handlers/productOptions');
const { handleScheduledProducts, handleScheduleProduct, processScheduleInput, handleCancelSchedule, checkScheduledProducts } = require('./handlers/scheduledPublishing');
const { handleCategoryDiscounts, handleCategoryDiscountDetail, handleAddCategoryDiscount, processDiscountInput, handleRemoveCategoryDiscount, getDiscountedPrice } = require('./handlers/categoryDiscounts');
const { handleProductReviews, requestReview, handleRatingSelect, processReviewComment, handleViewAllReviews } = require('./handlers/reviewRating');
const { handleAdvancedOrderFilters, handleDateFilter, processCustomDateInput } = require('./handlers/advancedOrderFilter');
const { handleQuickEditMenu, handleQuickEditAction, processQuickEditInput } = require('./handlers/quickEditProduct');
const { handleProductImages, handleAddProductImage, processProductImage, handleViewProductImages, handleDeleteProductImage } = require('./handlers/productImageManagement');
const { handleQueuePanel, handleViewWaitingQueue, handleViewProcessingQueue, handleQueueSettings, handleStartProcessing, handleSetPriority, handleMyQueueStatus, handleSetQueueMax, handleSetQueueTime } = require('./handlers/queue');
const { handleAddProductStart, handleAddProductCategory, handleAddCategoryStart, handleAddStockStart, handleAddItemSingle, handleAddItemBulk, handleAdjustStockStart, handleDeliveryTypeSelect, processAdminFlowInput, getAdminFlow, clearAdminFlow, handleAddAdminStart, handleRemoveAdminStart, handleRemoveAdminConfirm, handleBanUserStart, handleUnbanUserStart, handleUnbanConfirm, handleTagUserStart } = require('./handlers/adminFlows');
const { handleUpdate, handleUpdateRestart, handleCheckUpdate } = require('./handlers/autoUpdate');




// Middleware to check if user is banned
bot.use(async (ctx, next) => {
  if (ctx.from) {
    const isBanned = await checkIfBanned(ctx.from.id);
    if (isBanned) {
      const user = await db.getUser(ctx.from.id);
      await ctx.reply(
        `🚫 *You are banned from using this store.*\n\n📝 Reason: ${user.bannedReason || 'No reason provided'}\n\nPlease contact admin if you think this is a mistake.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
  }
  return next();
});

bot.start(safeHandler(handleStart));

bot.command('send', safeHandler(handleSendPayment));

bot.command('pendingorders', safeHandler(handleViewPendingOrders));

bot.command('verify', safeHandler(async (ctx) => {
  const orderId = ctx.message.text.split(' ')[1];
  if (!orderId) {
    await ctx.reply('Usage: /verify [order_id]');
    return;
  }
  await handleVerifyOrder(ctx, orderId);
}));

bot.command('reject', safeHandler(async (ctx) => {
  const orderId = ctx.message.text.split(' ')[1];
  if (!orderId) {
    await ctx.reply('Usage: /reject [order_id]');
    return;
  }
  await handleRejectOrder(ctx, orderId);
}));

bot.command('checkallorderid', safeHandler(handleCheckAllOrderId));

bot.command('setowner', safeHandler(handleSetOwner));

bot.command('addadmin', safeHandler(async (ctx) => {
  const adminId = ctx.message.text.split(' ')[1];
  if (!adminId) {
    await ctx.reply('Usage: /addadmin [user_id]');
    return;
  }
  await handleAddAdmin(ctx, adminId);
}));

bot.command('removeadmin', safeHandler(async (ctx) => {
  const adminId = ctx.message.text.split(' ')[1];
  if (!adminId) {
    await ctx.reply('Usage: /removeadmin [user_id]');
    return;
  }
  await handleRemoveAdmin(ctx, adminId);
}));

bot.command('join', safeHandler(async (ctx) => {
  const token = ctx.message.text.split(' ')[1];
  if (!token) {
    await ctx.reply('Usage: /join [session_token]');
    return;
  }
  await handleJoinSession(ctx, token);
}));

bot.command('leave', safeHandler(async (ctx) => {
  const token = ctx.message.text.split(' ')[1];
  await handleLeaveSession(ctx, token);
}));

bot.command('close', safeHandler(handleCloseSession));

bot.command('sessions', safeHandler(handleListSessions));

bot.command('active', safeHandler(async (ctx) => {
  const token = ctx.message.text.split(' ')[1];
  if (!token) {
    await ctx.reply('Usage: /active [session_token]\n\nExample: /active SES-ABC123');
    return;
  }
  await handleSetActiveSession(ctx, token);
}));

bot.command('msg', safeHandler(async (ctx) => {
  const parts = ctx.message.text.split(' ');
  const token = parts[1];
  const message = parts.slice(2).join(' ');

  if (!token || !message) {
    await ctx.reply('Usage: /msg [session_token] [message]\n\nExample: /msg SES-ABC123 Hello, how can I help you?');
    return;
  }

  await handleSendToSession(ctx, token, message);
}));

// Queue Management Commands
bot.command('queue', safeHandler(handleMyQueueStatus));
bot.command('myqueue', safeHandler(handleMyQueueStatus));

bot.command('setqueuemax', safeHandler(handleSetQueueMax));
bot.command('setqueuetime', safeHandler(handleSetQueueTime));

// User Management Commands
bot.command('ban', safeHandler(async (ctx) => {
  const parts = ctx.message.text.split(' ');
  const userId = parts[1];
  const reason = parts.slice(2).join(' ') || 'No reason provided';
  await handleBanUser(ctx, userId, reason);
}));

bot.command('unban', safeHandler(async (ctx) => {
  const userId = ctx.message.text.split(' ')[1];
  await handleUnbanUser(ctx, userId);
}));

bot.command('tag', safeHandler(async (ctx) => {
  const parts = ctx.message.text.split(' ');
  const userId = parts[1];
  const tag = parts[2];
  await handleTagUser(ctx, userId, tag);
}));

bot.command('untag', safeHandler(async (ctx) => {
  const parts = ctx.message.text.split(' ');
  const userId = parts[1];
  const tag = parts[2];
  await handleUntagUser(ctx, userId, tag);
}));

bot.command('bannedlist', safeHandler(handleListBannedUsers));

// User Search & Actions
bot.command('searchuser', safeHandler(handleUserSearch));

bot.action(/^unban_user_(\d+)$/, safeHandler(async (ctx) => {
  await handleUnbanUser(ctx, ctx.match[1]);
}));

bot.action(/^ban_user_prompt_(\d+)$/, safeHandler(async (ctx) => {
  await handleBanUser(ctx, ctx.match[1], 'Banned via Admin Panel');
}));

bot.action(/^tag_user_prompt_(\d+)$/, safeHandler(async (ctx) => {
  await ctx.reply(`💡 To tag this user, type:\n\`/tag ${ctx.match[1]} [VIP|Reseller|Scammer]\``, { parse_mode: 'Markdown' });
}));

bot.action(/^admin_orders_(\d+)$/, safeHandler(async (ctx) => {
  await handleAdminUserOrders(ctx, ctx.match[1]);
}));

// Advanced Order Search
bot.command('searchorder', safeHandler(async (ctx) => {
  const query = ctx.message.text.replace('/searchorder', '').trim();

  // Check if user is searching their own order
  const { isAdmin } = require('./handlers/admin');
  const { isOwner } = require('./handlers/owner');
  const userId = ctx.from.id;
  const isAdminUser = await isAdmin(userId) || await isOwner(userId);

  if (!isAdminUser && query) {
    // Allow users to search their own orders
    const transactions = await db.getTransactions();
    const userOrder = transactions.find(t =>
      (t.id === query || t.id.toLowerCase() === query.toLowerCase()) &&
      t.userId === userId
    );

    if (userOrder) {
      const user = await db.getUser(userId);
      const lang = user?.language || 'ms';
      const statusEmoji = {
        'pending': '⏳',
        'awaiting_verification': '💳',
        'completed': '✅',
        'rejected': '❌'
      };

      let message = lang === 'ms' ? '🔍 *Maklumat Pesanan*\n\n' : '🔍 *Order Details*\n\n';
      message += `🆔 Order ID: \`${userOrder.id}\`\n`;
      message += `📦 Produk: ${userOrder.productName?.ms || userOrder.productName}\n`;
      message += `💰 Harga: RM${userOrder.price}\n`;
      message += `${statusEmoji[userOrder.status] || '📌'} Status: ${userOrder.status}\n`;
      message += `📅 Tarikh: ${new Date(userOrder.createdAt).toLocaleString('ms-MY')}\n\n`;

      if (userOrder.status === 'pending') {
        message += lang === 'ms'
          ? '💡 Gunakan `/send ${userOrder.id}` untuk hantar bukti pembayaran.'
          : '💡 Use `/send ${userOrder.id}` to submit payment proof.';
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });
      return;
    } else if (query) {
      const user = await db.getUser(userId);
      const lang = user?.language || 'ms';
      const msg = lang === 'ms'
        ? `❌ Pesanan tidak dijumpai!\n\n🆔 Order ID: \`${query}\`\n\n💡 Pastikan ID pesanan betul atau lihat "Pesanan Saya" di menu utama.`
        : `❌ Order not found!\n\n🆔 Order ID: \`${query}\`\n\n💡 Make sure the order ID is correct or check "My Orders" in main menu.`;
      await ctx.reply(msg, { parse_mode: 'Markdown' });
      return;
    }
  }

  await handleSearchOrders(ctx, query);
}));

bot.command('filterorders', safeHandler(handleFilterOrders));

// Product Management
bot.command('duplicate', safeHandler(async (ctx) => {
  const productId = ctx.message.text.split(' ')[1];
  await handleDuplicateProduct(ctx, productId);
}));

bot.command('inventory', safeHandler(async (ctx) => {
  const productId = ctx.message.text.split(' ')[1];
  await handleInventoryHistory(ctx, productId);
}));

bot.command('adjuststock', safeHandler(async (ctx) => {
  const parts = ctx.message.text.split(' ');
  const productId = parts[1];
  const adjustment = parts[2];
  const note = parts.slice(3).join(' ');
  await handleStockAdjustment(ctx, productId, adjustment, note);
}));

bot.command('additem', safeHandler(handleAddItem));

bot.command('additems', safeHandler(handleAddItems));

// Auto-Reply Templates & FAQ
bot.command('addtemplate', safeHandler(async (ctx) => {
  const input = ctx.message.text.replace('/addtemplate', '').trim();
  const parts = input.split('|').map(p => p.trim());
  await handleAddTemplate(ctx, parts[0], parts[1]);
}));

bot.command('qt', safeHandler(async (ctx) => {
  const keyword = ctx.message.text.replace('/qt', '').trim();
  await handleQuickTemplate(ctx, keyword);
}));

bot.command('templates', safeHandler(handleListTemplates));

bot.command('deletetemplate', safeHandler(async (ctx) => {
  const keyword = ctx.message.text.split(' ')[1];
  await handleDeleteTemplate(ctx, keyword);
}));

bot.command('addfaq', safeHandler(async (ctx) => {
  const input = ctx.message.text.replace('/addfaq', '').trim();
  const parts = input.split('|').map(p => p.trim());
  await handleAddFAQ(ctx, parts[0], parts[1]);
}));

bot.command('faq', safeHandler(handleFAQList));

bot.command('listfaqs', safeHandler(handleListFAQs));

bot.command('deletefaq', safeHandler(async (ctx) => {
  const faqId = ctx.message.text.split(' ')[1];
  await handleDeleteFAQ(ctx, faqId);
}));

// Admin & Owner shortcuts
bot.command('admin', safeHandler(handleAdminPanel));
bot.command('owner', safeHandler(handleOwnerPanel));
bot.command('analytics', safeHandler(handleAnalytics));

// Quick add panel: /upserver domain,ptla,ptlc
bot.command('upserver', safeHandler(async (ctx) => {
  const userId = ctx.from.id;
  const { isOwner } = require('./handlers/owner');
  if (!await isOwner(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const args = ctx.message.text.replace(/^\/upserver\s*/, '').trim();

  if (!args) {
    await ctx.reply(
      lang === 'ms'
        ? '❌ Format: `/upserver domain,ptla_key,ptlc_key`'
        : '❌ Format: `/upserver domain,ptla_key,ptlc_key`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const parts = args.split(',').map(s => s.trim());
  if (parts.length < 3) {
    await ctx.reply(
      lang === 'ms'
        ? '❌ Perlu 3 bahagian dipisah koma:\n`/upserver domain,ptla_key,ptlc_key`'
        : '❌ Need 3 comma-separated parts:\n`/upserver domain,ptla_key,ptlc_key`',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  let [domain, apiKeyApp, apiKeyClient] = parts;
  if (!domain.startsWith('http')) domain = 'https://' + domain;
  domain = domain.replace(/\/$/, '');

  await ctx.reply(lang === 'ms' ? '⏳ Menguji sambungan...' : '⏳ Testing connection...');

  const ptero = require('./utils/pteroAPI');
  const testPanel = { domain, apiKeyApp, apiKeyClient };
  const testResult = await ptero.testConnection(testPanel);

  const panels = await db.getPteroPanels();
  const panelNum = panels.length + 1;
  const isFirst = panels.length === 0;

  await db.addPteroPanel({
    name: `Panel ${panelNum}`,
    domain,
    apiKeyApp,
    apiKeyClient,
    status: testResult.success ? 'standby' : 'offline',
    isPrimary: isFirst
  });

  if (testResult.success) {
    await ctx.reply(
      lang === 'ms'
        ? `✅ *Panel ${panelNum} Ditambah!*\n\n🌐 ${domain}\n🟢 Sambungan OK\n${isFirst ? '⭐ Primary\n' : ''}`
        : `✅ *Panel ${panelNum} Added!*\n\n🌐 ${domain}\n🟢 Connection OK\n${isFirst ? '⭐ Primary\n' : ''}`,
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply(
      lang === 'ms'
        ? `⚠️ *Panel ${panelNum} Ditambah (Sambungan Gagal)*\n\n🌐 ${domain}\n🔴 Error: ${testResult.error}`
        : `⚠️ *Panel ${panelNum} Added (Connection Failed)*\n\n🌐 ${domain}\n🔴 Error: ${testResult.error}`,
      { parse_mode: 'Markdown' }
    );
  }
}));

// Currency & Feedback
// Currency & Feedback
bot.command('currency', safeHandler(handleSetCurrency));
// Admin Currency Management
bot.command('rates', safeHandler(handleAdminRates));
bot.command('setrate', safeHandler(handleSetRate));
bot.command('resetrate', safeHandler(handleResetRate));
bot.command('updaterates', safeHandler(handleForceUpdateRates));
bot.action('force_update_rates', safeHandler(handleForceUpdateRates));

// Payment Settings
bot.command('paymentsettings', safeHandler(handlePaymentSettings));
bot.command('setbank', safeHandler(handleSetBank));
bot.command('setqr', safeHandler(handleSetQR));

bot.command('skipfeedback', safeHandler(async (ctx) => {
  const userId = ctx.from.id;
  const { clearFeedbackState } = require('./handlers/feedback');

  clearFeedbackState(userId);

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const messages = {
    ms: '✅ Feedback dilangkau. Anda boleh teruskan menggunakan bot seperti biasa.',
    en: '✅ Feedback skipped. You can continue using the bot normally.',
    zh: '✅ 已跳过反馈。您可以正常继续使用机器人。',
    ta: '✅ கருத்து தவிர்க்கப்பட்டது. நீங்கள் இயல்பாக பாட் பயன்படுத்த தொடரலாம்.'
  };
  await ctx.reply(messages[lang] || messages.en);
}));

bot.command('feedbacks', safeHandler(handleViewFeedbacks));

bot.command('ping', safeHandler(handlePing));

// Owner Auto-Update from GitHub
bot.command('update', safeHandler(handleUpdate));
bot.action('update_restart', safeHandler(handleUpdateRestart));
bot.action('update_retry', safeHandler(async (ctx) => {
  await ctx.answerCbQuery();
  await handleUpdate(ctx);
}));
bot.action('update_now', safeHandler(async (ctx) => {
  await ctx.answerCbQuery();
  await handleUpdate(ctx);
}));
bot.action('check_update', safeHandler(handleCheckUpdate));

// Auto Promotion Commands
bot.command('schedulemsg', safeHandler(handleScheduleMsg));

bot.command('addpromotemplate', safeHandler(handleAddPromoTemplate));

bot.command('createabtest', safeHandler(handleCreateABTestCommand));

bot.command('creatediscount', safeHandler(handleCreateDiscount));

bot.command('createflash', safeHandler(handleCreateFlash));

bot.command('repeatcampaign', safeHandler(handleRepeatCampaign));

bot.command('createvoucher', safeHandler(handleCreateVoucher));

bot.command('redeem', safeHandler(handleRedeemVoucher));

bot.command('listvouchers', safeHandler(handleListVouchers));

bot.command('togglevoucher', safeHandler(handleToggleVoucher));

bot.command('checkvoucher', safeHandler(handleCheckVoucher));

bot.command('backupnow', safeHandler(async (ctx) => {
  const { isOwner } = require('./handlers/owner');
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';
    const message = lang === 'ms'
      ? '🚫 Arahan ini hanya untuk owner sahaja.'
      : '🚫 This command is only for owner.';
    await ctx.reply(message);
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const processingMsg = lang === 'ms'
    ? '📦 Membuat backup manual...'
    : '📦 Creating manual backup...';

  await ctx.reply(processingMsg);
  await runBackup();

  const successMsg = lang === 'ms'
    ? '✅ Backup dimuat naik ke cloud storage dengan jayanya!'
    : '✅ Backup uploaded to cloud storage successfully!';

  await ctx.reply(successMsg);
}));

bot.command('list', safeHandler(async (ctx) => {
  const { Markup } = require('telegraf');
  const { isAdmin } = require('./handlers/admin');
  const { isOwner } = require('./handlers/owner');

  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const isUserAdmin = await isAdmin(userId);
  const isUserOwner = await isOwner(userId);

  if (isUserAdmin || isUserOwner) {
    const commandsText = lang === 'ms'
      ? `📋 *SENARAI ARAHAN*

👤 *ARAHAN PENGGUNA:*
• \`/start\` - Menu utama
• \`/send [order_id]\` - Hantar bukti pembayaran
• \`/searchorder [order_id]\` - Cari pesanan
• \`/faq\` - Lihat soalan lazim
• \`/ping\` - Semak maklumat runtime sistem
• \`/list\` - Senarai arahan

⚙️ *ARAHAN ADMIN:*
• \`/verify [order_id]\` - Sahkan pesanan
• \`/reject [order_id]\` - Tolak pesanan
• \`/checkallorderid\` - Semua ID pesanan
• \`/searchorder [query]\` - Cari pesanan (ID/User/Status)
• \`/filterorders\` - Tapis pesanan mengikut status
• \`/ban [user_id] [reason]\` - Sekat pengguna
• \`/unban [user_id]\` - Nyahsekat pengguna
• \`/bannedlist\` - Senarai pengguna disekat
• \`/tag [user_id] [tag]\` - Tag pengguna
• \`/untag [user_id] [tag]\` - Buang tag pengguna
• \`/addtemplate [keyword] | [msg]\` - Tambah template
• \`/qt [keyword]\` - Guna template pantas
• \`/templates\` - Senarai template
• \`/deletetemplate [keyword]\` - Padam template
• \`/addfaq [soalan] | [jawapan]\` - Tambah FAQ
• \`/listfaqs\` - Senarai FAQ
• \`/deletefaq [faq_id]\` - Padam FAQ
• \`/duplicate [product_id]\` - Duplicate produk
• \`/inventory [product_id]\` - Sejarah inventori
• \`/adjuststock [id] [+/-num] [note]\` - Adjust stok
• \`/addcategory [name]\` - Tambah kategori
• \`/addproduct [...]\` - Tambah produk
• \`/additem [product_id] | [data]\` - Tambah item
• \`/listproducts\` - Senarai produk
• \`/currency\` - Tukar matawang
• \`/feedbacks\` - Lihat maklumbalas
• \`/createvoucher [kod] | [%] | [max]\` - Buat baucher
• \`/listvouchers\` - Senarai baucher
• \`/togglevoucher [kod]\` - Aktif/nyahaktif baucher
• \`/join [token]\` - Sertai sesi support
• \`/leave\` - Keluar dari sesi
• \`/close\` - Tutup sesi support${isUserOwner ? `

👑 *ARAHAN OWNER:*
• \`/setowner\` - Set owner baru
• \`/addadmin [user_id]\` - Tambah admin
• \`/removeadmin [user_id]\` - Buang admin` : ''}`
      : `📋 *COMMANDS LIST*

👤 *USER COMMANDS:*
• \`/start\` - Main menu
• \`/send [order_id]\` - Send payment proof
• \`/searchorder [order_id]\` - Search order
• \`/faq\` - View FAQ
• \`/ping\` - Check system runtime info
• \`/list\` - List commands

⚙️ *ADMIN COMMANDS:*
• \`/verify [order_id]\` - Verify order
• \`/reject [order_id]\` - Reject order
• \`/checkallorderid\` - All order IDs
• \`/searchorder [query]\` - Search orders (ID/User/Status)
• \`/filterorders\` - Filter orders by status
• \`/ban [user_id] [reason]\` - Ban user
• \`/unban [user_id]\` - Unban user
• \`/bannedlist\` - List banned users
• \`/tag [user_id] [tag]\` - Tag user
• \`/untag [user_id] [tag]\` - Remove tag
• \`/addtemplate [keyword] | [msg]\` - Add template
• \`/qt [keyword]\` - Quick template
• \`/templates\` - List templates
• \`/deletetemplate [keyword]\` - Delete template
• \`/addfaq [question] | [answer]\` - Add FAQ
• \`/listfaqs\` - List FAQs
• \`/deletefaq [faq_id]\` - Delete FAQ
• \`/duplicate [product_id]\` - Duplicate product
• \`/inventory [product_id]\` - Inventory history
• \`/adjuststock [id] [+/-num] [note]\` - Adjust stock
• \`/addcategory [name]\` - Add category
• \`/addproduct [...]\` - Add product
• \`/additem [product_id] | [data]\` - Add item
• \`/listproducts\` - List products
• \`/currency\` - Change currency
• \`/feedbacks\` - View feedbacks
• \`/createvoucher [code] | [%] | [max]\` - Create voucher
• \`/listvouchers\` - List vouchers
• \`/togglevoucher [code]\` - Toggle voucher
• \`/join [token]\` - Join support session
• \`/leave\` - Leave session
• \`/close\` - Close support session${isUserOwner ? `

👑 *OWNER COMMANDS:*
• \`/setowner\` - Set new owner
• \`/addadmin [user_id]\` - Add admin
• \`/removeadmin [user_id]\` - Remove admin
` : ''}`;

    await ctx.reply(commandsText, { parse_mode: 'Markdown' });
  } else {
    const buttonText = lang === 'ms'
      ? '📋 *ARAHAN YANG ADA*\n\nPilih arahan yang anda mahu gunakan:'
      : '📋 *AVAILABLE COMMANDS*\n\nSelect the command you want to use:';

    const buttons = [
      [Markup.button.callback(lang === 'ms' ? '🛍️ Beli Produk' : '🛍️ Buy Products', 'buy_products')],
      [Markup.button.callback(lang === 'ms' ? '📋 Pesanan Saya' : '📋 My Orders', 'my_orders')],
      [Markup.button.callback(lang === 'ms' ? '🎫 Guna Baucher' : '🎫 Use Voucher', 'use_voucher'), Markup.button.callback(lang === 'ms' ? '💬 Support' : '💬 Support', 'support')],
      [Markup.button.callback(lang === 'ms' ? '🔍 Cari Pesanan' : '🔍 Search Order', 'search_orders')],
      [Markup.button.callback('❓ FAQ', 'view_faq'), Markup.button.callback(lang === 'ms' ? '📖 Panduan' : '📖 Guide', 'user_guide')],
      [Markup.button.callback(lang === 'ms' ? '🔙 Kembali ke Menu Utama' : '🔙 Back to Main Menu', 'main_menu')]
    ];

    await ctx.reply(buttonText, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  }
}));

bot.command('addcategory', safeHandler(async (ctx) => {
  const { isAdmin } = require('./handlers/admin');
  if (!await isAdmin(ctx.from.id)) {
    await ctx.reply('Unauthorized');
    return;
  }

  const name = ctx.message.text.replace('/addcategory', '').trim();
  if (!name) {
    await ctx.reply('Usage: /addcategory [name]');
    return;
  }

  const categories = await db.getCategories();
  const newCategory = {
    id: generateId('CAT'),
    name: { ms: name, en: name },
    icon: '📦',
    createdAt: new Date().toISOString()
  };

  categories.push(newCategory);
  await db.saveCategories(categories);

  await ctx.reply(`✅ Category "${name}" added with ID: ${newCategory.id}`);
}));

bot.command('addproduct', safeHandler(async (ctx) => {
  const { isAdmin } = require('./handlers/admin');
  if (!await isAdmin(ctx.from.id)) {
    await ctx.reply('Unauthorized');
    return;
  }

  const input = ctx.message.text.replace('/addproduct', '').trim();

  if (!input) {
    await ctx.reply(
      '📦 *Add New Product*\n\n' +
      'Format:\n' +
      '/addproduct [category_id] | [name] | [price] | [stock] | [description]\n\n' +
      'Example:\n' +
      '/addproduct CAT-ABC123 | Netflix Premium | 15.00 | 10 | 1 month subscription\n\n' +
      '⚠️ All products are manual delivery. Admin will deliver items to customers.',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const parts = input.split('|').map(p => p.trim());

  if (parts.length < 5) {
    await ctx.reply('❌ Invalid format. Please provide all required fields.');
    return;
  }

  const [categoryId, name, priceStr, stockStr, description] = parts;
  const price = parseFloat(priceStr);
  const stock = parseInt(stockStr);

  if (isNaN(price) || isNaN(stock)) {
    await ctx.reply('❌ Invalid price or stock value.');
    return;
  }

  const categories = await db.getCategories();
  if (!categories.find(c => c.id === categoryId)) {
    await ctx.reply('❌ Category not found. Use /listcategories to see available categories.');
    return;
  }

  const products = await db.getProducts();
  const newProduct = {
    id: generateId('PROD'),
    categoryId,
    name: { ms: name, en: name },
    price,
    stock,
    description: { ms: description, en: description },
    deliveryType: 'manual',
    items: [],
    active: true,
    createdAt: new Date().toISOString()
  };

  products.push(newProduct);
  await db.saveProducts(products);

  await ctx.reply(
    `✅ Product created successfully!\n\n` +
    `🆔 ID: ${newProduct.id}\n` +
    `📦 Name: ${name}\n` +
    `💰 Price: RM${price}\n` +
    `📊 Stock: ${stock}\n` +
    `🔄 Type: Manual Delivery\n\n` +
    `Admin will manually deliver this product to customers.`
  );
}));

bot.command('listproducts', safeHandler(async (ctx) => {
  const { isAdmin } = require('./handlers/admin');
  if (!await isAdmin(ctx.from.id)) {
    await ctx.reply('Unauthorized');
    return;
  }

  const products = await db.getProducts();

  if (products.length === 0) {
    await ctx.reply('No products found');
    return;
  }

  let text = '📦 *All Products*\n\n';
  products.forEach(p => {
    text += `🆔 ${p.id}\n`;
    text += `📦 ${p.name.ms || p.name}\n`;
    text += `💰 RM${p.price}\n`;
    const itemsCount = p.items ? p.items.length : 0;
    if (p.deliveryType === 'auto') {
      text += `📊 Stock: ${p.stock} (${itemsCount} items available)\n`;
    } else {
      text += `📊 Stock: ${p.stock}\n`;
    }
    text += `🔄 Type: ${p.deliveryType}\n`;
    text += `✅ Active: ${p.active ? 'Yes' : 'No'}\n\n`;
  });

  await ctx.reply(text, { parse_mode: 'Markdown' });
}));

bot.command('deleteproduct', safeHandler(async (ctx) => {
  const { isAdmin } = require('./handlers/admin');
  if (!await isAdmin(ctx.from.id)) {
    await ctx.reply('❌ Unauthorized / Tidak dibenarkan');
    return;
  }

  const productId = ctx.message.text.split(' ')[1];

  if (!productId) {
    await ctx.reply('❌ Usage: /deleteproduct [product_id]\n\nExample: /deleteproduct prod_123');
    return;
  }

  const products = await db.getProducts();
  const productIndex = products.findIndex(p => p.id === productId);

  if (productIndex === -1) {
    await ctx.reply('❌ Product not found');
    return;
  }

  const product = products[productIndex];
  products.splice(productIndex, 1);
  await db.saveProducts(products);

  const user = await db.getUser(ctx.from.id);
  const lang = user?.language || 'ms';

  const message = lang === 'ms'
    ? `✅ *Produk berjaya dipadam!*\n\n` +
    `🆔 ID: ${product.id}\n` +
    `📦 Nama: ${product.name.ms || product.name}\n` +
    `💰 Harga: RM${product.price}`
    : `✅ *Product deleted successfully!*\n\n` +
    `🆔 ID: ${product.id}\n` +
    `📦 Name: ${product.name.en || product.name.ms || product.name}\n` +
    `💰 Price: RM${product.price}`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
}));

bot.action('main_menu', safeHandler(handleMainMenu));
bot.action('settings_menu', safeHandler(handleSettingsMenu));
bot.action('set_currency', safeHandler(handleSetCurrency));
bot.action(/^currency_(.+)$/, safeHandler((ctx) => handleCurrencySelect(ctx, ctx.match[1])));
bot.action('toggle_language', safeHandler(handleLanguageToggle));
bot.action('buy_products', safeHandler(handleBuyProducts));
bot.action('my_orders', safeHandler(async (ctx) => {
  await handleMyOrders(ctx, 0);
}));

bot.action(/^orderpage_(\d+)$/, safeHandler(async (ctx) => {
  const page = parseInt(ctx.match[1]);
  await handleMyOrders(ctx, page);
}));
bot.action('use_voucher', safeHandler(async (ctx) => {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'ms'
    ? `🎫 *Cara Guna Baucher*

📝 *Langkah 1:* Dapatkan kod baucher dari admin/promosi

📝 *Langkah 2:* Taip command untuk tebus baucher:
\`/redeem [KOD_BAUCHER]\`

*Contoh:*
\`/redeem JIMAT50\`

💡 *Tips:*
• Kod baucher tidak case-sensitive (huruf besar/kecil sama)
• Satu baucher hanya boleh digunakan sekali sahaja oleh setiap user
• Baucher akan digunakan automatik pada order seterusnya
• Diskaun akan ditolak semasa checkout

📊 *Semak Baucher Aktif:*
Gunakan \`/checkvoucher\` untuk lihat baucher yang sedang aktif

🛍️ Lepas tebus baucher, terus ke "Beli Produk" untuk shopping!`
    : `🎫 *How to Use Voucher*

📝 *Step 1:* Get voucher code from admin/promotion

📝 *Step 2:* Type command to redeem voucher:
\`/redeem [VOUCHER_CODE]\`

*Example:*
\`/redeem SAVE50\`

💡 *Tips:*
• Voucher codes are not case-sensitive
• Each voucher can only be used once per user
• Voucher will be applied automatically to your next order
• Discount will be deducted at checkout

📊 *Check Active Voucher:*
Use \`/checkvoucher\` to see your active voucher

🛍️ After redeeming voucher, go to "Buy Products" to shop!`;

  await ctx.answerCbQuery();
  await safeEditMessage(ctx, message, { parse_mode: 'Markdown' });
}));
bot.action('support', safeHandler(handleSupport));
bot.action('admin_panel', safeHandler(handleAdminPanel));
bot.action('admin_orders', safeHandler(handleAdminOrders));
bot.action('admin_products', safeHandler(handleAdminProducts));
bot.action('admin_products_menu', safeHandler(handleProductManagementMenu));
bot.action('admin_sessions', safeHandler(handleAdminSessions));
bot.action('admin_broadcast', safeHandler(handleAdminBroadcast));
bot.action('admin_statistics', safeHandler(handleAdminStatistics));
bot.action('all_orders', safeHandler(handleAllOrders));

bot.action('queue_panel', safeHandler(handleQueuePanel));
bot.action('queue_view_waiting', safeHandler(handleViewWaitingQueue));
bot.action('queue_view_processing', safeHandler(handleViewProcessingQueue));
bot.action('queue_settings', safeHandler(handleQueueSettings));

bot.action(/^queue_start_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handleStartProcessing(ctx, orderId);
}));

bot.action(/^queue_priority_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handleSetPriority(ctx, orderId);
}));

bot.action(/^view_order_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handleViewOrder(ctx, orderId);
}));

bot.action(/^delete_order_confirm_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handleDeleteOrderConfirm(ctx, orderId);
}));

bot.action(/^delete_order_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handleDeleteOrder(ctx, orderId);
}));

bot.action('cat_management', safeHandler(handleCategoryManagement));
bot.action('cat_add_new', safeHandler(handleAddCategoryStart));

// ─── Interactive Admin Flows (inline buttons) ───────────────────
bot.action('prod_add_new', safeHandler(handleAddProductStart));
bot.action('flow_add_category', safeHandler(handleAddCategoryStart));

// Add product: category selection
bot.action(/^flow_addprod_cat_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleAddProductCategory(ctx, categoryId);
}));

// Add product: delivery type selection
bot.action('flow_delivery_auto', safeHandler(async (ctx) => {
  await handleDeliveryTypeSelect(ctx, 'auto');
}));
bot.action('flow_delivery_manual', safeHandler(async (ctx) => {
  await handleDeliveryTypeSelect(ctx, 'manual');
}));

// Stock management
bot.action(/^flow_stock_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleAddStockStart(ctx, productId);
}));
bot.action(/^flow_additem_single_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleAddItemSingle(ctx, productId);
}));
bot.action(/^flow_additem_bulk_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleAddItemBulk(ctx, productId);
}));
bot.action(/^flow_adjuststock_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleAdjustStockStart(ctx, productId);
}));

bot.action('prod_low_stock', safeHandler(handleLowStockProducts));

// ─── Admin/Owner Management Flows (inline buttons) ──────────
bot.action('flow_add_admin', safeHandler(handleAddAdminStart));
bot.action('flow_remove_admin', safeHandler(handleRemoveAdminStart));
bot.action(/^flow_removeadmin_(.+)$/, safeHandler(async (ctx) => {
  const adminId = ctx.match[1];
  await handleRemoveAdminConfirm(ctx, adminId);
}));
bot.action('flow_ban_user', safeHandler(handleBanUserStart));
bot.action('flow_unban_user', safeHandler(handleUnbanUserStart));
bot.action(/^flow_unban_(.+)$/, safeHandler(async (ctx) => {
  const targetId = ctx.match[1];
  await handleUnbanConfirm(ctx, targetId);
}));
bot.action('flow_tag_user', safeHandler(handleTagUserStart));
bot.action('admin_banned_list', safeHandler(handleListBannedUsers));

bot.action(/^cat_manage_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleCategoryDetail(ctx, categoryId);
}));

bot.action(/^cat_delete_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleDeleteCategory(ctx, categoryId);
}));

bot.action(/^cat_edit_name_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleEditCategoryName(ctx, categoryId);
}));

bot.action(/^cat_edit_icon_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleEditCategoryIcon(ctx, categoryId);
}));

bot.action(/^prod_list_page_(\d+)$/, safeHandler(async (ctx) => {
  const page = parseInt(ctx.match[1]);
  await handleProductList(ctx, page);
}));

bot.action(/^prod_detail_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleProductDetail(ctx, productId);
}));

bot.action(/^prod_toggle_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleToggleProduct(ctx, productId);
}));

bot.action(/^prod_delete_confirm_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleDeleteProductConfirm(ctx, productId);
}));

bot.action(/^prod_delete_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleDeleteProduct(ctx, productId);
}));

bot.action(/^prod_edit_price_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleEditProductField(ctx, productId, 'price');
}));

bot.action(/^prod_edit_stock_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleEditProductField(ctx, productId, 'stock');
}));

bot.action(/^prod_edit_name_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleEditProductField(ctx, productId, 'name');
}));

bot.action(/^prod_edit_desc_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleEditProductField(ctx, productId, 'description');
}));

// Product Options Actions
bot.action(/^prod_options_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleProductOptions(ctx, productId);
}));

bot.action(/^opt_add_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleAddOption(ctx, productId);
}));

bot.action(/^opt_detail_(.+)_(\d+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  const optionIndex = parseInt(ctx.match[2]);
  await handleOptionDetail(ctx, productId, optionIndex);
}));

bot.action(/^opt_toggle_req_(.+)_(\d+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  const optionIndex = parseInt(ctx.match[2]);
  await handleToggleOptionRequired(ctx, productId, optionIndex);
}));

bot.action(/^opt_delete_(.+)_(\d+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  const optionIndex = parseInt(ctx.match[2]);
  await handleDeleteOption(ctx, productId, optionIndex);
}));

bot.action(/^opt_req_(yes|no)_(.+)$/, safeHandler(async (ctx) => {
  const required = ctx.match[1] === 'yes';
  const productId = ctx.match[2];
  await handleOptionRequired(ctx, productId, required);
}));

// Scheduled Publishing Actions
bot.action('scheduled_products', safeHandler(handleScheduledProducts));

bot.action(/^schedule_prod_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleScheduleProduct(ctx, productId);
}));

bot.action(/^sched_detail_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleScheduleProduct(ctx, productId);
}));

bot.action(/^cancel_schedule_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleCancelSchedule(ctx, productId);
}));

// Category Discounts Actions
bot.action('category_discounts', safeHandler(handleCategoryDiscounts));

// IMPORTANT: Specific patterns MUST come before the generic cat_disc_ catch-all
bot.action(/^cat_disc_add_pct_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleAddCategoryDiscount(ctx, categoryId, 'percentage');
}));

bot.action(/^cat_disc_add_fix_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleAddCategoryDiscount(ctx, categoryId, 'fixed');
}));

bot.action(/^cat_disc_remove_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleRemoveCategoryDiscount(ctx, categoryId);
}));

bot.action(/^cat_disc_edit_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  const user = await db.getUser(ctx.from.id);
  const lang = user?.language || 'ms';
  await ctx.answerCbQuery();
  await ctx.reply(
    lang === 'ms'
      ? 'Untuk edit diskaun, padam yang sedia ada dan tambah yang baru.'
      : 'To edit discount, remove the existing one and add a new one.'
  );
}));

// Generic catch-all for category detail view (MUST be last)
bot.action(/^cat_disc_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleCategoryDiscountDetail(ctx, categoryId);
}));

// Review & Rating Actions
bot.action(/^prod_reviews_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleProductReviews(ctx, productId);
}));

bot.action(/^review_rate_(.+)_(\d+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  const rating = parseInt(ctx.match[2]);
  await handleRatingSelect(ctx, orderId, rating);
}));

bot.action('view_all_reviews', safeHandler(handleViewAllReviews));

// Advanced Order Filter Actions
bot.action('adv_order_filters', safeHandler(handleAdvancedOrderFilters));

bot.action(/^filter_date_(.+)$/, safeHandler(async (ctx) => {
  const filterType = ctx.match[1];
  await handleDateFilter(ctx, filterType);
}));

// Quick Edit Actions
bot.action('quick_edit_menu', safeHandler(handleQuickEditMenu));

bot.action(/^qedit_(.+)$/, safeHandler(async (ctx) => {
  const action = ctx.match[1];
  await handleQuickEditAction(ctx, action);
}));

// Product Image Management Actions
bot.action(/^prod_images_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleProductImages(ctx, productId);
}));

bot.action(/^img_add_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleAddProductImage(ctx, productId);
}));

bot.action(/^img_view_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleViewProductImages(ctx, productId);
}));

bot.action(/^img_delete_(.+)_(\d+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  const imageIndex = parseInt(ctx.match[2]);
  await handleDeleteProductImage(ctx, productId, imageIndex);
}));

bot.action(/^send_payment_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handlePaymentSelection(ctx, orderId);
}));
bot.action('owner_panel', safeHandler(handleOwnerPanel));
bot.action('owner_admins', safeHandler(handleOwnerAdmins));
bot.action('owner_settings', safeHandler(handleOwnerSettings));
bot.action('owner_backup', safeHandler(handleOwnerBackup));
bot.action('owner_analytics', safeHandler(handleAnalytics));
bot.action('owner_advanced', safeHandler(handleOwnerAdvanced));

// Pterodactyl Server Panel
bot.action('server_panel', safeHandler(handleServerPanel));
bot.action('ptero_add', safeHandler(handleAddPanelStart));
bot.action(/^ptero_view_(\d+)$/, safeHandler(async (ctx) => {
  await handleViewPanel(ctx, ctx.match[1]);
}));
bot.action(/^ptero_power_(\d+)_(start|stop|restart)$/, safeHandler(async (ctx) => {
  await handleServerPower(ctx, ctx.match[1], ctx.match[2]);
}));
bot.action(/^ptero_create_(\d+)$/, safeHandler(async (ctx) => {
  await handleCreateServer(ctx, ctx.match[1]);
}));
bot.action(/^ptero_createuser_(\d+)_(\d+)$/, safeHandler(async (ctx) => {
  await handleCreateServerWithUser(ctx, ctx.match[1], ctx.match[2]);
}));
bot.action(/^ptero_primary_(\d+)$/, safeHandler(async (ctx) => {
  await handleSetPrimary(ctx, ctx.match[1]);
}));
bot.action(/^ptero_delete_(\d+)$/, safeHandler(async (ctx) => {
  await handleDeletePanel(ctx, ctx.match[1]);
}));
bot.action(/^ptero_confirmdelete_(\d+)$/, safeHandler(async (ctx) => {
  await handleConfirmDeletePanel(ctx, ctx.match[1]);
}));
bot.action('ptero_healthcheck', safeHandler(handlePteroHealthCheck));

bot.action('auto_promote_panel', safeHandler(handleAutoPromotePanel));
bot.action('promo_create_broadcast', safeHandler(handleCreateBroadcast));
bot.action('promo_schedule', safeHandler(handleScheduleMessage));
bot.action('promo_templates', safeHandler(handlePromoTemplates));
bot.action('promo_targeting', safeHandler(handleUserTargeting));
bot.action('promo_analytics', safeHandler(handlePromoAnalytics));
bot.action('promo_ab_test', safeHandler(handleABTesting));
bot.action('promo_discounts', safeHandler(handleDiscountCodes));
bot.action('promo_flash_sales', safeHandler(handleFlashSales));
bot.action('promo_repeat', safeHandler(handleRepeatCampaigns));
bot.action('promo_active', safeHandler(handleActiveCampaigns));
bot.action('promo_panel', safeHandler(handleAutoPromotePanel));

bot.action('broadcast_all', safeHandler(handleBroadcastAll));
bot.action('broadcast_active', safeHandler(handleBroadcastActive));
bot.action('broadcast_tagged', safeHandler(handleBroadcastTagged));
bot.action('target_all', safeHandler(handleTargetAll));
bot.action('target_active', safeHandler(handleTargetActive));
bot.action('target_tagged', safeHandler(handleTargetTagged));
bot.action('target_buyers', safeHandler(handleTargetBuyers));
bot.action('promo_detailed_report', safeHandler(handlePromoDetailedReport));
bot.action('create_ab_test', safeHandler(handleCreateABTest));
bot.action('ab_test_results', safeHandler(handleABTestResults));
bot.action('pause_all_campaigns', safeHandler(handlePauseAllCampaigns));

bot.action('system_panel', safeHandler(handleSystemPanel));
bot.action('sys_user_stats', safeHandler(handleUserStats));
bot.action('sys_sales_analytics', safeHandler(handleSalesAnalytics));
bot.action('sys_admin_logs', safeHandler(handleAdminLogs));
bot.action('sys_health_check', safeHandler(handleHealthCheck));
bot.action('sys_storage', safeHandler(handleStorageUsage));
bot.action('sys_export', safeHandler(handleExportData));
bot.action('sys_maintenance', safeHandler(handleMaintenanceMode));
bot.action('sys_backup_ui', safeHandler(handleBackupUI));
bot.action('sys_error_monitor', safeHandler(handleErrorMonitor));
bot.action('sys_performance', safeHandler(handlePerformance));
bot.action('sys_api_limits', safeHandler(handleAPILimits));
bot.action('sys_webhook_logs', safeHandler(handleWebhookLogs));
bot.action('sys_transaction_reports', safeHandler(handleTransactionReports));
bot.action('sys_inventory_alerts', safeHandler(handleInventoryAlerts));
bot.action('sys_session_analytics', safeHandler(handleSessionAnalytics));
bot.action('sys_engagement', safeHandler(handleEngagement));
bot.action('sys_revenue', safeHandler(handleRevenue));
bot.action('sys_import', safeHandler(handleImportData));
bot.action('sys_settings', safeHandler(handleSystemSettings));
bot.action('sys_cache', safeHandler(handleCacheManagement));

bot.action('export_users', safeHandler(handleExportUsers));
bot.action('export_products', safeHandler(handleExportProducts));
bot.action('export_transactions', safeHandler(handleExportTransactions));
bot.action('export_all', safeHandler(handleExportAll));
bot.action('store_status', safeHandler(handleStoreStatus));
bot.action('toggle_store_status', safeHandler(handleToggleStoreStatus));
bot.action('toggle_maintenance', safeHandler(handleToggleMaintenance));

bot.action('clear_admin_logs', safeHandler(async (ctx) => {
  const { clearAdminLogs, logAdminAction } = require('./utils/adminLogger');
  const { isOwner } = require('./handlers/owner');
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  await clearAdminLogs();
  await logAdminAction(userId, 'Cleared Admin Logs', 'All admin activity logs were cleared');
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const msg = lang === 'ms' ? '✅ Log admin telah dipadam!' : '✅ Admin logs cleared!';
  await ctx.answerCbQuery(msg);
  await handleAdminLogs(ctx);
}));

bot.action('edit_system_settings', safeHandler(async (ctx) => {
  const { isOwner } = require('./handlers/owner');
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const msg = lang === 'ms'
    ? 'ℹ️ Gunakan panel Owner Settings untuk edit tetapan'
    : 'ℹ️ Use Owner Settings panel to edit settings';
  await ctx.answerCbQuery(msg);
  await ctx.reply(msg);
}));

bot.action('broadcast_buyers', safeHandler(async (ctx) => {
  const { isAdmin } = require('./handlers/admin');
  const userId = ctx.from.id;

  if (!await isAdmin(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const buyerIds = [...new Set(transactions.filter(t => t.status === 'completed' || t.status === 'verified').map(t => t.userId))];

  const message = lang === 'en'
    ? `🛍️ *Broadcast to Buyers*\n\nTotal Buyers: ${buyerIds.length}\n\nPlease send your broadcast message now:`
    : `🛍️ *Siaran ke Pembeli*\n\nJumlah Pembeli: ${buyerIds.length}\n\nSila hantar mesej siaran anda sekarang:`;

  ctx.session = ctx.session || {};
  ctx.session.awaitingBroadcastBuyers = true;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Cancel' : '🔙 Batal', callback_data: 'promo_create_broadcast' }]
      ]
    }
  });
}));

bot.action('detailed_revenue_report', safeHandler(async (ctx) => {
  const { isOwner } = require('./handlers/owner');
  const userId = ctx.from.id;

  if (!await isOwner(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const completed = transactions.filter(t => t.status === 'completed');
  const totalRevenue = completed.reduce((sum, t) => sum + (t.price || 0), 0);

  const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const revenue7Days = completed.filter(t => t.createdAt >= last7Days).reduce((sum, t) => sum + (t.price || 0), 0);
  const revenue30Days = completed.filter(t => t.createdAt >= last30Days).reduce((sum, t) => sum + (t.price || 0), 0);

  const message = lang === 'en'
    ? `📈 *Detailed Revenue Report*\n\n💰 Total Revenue: ${config.store.currency} ${totalRevenue.toFixed(2)}\n\n📊 Last 7 Days: ${config.store.currency} ${revenue7Days.toFixed(2)}\n📊 Last 30 Days: ${config.store.currency} ${revenue30Days.toFixed(2)}\n\n📦 Total Orders: ${completed.length}\n📈 Avg Order Value: ${config.store.currency} ${(completed.length > 0 ? totalRevenue / completed.length : 0).toFixed(2)}`
    : `📈 *Laporan Hasil Terperinci*\n\n💰 Jumlah Hasil: ${config.store.currency} ${totalRevenue.toFixed(2)}\n\n📊 7 Hari Lepas: ${config.store.currency} ${revenue7Days.toFixed(2)}\n📊 30 Hari Lepas: ${config.store.currency} ${revenue30Days.toFixed(2)}\n\n📦 Jumlah Pesanan: ${completed.length}\n📈 Nilai Purata Pesanan: ${config.store.currency} ${(completed.length > 0 ? totalRevenue / completed.length : 0).toFixed(2)}`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'sys_revenue' }]
      ]
    }
  });
}));

bot.action('search_orders', safeHandler(async (ctx) => {
  const user = await db.getUser(ctx.from.id);
  const lang = user?.language || 'ms';
  const text = lang === 'ms'
    ? '🔍 *Cari Pesanan*\n\nGunakan arahan berikut untuk mencari pesanan anda:\n\n`/searchorder [order_id]` - Cari pesanan mengikut ID\n\nContoh:\n`/searchorder ORD-ABC123`'
    : '🔍 *Search Order*\n\nUse the following command to search for your orders:\n\n`/searchorder [order_id]` - Search order by ID\n\nExample:\n`/searchorder ORD-ABC123`';
  await ctx.answerCbQuery();
  await ctx.reply(text, { parse_mode: 'Markdown' });
}));

bot.action('view_faq', safeHandler(handleFAQList));

bot.action('user_guide', safeHandler(handleGuideMenu));
bot.action('guide_user', safeHandler(handleUserGuide));
bot.action('guide_admin', safeHandler(handleAdminGuide));
bot.action('guide_owner', safeHandler(handleOwnerGuide));

bot.action('all_orders', safeHandler(handleCheckAllOrderId));

bot.action('admin_search_orders', safeHandler(async (ctx) => {
  const user = await db.getUser(ctx.from.id);
  const lang = user?.language || 'ms';
  const text = lang === 'ms'
    ? '🔍 *Cari Pesanan Admin*\n\nGunakan arahan berikut:\n\n`/searchorder [query]` - Cari pesanan (ID/User ID/Status)\n`/filterorders` - Tapis pesanan mengikut status'
    : '🔍 *Admin Order Search*\n\nUse the following commands:\n\n`/searchorder [query]` - Search orders (ID/User ID/Status)\n`/filterorders` - Filter orders by status';
  await ctx.answerCbQuery();
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback(t('btnBack', lang), 'admin_panel')]])
  });
}));

// NEW IMPROVEMENTS - Bulk Operations
bot.action('bulk_operations', safeHandler(handleBulkOperations));
bot.action('bulk_activate_all', safeHandler(handleBulkActivateAll));
bot.action('bulk_deactivate_all', safeHandler(handleBulkDeactivateAll));
bot.action('bulk_price_category', safeHandler(handleBulkPriceByCategory));
bot.action('bulk_stock_category', safeHandler(handleBulkStockByCategory));
bot.action('bulk_delete_inactive', safeHandler(handleBulkDeleteInactive));
bot.action('bulk_delete_confirm', safeHandler(handleBulkDeleteConfirm));

bot.action(/^bulk_price_cat_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleBulkPriceCategorySelect(ctx, categoryId);
}));

bot.action(/^bulk_stock_cat_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleBulkStockCategorySelect(ctx, categoryId);
}));

// Product Search & Filter
bot.action('product_search', safeHandler(handleProductSearch));
bot.action('product_filter', safeHandler(handleProductFilter));
bot.action(/^filter_(.+)$/, safeHandler(async (ctx) => {
  const filterType = ctx.match[1];
  await handleProductFilterCallback(ctx, filterType);
}));

// Category Advanced
bot.action('category_sort', safeHandler(handleCategorySort));
bot.action(/^sort_cat_(.+)$/, safeHandler(async (ctx) => {
  const sortType = ctx.match[1];
  await handleCategorySortCallback(ctx, sortType);
}));
bot.action(/^cat_analytics_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleCategoryAnalytics(ctx, categoryId);
}));
bot.action(/^cat_icon_select_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleCategoryIconSelector(ctx, categoryId);
}));
bot.action(/^set_cat_icon_(.+)_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  const icon = ctx.match[2];
  await handleSetCategoryIcon(ctx, categoryId, icon);
}));

// Owner Dashboard
bot.action('owner_dashboard', safeHandler(handleOwnerDashboard));
bot.action('owner_detailed_report', safeHandler(handleDetailedReport));
bot.action('owner_trend_analysis', safeHandler(handleTrendAnalysis));
bot.action('owner_analytics', safeHandler(handleAnalytics));

// Quick Actions
bot.action('quick_actions', safeHandler(handleQuickActionsMenu));
bot.action('qa_quick_verify', safeHandler(handleQuickVerify));
bot.action('qa_quick_stock', safeHandler(handleQuickStock));
bot.action('qa_quick_price', safeHandler(handleQuickPrice));
bot.action('qa_verify_all', safeHandler(handleQuickVerifyAll));
bot.action(/^qa_verify_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handleQuickVerifyOrder(ctx, orderId);
}));
bot.action(/^qa_reject_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handleQuickRejectOrder(ctx, orderId);
}));

// Product Stats
bot.action(/^prod_stats_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleProductStats(ctx, productId);
}));
bot.action('all_products_stats', safeHandler(handleAllProductsStats));

// Export Reports
bot.action('export_menu', safeHandler(handleExportMenu));
bot.action('export_products', safeHandler(async (ctx) => {
  await ctx.answerCbQuery();
  await exportProductsCSV(ctx);
}));
bot.action('export_transactions', safeHandler(async (ctx) => {
  await ctx.answerCbQuery();
  await exportTransactionsCSV(ctx);
}));
bot.action('export_users', safeHandler(async (ctx) => {
  await ctx.answerCbQuery();
  await exportUsersCSV(ctx);
}));
bot.action('export_sales', safeHandler(async (ctx) => {
  await ctx.answerCbQuery();
  await exportSalesReport(ctx);
}));

// Admin Permissions (using short callbacks to avoid 64-byte limit)
bot.action('perm_mgmt', safeHandler(handlePermissionsManagement));
bot.action('perm_management', safeHandler(handlePermissionsManagement));
bot.action(/^pm_(.+)$/, safeHandler(async (ctx) => {
  const adminId = ctx.match[1];
  await handleAdminPermissionsEdit(ctx, adminId);
}));
bot.action(/^pt_(.+)_(.+)$/, safeHandler(async (ctx) => {
  const adminId = ctx.match[1];
  const permission = ctx.match[2];
  await handleTogglePermission(ctx, adminId, permission);
}));
bot.action(/^admin_activity_(.+)$/, safeHandler(async (ctx) => {
  const adminId = ctx.match[1];
  await handleAdminActivityLog(ctx, adminId);
}));

bot.action('admin_ban_user', safeHandler(async (ctx) => {
  const user = await db.getUser(ctx.from.id);
  const lang = user?.language || 'ms';
  const text = lang === 'ms'
    ? '🚫 *Sekat Pengguna*\n\nGunakan arahan berikut:\n\n`/ban [user_id] [reason]` - Sekat pengguna\n`/unban [user_id]` - Nyahsekat pengguna\n`/bannedlist` - Senarai pengguna yang disekat\n\nContoh:\n`/ban 123456789 Spam`'
    : '🚫 *Ban User*\n\nUse the following commands:\n\n`/ban [user_id] [reason]` - Ban a user\n`/unban [user_id]` - Unban a user\n`/bannedlist` - List banned users\n\nExample:\n`/ban 123456789 Spam`';
  await ctx.answerCbQuery();
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback(t('btnBack', lang), 'admin_panel')]])
  });
}));

bot.action('admin_user_mgmt', safeHandler(async (ctx) => {
  const user = await db.getUser(ctx.from.id);
  const lang = user?.language || 'ms';

  const users = await db.getUsers();
  const totalUsers = users.length;
  const bannedUsers = users.filter(u => u.banned).length;
  const taggedUsers = users.filter(u => u.tags && u.tags.length > 0).length;

  const text = lang === 'ms'
    ? `👥 *Pengurusan Pengguna*\n\n👤 Jumlah: ${totalUsers}\n🚫 Diban: ${bannedUsers}\n🏷️ Ditag: ${taggedUsers}\n\nPilih tindakan:`
    : `👥 *User Management*\n\n👤 Total: ${totalUsers}\n🚫 Banned: ${bannedUsers}\n🏷️ Tagged: ${taggedUsers}\n\nChoose action:`;

  await ctx.answerCbQuery();
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'ms' ? '🚫 Ban Pengguna' : '🚫 Ban User', 'flow_ban_user')],
      [Markup.button.callback(lang === 'ms' ? '✅ Nyahban Pengguna' : '✅ Unban User', 'flow_unban_user')],
      [Markup.button.callback(lang === 'ms' ? '🏷️ Tag Pengguna' : '🏷️ Tag User', 'flow_tag_user')],
      [Markup.button.callback(lang === 'ms' ? '📋 Senarai Diban' : '📋 Banned List', 'admin_banned_list')],
      [Markup.button.callback(t('btnBack', lang), 'admin_panel')]
    ])
  });
}));

bot.action('admin_quick_reply', safeHandler(async (ctx) => {
  const { Markup } = require('telegraf');
  const user = await db.getUser(ctx.from.id);
  const lang = user?.language || 'ms';
  const text = lang === 'ms'
    ? '💬 *Balas Pantas*\n\nGunakan arahan berikut:\n\n`/addtemplate [keyword] | [message]` - Tambah template\n`/qt [keyword]` - Guna template pantas\n`/templates` - Senarai semua template\n`/deletetemplate [keyword]` - Padam template\n\nContoh:\n`/addtemplate terima_kasih | Terima kasih kerana membeli!`\n`/qt terima_kasih`'
    : '💬 *Quick Reply*\n\nUse the following commands:\n\n`/addtemplate [keyword] | [message]` - Add template\n`/qt [keyword]` - Use quick template\n`/templates` - List all templates\n`/deletetemplate [keyword]` - Delete template\n\nExample:\n`/addtemplate thank_you | Thank you for your purchase!`\n`/qt thank_you`';
  await ctx.answerCbQuery();
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback(t('btnBack', lang), 'admin_panel')]])
  });
}));

bot.action('admin_manage_faq', safeHandler(async (ctx) => {
  const { Markup } = require('telegraf');
  const user = await db.getUser(ctx.from.id);
  const lang = user?.language || 'ms';
  const text = lang === 'ms'
    ? '❓ *Pengurusan FAQ*\n\nGunakan arahan berikut:\n\n`/addfaq [soalan] | [jawapan]` - Tambah FAQ\n`/listfaqs` - Senarai semua FAQ\n`/deletefaq [faq_id]` - Padam FAQ\n\nContoh:\n`/addfaq Berapa lama penghantaran? | Penghantaran mengambil masa 1-24 jam`'
    : '❓ *Manage FAQ*\n\nUse the following commands:\n\n`/addfaq [question] | [answer]` - Add FAQ\n`/listfaqs` - List all FAQs\n`/deletefaq [faq_id]` - Delete FAQ\n\nExample:\n`/addfaq How long is delivery? | Delivery takes 1-24 hours`';
  await ctx.answerCbQuery();
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([[Markup.button.callback(t('btnBack', lang), 'admin_panel')]])
  });
}));

bot.action('owner_analytics', safeHandler(handleAnalytics));

bot.action('owner_advanced', safeHandler(handleOwnerAdvanced));

bot.action(/^catpage_(.+)_(\d+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  const page = parseInt(ctx.match[2]);
  await handleCategory(ctx, categoryId, page);
}));

bot.action(/^cat_(.+)$/, safeHandler(async (ctx) => {
  const categoryId = ctx.match[1];
  await handleCategory(ctx, categoryId);
}));

bot.action(/^prod_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleProductView(ctx, productId);
}));

bot.action(/^buy_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleBuyProduct(ctx, productId);
}));

bot.action(/^confirmbuy_(.+)$/, safeHandler(async (ctx) => {
  const productId = ctx.match[1];
  await handleConfirmBuy(ctx, productId);
}));

bot.action(/^paymethod_(tng|qris)_(.+)$/, safeHandler(async (ctx) => {
  const method = ctx.match[1];
  const orderId = ctx.match[2];
  await handlePaymentMethodSelect(ctx, method, orderId);
}));

bot.action(/^uploadproof_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handleUploadProofPrompt(ctx, orderId);
}));

bot.action(/^skipproof_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handleSkipProof(ctx, orderId);
}));

bot.action(/^end_session_(.+)$/, safeHandler(async (ctx) => {
  const token = ctx.match[1];
  await handleEndSession(ctx, token);
}));

bot.action(/^join_session_(.+)$/, safeHandler(async (ctx) => {
  const token = ctx.match[1];
  await handleJoinSession(ctx, token);
}));

bot.action(/^filter_(.+)$/, safeHandler(async (ctx) => {
  const filter = ctx.match[1];
  await handleFilterCallback(ctx, filter);
}));

bot.action(/^lang_(.+)$/, safeHandler(async (ctx) => {
  const lang = ctx.match[1];
  await handleLanguageSelect(ctx, lang);
}));

bot.action(/^currency_(.+)$/, safeHandler(async (ctx) => {
  const currency = ctx.match[1];
  await handleCurrencySelect(ctx, currency);
}));

bot.action(/^rating_(.+)_(\d+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  const rating = parseInt(ctx.match[2]);
  await handleRating(ctx, orderId, rating);
}));

bot.action(/^feedback_skip_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handleSkipFeedback(ctx, orderId);
}));

bot.action(/^verify_order_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handleVerifyOrder(ctx, orderId);
  await ctx.answerCbQuery();
}));

bot.action(/^reject_order_(.+)$/, safeHandler(async (ctx) => {
  const orderId = ctx.match[1];
  await handleRejectOrder(ctx, orderId);
  await ctx.answerCbQuery();
}));

// --- New System Functions ---
bot.action('edit_system_settings', safeHandler(async (ctx) => {
  await handleEditSystemSettings(ctx);
}));

bot.action('clear_admin_logs', safeHandler(async (ctx) => {
  await handleClearAdminLogs(ctx);
}));

bot.action('clean_old_backups', safeHandler(async (ctx) => {
  await handleCleanBackups(ctx);
}));

bot.action('sys_cache', safeHandler(async (ctx) => {
  await handleCacheManagement(ctx);
}));

bot.action('detailed_sales_report', safeHandler(async (ctx) => {
  await handleDetailedSalesReport(ctx);
}));

bot.on('document', safeHandler(async (ctx) => {
  await handleProcessImport(ctx);
}));

bot.action(/^view_schedule_(.+)$/, safeHandler(async (ctx) => {
  const scheduleId = ctx.match[1];
  await handleViewSchedule(ctx, scheduleId);
}));

bot.action(/^use_promo_template_(.+)$/, safeHandler(async (ctx) => {
  const templateId = ctx.match[1];
  await handleUsePromoTemplate(ctx, templateId);
}));

bot.action(/^view_discount_(.+)$/, safeHandler(async (ctx) => {
  const discountCode = ctx.match[1];
  await handleViewDiscount(ctx, discountCode);
}));

bot.action(/^delete_discount_(.+)$/, safeHandler(async (ctx) => {
  await handleDeleteDiscount(ctx);
}));

bot.action(/^view_flash_(.+)$/, safeHandler(async (ctx) => {
  const flashId = ctx.match[1];
  await handleViewFlash(ctx, flashId);
}));

bot.action(/^view_repeat_(.+)$/, safeHandler(async (ctx) => {
  const repeatId = ctx.match[1];
  await handleViewRepeat(ctx, repeatId);
}));

bot.command('note', safeHandler(async (ctx) => {
  const { handleNoteCommand } = require('./handlers/admin');
  await handleNoteCommand(ctx);
}));

bot.action('admin_broadcast', safeHandler(async (ctx) => {
  const { handleAdminBroadcast } = require('./handlers/admin');
  await handleAdminBroadcast(ctx);
}));

bot.action('confirm_broadcast', safeHandler(async (ctx) => {
  const { handleConfirmBroadcast } = require('./handlers/admin');
  await handleConfirmBroadcast(ctx);
}));

bot.action('cancel_broadcast', safeHandler(async (ctx) => {
  const { handleCancelBroadcast } = require('./handlers/admin');
  await handleCancelBroadcast(ctx);
}));

bot.command('addsnippet', safeHandler(async (ctx) => {
  const { handleAddSnippet } = require('./handlers/snippets');
  await handleAddSnippet(ctx);
}));

bot.command('delsnippet', safeHandler(async (ctx) => {
  const { handleDelSnippet } = require('./handlers/snippets');
  await handleDelSnippet(ctx);
}));

bot.command('s', safeHandler(async (ctx) => {
  const { handleSnippet } = require('./handlers/snippets');
  await handleSnippet(ctx);
}));

bot.on('text', async (ctx) => {
  // Check for admin interactive flows (add product, add category, add stock, etc.)
  const adminFlowHandled = await processAdminFlowInput(ctx);
  if (adminFlowHandled) {
    return;
  }

  // Check for category edit processing
  const categoryEdited = await processCategoryEdit(ctx);
  if (categoryEdited) {
    return;
  }

  // Check for product edit processing
  const productEdited = await processProductEdit(ctx);
  if (productEdited) {
    return;
  }

  // NEW IMPROVEMENTS - Check for bulk edit processing
  const bulkEdited = await processBulkEdit(ctx);
  if (bulkEdited) {
    return;
  }

  // NEW IMPROVEMENTS - Check for product search
  const productSearched = await processProductSearch(ctx);
  if (productSearched) {
    return;
  }

  // NEW IMPROVEMENTS - Check for quick stock update
  const quickStockUpdated = await processQuickStock(ctx);
  if (quickStockUpdated) {
    return;
  }

  // NEW IMPROVEMENTS - Check for quick price update
  const quickPriceUpdated = await processQuickPrice(ctx);
  if (quickPriceUpdated) {
    return;
  }

  // NEW FEATURES - Process inputs (check each for handled status)
  if (await processOptionInput(ctx)) return;
  if (await processScheduleInput(ctx)) return;
  if (await processDiscountInput(ctx)) return;
  if (await processReviewComment(ctx)) return;
  if (await processCustomDateInput(ctx)) return;
  if (await processQuickEditInput(ctx)) return;
  await processProductImage(ctx);

  // Check for feedback comment first
  const feedbackHandled = await handleFeedbackComment(ctx);
  if (feedbackHandled) {
    return;
  }

  // Check for FAQ auto-response
  if (ctx.message.text && !ctx.message.text.startsWith('/')) {
    const faqResponse = await checkFAQResponse(ctx.message.text, ctx.from.id);
    if (faqResponse) {
      await ctx.reply(`💡 *Auto FAQ Response:*\n\n${faqResponse}\n\n_Still need help? Use /support to chat with admin._`, { parse_mode: 'Markdown' });
      return;
    }
  }

  const broadcasted = await handleBroadcastMessage(ctx);
  if (!broadcasted) {
    await handleSessionMessage(ctx);
  }
});

bot.on('photo', async (ctx) => {
  if (ctx.message.caption && ctx.message.caption.startsWith('/')) {
    return;
  }

  // Check if photo is a payment proof upload
  if (isAwaitingProof(ctx.from.id)) {
    const handled = await handlePaymentProof(ctx);
    if (handled) return;
  }

  // Check if photo is for product image upload
  await processProductImage(ctx);

  await handleSessionMessage(ctx);
});

bot.on('document', async (ctx) => {
  // Check if document is for admin flow bulk import
  const flow = getAdminFlow(ctx.from?.id);
  if (flow && flow.flow === 'additem_bulk' && ctx.message?.document?.file_name?.endsWith('.txt')) {
    // Set the addItemsState so handleAddItemsFile can pick it up
    const { handleAddItems } = require('./handlers/productManagement');
    // Trigger addItems state for this product, then let handleAddItemsFile process it
    const fakeCtx = {
      ...ctx,
      message: { ...ctx.message, text: `/additems ${flow.data.productId}` }
    };
    // Set the state and process
    const prodMgmt = require('./handlers/productManagement');
    // Directly set the state Map
    prodMgmt.addItemsState.set(ctx.from.id, String(flow.data.productId));
    clearAdminFlow(ctx.from.id);
    const itemsHandled = await handleAddItemsFile(ctx);
    if (itemsHandled) return;
  }

  // Check if document is for bulk item import
  const itemsHandled = await handleAddItemsFile(ctx);
  if (itemsHandled) return;

  await handleSessionMessage(ctx);
});

// Session Callbacks (Ticket System)
bot.action(/^active_session_(.+)$/, safeHandler(async (ctx) => {
  await handleSetActiveSession(ctx, ctx.match[1]);
}));

bot.action(/^join_session_(.+)$/, safeHandler(async (ctx) => {
  await handleJoinSession(ctx, ctx.match[1]);
}));

bot.action('refresh_sessions', safeHandler(handleListSessions));

bot.action(/^end_session_(.+)$/, safeHandler(async (ctx) => {
  await handleEndSession(ctx, ctx.match[1]);
}));

bot.action(/^quick_reply_(.+)$/, safeHandler(async (ctx) => {
  const { handleQuickReplyList } = require('./handlers/snippets');
  await handleQuickReplyList(ctx, ctx.match[1]);
}));

bot.action(/^use_snippet_(.+)_(.+)$/, safeHandler(async (ctx) => {
  const token = ctx.match[1];
  const snippetName = ctx.match[2];
  const { handleUseSnippet } = require('./handlers/snippets');
  await handleUseSnippet(ctx, token, snippetName);
}));

bot.action(/^rate_(.+)_(\d+)$/, safeHandler(async (ctx) => {
  const token = ctx.match[1];
  const rating = parseInt(ctx.match[2]);
  const { handleRating } = require('./handlers/session');
  await handleRating(ctx, token, rating);
}));

bot.on('audio', async (ctx) => {
  await handleSessionMessage(ctx);
});

bot.on('voice', async (ctx) => {
  await handleSessionMessage(ctx);
});

bot.on('video', async (ctx) => {
  await handleSessionMessage(ctx);
});

bot.on('location', async (ctx) => {
  await handleSessionMessage(ctx);
});

bot.catch(async (err, ctx) => {
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error('🔴 BOT ERROR OCCURRED:');
  console.error('Error:', err.message || err);
  console.error('Stack:', err.stack);
  console.error('User ID:', ctx?.from?.id);
  console.error('Username:', ctx?.from?.username);
  console.error('Update type:', ctx?.updateType);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  try {
    const user = await db.getUser(ctx?.from?.id);
    const lang = user?.language || 'ms';

    const errorMsg = lang === 'ms'
      ? '❌ *Ralat berlaku!*\n\nSila cuba lagi atau hubungi admin jika masalah berterusan.\n\n_Kod ralat telah dilog untuk pembaikan._'
      : '❌ *An error occurred!*\n\nPlease try again or contact admin if the problem persists.\n\n_Error has been logged for fixing._';

    if (ctx?.reply) {
      await ctx.reply(errorMsg, { parse_mode: 'Markdown' });
    }
  } catch (replyErr) {
    console.error('Failed to send error message to user:', replyErr);
  }
});

// Optimized Pterodactyl Polling Configuration
bot.launch({
  polling: {
    timeout: 50, // Increase timeout to reduce connection churn
    limit: 100,  // Batch size
    allowedUpdates: ['message', 'edited_message', 'channel_post', 'edited_channel_post', 'callback_query', 'my_chat_member', 'chat_member']
  }
})
  .then(async () => {
    // Check for pending restart
    try {
      const fs = require('fs');
      const path = require('path');
      const restartFile = path.join(__dirname, '.restart_pending');

      if (fs.existsSync(restartFile)) {
        const state = JSON.parse(fs.readFileSync(restartFile, 'utf8'));
        // Ignore if older than 5 minutes
        if (Date.now() - state.timestamp < 300000) {
          try {
            // Try to delete previous "Restarting..." message if possible, or just send a new one
            // Here we edit the "Restarting..." message if we have the ID, otherwise send new
            if (state.messageId) {
              // Determine language (default to ms if unknown, but better to check user)
              // Since we don't have user context easily here, we'll try to fetch user or just use bilingual
              const user = await db.getUser(state.chatId); // Assuming chatId is userId for DM
              const lang = user?.language || 'ms';
              const text = lang === 'ms'
                ? '✅ *Bot telah dimulakan semula!* \n\nSistem kini beroperasi seperti biasa.'
                : '✅ *Bot has restarted successfully!* \n\nSystem is back online.';

              await bot.telegram.editMessageText(state.chatId, state.messageId, null, text, { parse_mode: 'Markdown' });
            } else {
              await bot.telegram.sendMessage(state.chatId, '✅ *Bot is back online!*', { parse_mode: 'Markdown' });
            }
          } catch (e) {
            console.error('Failed to send restart notification:', e.message);
          }
        }
        fs.unlinkSync(restartFile);
      }
    } catch (e) {
      console.error('Error handling restart file:', e.message);
    }

    console.log('🚀 CexiStore Bot is running!');
    console.log('Bot username:', bot.botInfo.username);
    console.log('☁️ Data stored securely in Supabase Cloud');

    // Start Auto-Updater (Silent Watchdog)
    const updater = new AutoUpdater(bot);
    updater.start();

    // Initialize stock alerts system
    initializeStockAlerts(bot);
    console.log('📊 Stock alert system initialized');

    // Start order expiry background job
    const { startOrderExpiryJob } = require('./utils/orderExpiry');
    startOrderExpiryJob(bot);

    // Check scheduled products every 5 minutes
    setInterval(() => {
      checkScheduledProducts(bot);
    }, 5 * 60 * 1000);
    console.log('📅 Scheduled publishing system initialized');
  })
  .catch((err) => {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('⚠️  Failed to start Telegram bot:', err.message);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('💡 Add valid TELEGRAM_BOT_TOKEN to start the bot');
  });

process.once('SIGINT', () => {
  const { stopOrderExpiryJob } = require('./utils/orderExpiry');
  stopOrderExpiryJob();
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  const { stopOrderExpiryJob } = require('./utils/orderExpiry');
  stopOrderExpiryJob();
  bot.stop('SIGTERM');
});