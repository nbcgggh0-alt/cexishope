const db = require('../utils/database');
const config = require('../config');
const { isAdmin } = require('./admin');

async function handleAutoPromotePanel(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? '📢 *Auto Promote Panel*\n\nManage your promotional campaigns:'
    : '📢 *Panel Auto Promosi*\n\nUrus kempen promosi anda:';

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: lang === 'en' ? '📨 Create Broadcast' : '📨 Buat Siaran', callback_data: 'promo_create_broadcast' },
          { text: lang === 'en' ? '⏰ Schedule Message' : '⏰ Jadual Mesej', callback_data: 'promo_schedule' }
        ],
        [
          { text: lang === 'en' ? '📝 Templates' : '📝 Templat', callback_data: 'promo_templates' },
          { text: lang === 'en' ? '🎯 User Targeting' : '🎯 Sasaran Pengguna', callback_data: 'promo_targeting' }
        ],
        [
          { text: lang === 'en' ? '📊 Analytics' : '📊 Analitik', callback_data: 'promo_analytics' },
          { text: lang === 'en' ? '🔄 A/B Testing' : '🔄 Ujian A/B', callback_data: 'promo_ab_test' }
        ],
        [
          { text: lang === 'en' ? '💰 Discount Codes' : '💰 Kod Diskaun', callback_data: 'promo_discounts' },
          { text: lang === 'en' ? '⚡ Flash Sales' : '⚡ Jualan Kilat', callback_data: 'promo_flash_sales' }
        ],
        [
          { text: lang === 'en' ? '🔁 Repeat Campaigns' : '🔁 Kempen Berulang', callback_data: 'promo_repeat' },
          { text: lang === 'en' ? '📋 Active Campaigns' : '📋 Kempen Aktif', callback_data: 'promo_active' }
        ],
        [{ text: lang === 'en' ? '🔙 Back to Admin' : '🔙 Kembali ke Admin', callback_data: 'admin_panel' }]
      ]
    }
  });
}

async function handleCreateBroadcast(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  ctx.session = ctx.session || {};
  ctx.session.awaitingBroadcast = true;

  const message = lang === 'en'
    ? '📨 *Create Broadcast*\n\nSend your promotional message to:\n\n1️⃣ All Users - Send to everyone\n2️⃣ Active Users - Users active in last 30 days\n3️⃣ Tagged Users - Send to specific tag\n\nPlease type your message:'
    : '📨 *Buat Siaran*\n\nHantar mesej promosi anda kepada:\n\n1️⃣ Semua Pengguna - Hantar ke semua\n2️⃣ Pengguna Aktif - Pengguna aktif dalam 30 hari terakhir\n3️⃣ Pengguna Bertag - Hantar ke tag tertentu\n\nSila taip mesej anda:';

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: lang === 'en' ? '👥 All Users' : '👥 Semua Pengguna', callback_data: 'broadcast_all' },
          { text: lang === 'en' ? '✅ Active Users' : '✅ Pengguna Aktif', callback_data: 'broadcast_active' }
        ],
        [
          { text: lang === 'en' ? '🏷️ Tagged Users' : '🏷️ Pengguna Bertag', callback_data: 'broadcast_tagged' },
          { text: lang === 'en' ? '❌ Cancel' : '❌ Batal', callback_data: 'promo_panel' }
        ]
      ]
    }
  });
}

async function handleScheduleMessage(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  let schedules = await db.getScheduledMessages();

  const message = lang === 'en'
    ? `⏰ *Scheduled Messages*\n\nActive Schedules: ${schedules.length}\n\nCreate a new scheduled message:\n\nFormat: /schedulemsg [date] [time] [message]\nExample: /schedulemsg 2025-12-25 10:00 Happy Holidays!`
    : `⏰ *Mesej Berjadual*\n\nJadual Aktif: ${schedules.length}\n\nBuat mesej berjadual baharu:\n\nFormat: /schedulemsg [tarikh] [masa] [mesej]\nContoh: /schedulemsg 2025-12-25 10:00 Selamat Hari Raya!`;

  const keyboard = schedules.slice(0, 5).map(s => [
    { text: `📅 ${s.date} ${s.time} - ${s.message.substring(0, 30)}...`, callback_data: `view_schedule_${s.id}` }
  ]);

  keyboard.push([{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_panel' }]);

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function handlePromoTemplates(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  let templates = await db.getPromoTemplates();

  const message = lang === 'en'
    ? `📝 *Promotion Templates*\n\nSaved Templates: ${templates.length}\n\nUse /addpromotemplate [name] [message] to create`
    : `📝 *Templat Promosi*\n\nTemplat Tersimpan: ${templates.length}\n\nGuna /addpromotemplate [nama] [mesej] untuk buat`;

  const keyboard = templates.slice(0, 5).map(t => [
    { text: `${t.name}`, callback_data: `use_promo_template_${t.id}` }
  ]);

  keyboard.push([{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_panel' }]);

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function handleUserTargeting(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const users = await db.getUsers();
  const activeUsers = users.filter(u => {
    const lastActive = new Date(u.lastActive || 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return lastActive > thirtyDaysAgo;
  });

  const message = lang === 'en'
    ? `🎯 *User Targeting*\n\n📊 Total Users: ${users.length}\n✅ Active (30 days): ${activeUsers.length}\n\nSegments:\n• All Users\n• Active Users\n• Tagged Users\n• Purchased Users\n• Non-buyers`
    : `🎯 *Sasaran Pengguna*\n\n📊 Jumlah Pengguna: ${users.length}\n✅ Aktif (30 hari): ${activeUsers.length}\n\nSegmen:\n• Semua Pengguna\n• Pengguna Aktif\n• Pengguna Bertag\n• Pengguna Beli\n• Belum Beli`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: lang === 'en' ? '👥 All' : '👥 Semua', callback_data: 'target_all' },
          { text: lang === 'en' ? '✅ Active' : '✅ Aktif', callback_data: 'target_active' }
        ],
        [
          { text: lang === 'en' ? '🏷️ Tagged' : '🏷️ Bertag', callback_data: 'target_tagged' },
          { text: lang === 'en' ? '🛍️ Buyers' : '🛍️ Pembeli', callback_data: 'target_buyers' }
        ],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_panel' }]
      ]
    }
  });
}

async function handlePromoAnalytics(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const campaigns = await db.getCampaigns();
  const totalSent = campaigns.reduce((sum, c) => sum + (c.sent || 0), 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);

  const message = lang === 'en'
    ? `📊 *Promotion Analytics*\n\n📨 Total Messages Sent: ${totalSent}\n👆 Total Clicks: ${totalClicks}\n💰 Conversions: ${totalConversions}\n📈 Click Rate: ${totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(2) : 0}%\n💵 Conversion Rate: ${totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : 0}%`
    : `📊 *Analitik Promosi*\n\n📨 Jumlah Mesej Dihantar: ${totalSent}\n👆 Jumlah Klik: ${totalClicks}\n💰 Penukaran: ${totalConversions}\n📈 Kadar Klik: ${totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(2) : 0}%\n💵 Kadar Penukaran: ${totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(2) : 0}%`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '📈 Detailed Report' : '📈 Laporan Terperinci', callback_data: 'promo_detailed_report' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_panel' }]
      ]
    }
  });
}

async function handleABTesting(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? `🔄 *A/B Testing*\n\nTest different messages to find what works best!\n\nCreate test: /createabtest [name] [messageA] | [messageB]\n\nExample:\n/createabtest "Sale Test" Get 20% off today! | Limited time 20% discount!`
    : `🔄 *Ujian A/B*\n\nUji mesej berbeza untuk cari yang terbaik!\n\nBuat ujian: /createabtest [nama] [mesejA] | [mesejB]\n\nContoh:\n/createabtest "Ujian Jualan" Dapat 20% diskaun hari ini! | Diskaun 20% masa terhad!`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '➕ Create A/B Test' : '➕ Buat Ujian A/B', callback_data: 'create_ab_test' }],
        [{ text: lang === 'en' ? '📊 View Results' : '📊 Lihat Hasil', callback_data: 'ab_test_results' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_panel' }]
      ]
    }
  });
}

async function handleDiscountCodes(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const discounts = await db.getVouchers();

  const message = lang === 'en'
    ? `💰 *Discount Codes (Vouchers)*\n\nActive Codes: ${discounts.length}\n\nCreate: /creatediscount [code] [percentage] [maxUses]\nExample: /creatediscount SAVE20 20 100`
    : `💰 *Kod Diskaun (Baucher)*\n\nKod Aktif: ${discounts.length}\n\nBuat: /creatediscount [kod] [peratusan] [maksPenggunaan]\nContoh: /creatediscount JIMAT20 20 100`;

  const keyboard = discounts.slice(0, 5).map(d => [
    { text: `${d.code} - ${d.value}% (${d.usedCount || 0}/${d.maxUses})`, callback_data: `view_discount_${d.code}` }
  ]);

  keyboard.push([{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_panel' }]);

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function handleFlashSales(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const flashSales = await db.getFlashSales();
  const activeFlashSales = flashSales.filter(f => new Date(f.endTime) > new Date());

  const message = lang === 'en'
    ? `⚡ *Flash Sales*\n\nActive Flash Sales: ${activeFlashSales.length}\n\nCreate: /createflash [productId] [discount%] [duration_hours]\nExample: /createflash PROD123 30 24`
    : `⚡ *Jualan Kilat*\n\nJualan Kilat Aktif: ${activeFlashSales.length}\n\nBuat: /createflash [idProduk] [diskaun%] [jam_durasi]\nContoh: /createflash PROD123 30 24`;

  const keyboard = activeFlashSales.slice(0, 5).map(f => [
    { text: `${f.productName} - ${f.discount}% (${f.hoursLeft}h left)`, callback_data: `view_flash_${f.id}` }
  ]);

  keyboard.push([{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_panel' }]);

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function handleRepeatCampaigns(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const repeatCampaigns = await db.getRepeatCampaigns();

  const message = lang === 'en'
    ? `🔁 *Repeat Campaigns*\n\nActive Recurring: ${repeatCampaigns.length}\n\nCreate: /repeatcampaign [interval] [message]\nIntervals: daily, weekly, monthly\n\nExample: /repeatcampaign weekly Check our new products!`
    : `🔁 *Kempen Berulang*\n\nBerulang Aktif: ${repeatCampaigns.length}\n\nBuat: /repeatcampaign [selang] [mesej]\nSelang: daily, weekly, monthly\n\nContoh: /repeatcampaign weekly Lihat produk baharu kami!`;

  const keyboard = repeatCampaigns.slice(0, 5).map(r => [
    { text: `${r.interval} - ${r.message.substring(0, 30)}...`, callback_data: `view_repeat_${r.id}` }
  ]);

  keyboard.push([{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_panel' }]);

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

async function handleActiveCampaigns(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const campaigns = await db.getCampaigns();
  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  const message = lang === 'en'
    ? `📋 *Active Campaigns*\n\nRunning: ${activeCampaigns.length}\n\n${activeCampaigns.slice(0, 10).map((c, i) =>
      `${i + 1}. ${c.name}\n   📨 Sent: ${c.sent || 0} | 👆 Clicks: ${c.clicks || 0}`
    ).join('\n\n')}`
    : `📋 *Kempen Aktif*\n\nBerjalan: ${activeCampaigns.length}\n\n${activeCampaigns.slice(0, 10).map((c, i) =>
      `${i + 1}. ${c.name}\n   📨 Dihantar: ${c.sent || 0} | 👆 Klik: ${c.clicks || 0}`
    ).join('\n\n')}`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '⏸️ Pause All' : '⏸️ Jeda Semua', callback_data: 'pause_all_campaigns' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_panel' }]
      ]
    }
  });
}

async function handleBroadcastAll(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const users = await db.getUsers();

  const message = lang === 'en'
    ? `👥 *Broadcast to All Users*\n\nTotal Recipients: ${users.length}\n\nPlease send your broadcast message now:`
    : `👥 *Siaran ke Semua Pengguna*\n\nJumlah Penerima: ${users.length}\n\nSila hantar mesej siaran anda sekarang:`;

  ctx.session = ctx.session || {};
  ctx.session.awaitingBroadcastAll = true;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Cancel' : '🔙 Batal', callback_data: 'promo_create_broadcast' }]
      ]
    }
  });
}

async function handleBroadcastActive(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const users = await db.getUsers();
  const activeUsers = users.filter(u => {
    const lastActive = new Date(u.lastActive || 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return lastActive > thirtyDaysAgo;
  });

  const message = lang === 'en'
    ? `✅ *Broadcast to Active Users*\n\nActive Users (30 days): ${activeUsers.length}\n\nPlease send your broadcast message now:`
    : `✅ *Siaran ke Pengguna Aktif*\n\nPengguna Aktif (30 hari): ${activeUsers.length}\n\nSila hantar mesej siaran anda sekarang:`;

  ctx.session = ctx.session || {};
  ctx.session.awaitingBroadcastActive = true;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Cancel' : '🔙 Batal', callback_data: 'promo_create_broadcast' }]
      ]
    }
  });
}

async function handleBroadcastTagged(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? `🏷️ *Broadcast to Tagged Users*\n\nPlease specify the tag:\n\nFormat: /broadcasttag [tag_name] [message]\n\nExample:\n/broadcasttag vip Check out our exclusive offers!`
    : `🏷️ *Siaran ke Pengguna Bertag*\n\nSila nyatakan tag:\n\nFormat: /broadcasttag [nama_tag] [mesej]\n\nContoh:\n/broadcasttag vip Lihat tawaran eksklusif kami!`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Cancel' : '🔙 Batal', callback_data: 'promo_create_broadcast' }]
      ]
    }
  });
}

async function handleTargetAll(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const users = await db.getUsers();

  const message = lang === 'en'
    ? `👥 *All Users Segment*\n\nTotal Users: ${users.length}\n\n📊 Breakdown:\n• Total Registered: ${users.length}\n• Average Activity: Daily check recommended\n\nUse this segment for:\n• General announcements\n• New product launches\n• Important updates`
    : `👥 *Segmen Semua Pengguna*\n\nJumlah Pengguna: ${users.length}\n\n📊 Pecahan:\n• Jumlah Berdaftar: ${users.length}\n• Aktiviti Purata: Semak harian disyorkan\n\nGuna segmen ini untuk:\n• Pengumuman umum\n• Pelancaran produk baharu\n• Kemas kini penting`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '📨 Send Broadcast' : '📨 Hantar Siaran', callback_data: 'broadcast_all' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_targeting' }]
      ]
    }
  });
}

async function handleTargetActive(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const users = await db.getUsers();
  const activeUsers = users.filter(u => {
    const lastActive = new Date(u.lastActive || 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return lastActive > thirtyDaysAgo;
  });

  const message = lang === 'en'
    ? `✅ *Active Users Segment*\n\nActive Users (30 days): ${activeUsers.length}\nConversion Rate: Higher\n\n📊 Best for:\n• Flash sales\n• Limited time offers\n• Engagement campaigns`
    : `✅ *Segmen Pengguna Aktif*\n\nPengguna Aktif (30 hari): ${activeUsers.length}\nKadar Penukaran: Lebih Tinggi\n\n📊 Terbaik untuk:\n• Jualan kilat\n• Tawaran masa terhad\n• Kempen penglibatan`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '📨 Send Broadcast' : '📨 Hantar Siaran', callback_data: 'broadcast_active' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_targeting' }]
      ]
    }
  });
}

async function handleTargetTagged(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const users = await db.getUsers();
  const taggedUsers = users.filter(u => u.tags && u.tags.length > 0);

  const allTags = [...new Set(users.flatMap(u => u.tags || []))];

  const message = lang === 'en'
    ? `🏷️ *Tagged Users Segment*\n\nUsers with Tags: ${taggedUsers.length}\nAvailable Tags: ${allTags.join(', ') || 'None'}\n\nUse /tag [user_id] [tag] to add tags\n\nThen broadcast with:\n/broadcasttag [tag] [message]`
    : `🏷️ *Segmen Pengguna Bertag*\n\nPengguna dengan Tag: ${taggedUsers.length}\nTag Tersedia: ${allTags.join(', ') || 'Tiada'}\n\nGuna /tag [user_id] [tag] untuk tambah tag\n\nKemudian siar dengan:\n/broadcasttag [tag] [mesej]`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '📨 Send to Tagged' : '📨 Hantar ke Bertag', callback_data: 'broadcast_tagged' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_targeting' }]
      ]
    }
  });
}

async function handleTargetBuyers(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const buyerIds = [...new Set(transactions.filter(t => t.status === 'verified').map(t => t.userId))];

  const message = lang === 'en'
    ? `🛍️ *Buyers Segment*\n\nTotal Buyers: ${buyerIds.length}\n\n📊 Best for:\n• Cross-sell campaigns\n• Loyalty rewards\n• Repeat purchase incentives\n• Premium product launches`
    : `🛍️ *Segmen Pembeli*\n\nJumlah Pembeli: ${buyerIds.length}\n\n📊 Terbaik untuk:\n• Kempen jualan silang\n• Ganjaran kesetiaan\n• Insentif pembelian berulang\n• Pelancaran produk premium`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '📨 Send to Buyers' : '📨 Hantar ke Pembeli', callback_data: 'broadcast_buyers' }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_targeting' }]
      ]
    }
  });
}

async function handlePromoDetailedReport(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const campaigns = await db.getCampaigns();

  let report = lang === 'en' ? '📈 *Detailed Analytics Report*\n\n' : '📈 *Laporan Analitik Terperinci*\n\n';

  if (campaigns.length === 0) {
    report += lang === 'en' ? 'No campaigns yet.' : 'Tiada kempen lagi.';
  } else {
    campaigns.slice(0, 10).forEach((c, i) => {
      const clickRate = c.sent > 0 ? ((c.clicks || 0) / c.sent * 100).toFixed(2) : 0;
      const convRate = (c.clicks || 0) > 0 ? ((c.conversions || 0) / c.clicks * 100).toFixed(2) : 0;

      report += `${i + 1}. *${c.name || 'Unnamed'}*\n`;
      report += `   📨 Sent: ${c.sent || 0}\n`;
      report += `   👆 Clicks: ${c.clicks || 0} (${clickRate}%)\n`;
      report += `   💰 Conversions: ${c.conversions || 0} (${convRate}%)\n`;
      report += `   📅 Date: ${c.date || 'N/A'}\n\n`;
    });
  }

  await ctx.reply(report, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_analytics' }]
      ]
    }
  });
}

async function handleCreateABTest(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const message = lang === 'en'
    ? `➕ *Create A/B Test*\n\nFormat:\n/createabtest [name] [messageA] | [messageB]\n\nExample:\n/createabtest "Holiday Sale" 🎄 Get 30% off now! | 🎁 Limited: 30% discount today!\n\nThe system will randomly send either version and track which performs better.`
    : `➕ *Buat Ujian A/B*\n\nFormat:\n/createabtest [nama] [mesejA] | [mesejB]\n\nContoh:\n/createabtest "Jualan Raya" 🎄 Dapat 30% diskaun sekarang! | 🎁 Terhad: 30% diskaun hari ini!\n\nSistem akan hantar salah satu versi secara rawak dan jejak prestasi.`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_ab_test' }]
      ]
    }
  });
}

async function handleABTestResults(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const abTests = await db.getABTests();

  let message = lang === 'en' ? '📊 *A/B Test Results*\n\n' : '📊 *Hasil Ujian A/B*\n\n';

  if (abTests.length === 0) {
    message += lang === 'en' ? 'No A/B tests yet. Create one to start testing!' : 'Tiada ujian A/B lagi. Buat satu untuk mula menguji!';
  } else {
    abTests.forEach((test, i) => {
      const winnerText = lang === 'en' ? 'Winner' : 'Pemenang';
      const winner = (test.clicksA || 0) > (test.clicksB || 0) ? 'A' : 'B';

      message += `${i + 1}. *${test.name}*\n`;
      message += `   Version A: ${test.clicksA || 0} clicks\n`;
      message += `   Version B: ${test.clicksB || 0} clicks\n`;
      message += `   ${winnerText}: Version ${winner}\n\n`;
    });
  }

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_ab_test' }]
      ]
    }
  });
}

async function handlePauseAllCampaigns(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const campaigns = await db.getCampaigns();
  let pausedCount = 0;

  campaigns.forEach(c => {
    if (c.status === 'active') {
      c.status = 'paused';
      pausedCount++;
    }
  });

  await db.saveCampaigns(campaigns);

  const message = lang === 'en'
    ? `⏸️ *Campaigns Paused*\n\n${pausedCount} active campaigns have been paused.\n\nYou can resume them individually from the campaign management panel.`
    : `⏸️ *Kempen Dijeda*\n\n${pausedCount} kempen aktif telah dijeda.\n\nAnda boleh sambung semula dari panel pengurusan kempen.`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_active' }]
      ]
    }
  });
}

async function handleViewSchedule(ctx, scheduleId) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const schedules = await db.getScheduledMessages();
  const schedule = schedules.find(s => s.id === scheduleId);

  if (!schedule) {
    await ctx.reply(lang === 'en' ? '❌ Schedule not found' : '❌ Jadual tidak dijumpai');
    return;
  }

  const message = lang === 'en'
    ? `📅 *Scheduled Message*\n\nDate: ${schedule.date}\nTime: ${schedule.time}\nMessage: ${schedule.message}\n\nStatus: ${schedule.status || 'pending'}`
    : `📅 *Mesej Berjadual*\n\nTarikh: ${schedule.date}\nMasa: ${schedule.time}\nMesej: ${schedule.message}\n\nStatus: ${schedule.status || 'menunggu'}`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🗑️ Delete' : '🗑️ Padam', callback_data: `delete_schedule_${scheduleId}` }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_schedule' }]
      ]
    }
  });
}

async function handleUsePromoTemplate(ctx, templateId) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const templates = await db.getPromoTemplates();
  const template = templates.find(t => t.id === templateId);

  if (!template) {
    await ctx.reply(lang === 'en' ? '❌ Template not found' : '❌ Templat tidak dijumpai');
    return;
  }

  const message = lang === 'en'
    ? `📝 *Using Template: ${template.name}*\n\nMessage:\n${template.message}\n\nSend this to:`
    : `📝 *Guna Templat: ${template.name}*\n\nMesej:\n${template.message}\n\nHantar ke:`;

  ctx.session = ctx.session || {};
  ctx.session.templateMessage = template.message;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: lang === 'en' ? '👥 All Users' : '👥 Semua', callback_data: 'broadcast_all' },
          { text: lang === 'en' ? '✅ Active' : '✅ Aktif', callback_data: 'broadcast_active' }
        ],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_templates' }]
      ]
    }
  });
}

async function handleViewDiscount(ctx, discountCode) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const discounts = await db.getVouchers();
  const discount = discounts.find(d => d.code === discountCode);

  if (!discount) {
    await ctx.reply(lang === 'en' ? '❌ Discount code not found' : '❌ Kod diskaun tidak dijumpai');
    return;
  }

  const message = lang === 'en'
    ? `💰 *Discount Code: ${discount.code}*\n\n💵 Discount: ${discount.value}%\n📊 Used: ${discount.usedCount || 0}/${discount.maxUses}\n📅 Created: ${discount.created || 'N/A'}\n⏰ Expires: ${discount.expires || 'Never'}\n\nStatus: ${discount.usedCount >= discount.maxUses ? '❌ Exhausted' : '✅ Active'}`
    : `💰 *Kod Diskaun: ${discount.code}*\n\n💵 Diskaun: ${discount.value}%\n📊 Digunakan: ${discount.usedCount || 0}/${discount.maxUses}\n📅 Dicipta: ${discount.created || 'N/A'}\n⏰ Luput: ${discount.expires || 'Tidak'}\n\nStatus: ${discount.usedCount >= discount.maxUses ? '❌ Habis' : '✅ Aktif'}`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🗑️ Delete' : '🗑️ Padam', callback_data: `delete_discount_${discountCode}` }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_discounts' }]
      ]
    }
  });
}

async function handleViewFlash(ctx, flashId) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const flashSales = await db.getFlashSales();
  const flash = flashSales.find(f => f.id === flashId);

  if (!flash) {
    await ctx.reply(lang === 'en' ? '❌ Flash sale not found' : '❌ Jualan kilat tidak dijumpai');
    return;
  }

  const timeLeft = new Date(flash.endTime) - new Date();
  const hoursLeft = Math.max(0, Math.floor(timeLeft / (1000 * 60 * 60)));

  const message = lang === 'en'
    ? `⚡ *Flash Sale*\n\nProduct: ${flash.productName}\n💵 Discount: ${flash.discount}%\n⏰ Time Left: ${hoursLeft} hours\n📅 Ends: ${flash.endTime}\n\nStatus: ${hoursLeft > 0 ? '✅ Active' : '❌ Expired'}`
    : `⚡ *Jualan Kilat*\n\nProduk: ${flash.productName}\n💵 Diskaun: ${flash.discount}%\n⏰ Masa Tinggal: ${hoursLeft} jam\n📅 Tamat: ${flash.endTime}\n\nStatus: ${hoursLeft > 0 ? '✅ Aktif' : '❌ Tamat'}`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🗑️ End Sale' : '🗑️ Tamat Jualan', callback_data: `end_flash_${flashId}` }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_flash_sales' }]
      ]
    }
  });
}

async function handleViewRepeat(ctx, repeatId) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const repeatCampaigns = await db.getRepeatCampaigns();
  const repeat = repeatCampaigns.find(r => r.id === repeatId);

  if (!repeat) {
    await ctx.reply(lang === 'en' ? '❌ Repeat campaign not found' : '❌ Kempen berulang tidak dijumpai');
    return;
  }

  const message = lang === 'en'
    ? `🔁 *Repeat Campaign*\n\nInterval: ${repeat.interval}\nMessage: ${repeat.message}\n📊 Sent: ${repeat.timesSent || 0} times\n📅 Last Sent: ${repeat.lastSent || 'Never'}\n📅 Next Send: ${repeat.nextSend || 'Calculating...'}\n\nStatus: ${repeat.status || 'active'}`
    : `🔁 *Kempen Berulang*\n\nSelang: ${repeat.interval}\nMesej: ${repeat.message}\n📊 Dihantar: ${repeat.timesSent || 0} kali\n📅 Terakhir Dihantar: ${repeat.lastSent || 'Belum'}\n📅 Hantar Seterusnya: ${repeat.nextSend || 'Mengira...'}\n\nStatus: ${repeat.status || 'aktif'}`;

  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '⏸️ Pause' : '⏸️ Jeda', callback_data: `pause_repeat_${repeatId}` }],
        [{ text: lang === 'en' ? '🗑️ Delete' : '🗑️ Padam', callback_data: `delete_repeat_${repeatId}` }],
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_repeat' }]
      ]
    }
  });
}

async function handleScheduleMsg(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const { generateId } = require('../utils/helpers');
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const text = ctx.message.text.replace('/schedulemsg', '').trim();
  const parts = text.split(' ');

  if (parts.length < 3) {
    const message = lang === 'en'
      ? '❌ Invalid format!\n\nUsage: /schedulemsg [date] [time] [message]\nExample: /schedulemsg 2025-12-25 10:00 Happy Holidays!'
      : '❌ Format tidak sah!\n\nGuna: /schedulemsg [tarikh] [masa] [mesej]\nContoh: /schedulemsg 2025-12-25 10:00 Selamat Hari Raya!';
    await ctx.reply(message);
    return;
  }

  const date = parts[0];
  const time = parts[1];
  const message = parts.slice(2).join(' ');

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  const timeRegex = /^\d{2}:\d{2}$/;

  if (!dateRegex.test(date)) {
    const errorMsg = lang === 'en'
      ? '❌ Invalid date format! Use YYYY-MM-DD (e.g., 2025-12-25)'
      : '❌ Format tarikh tidak sah! Guna YYYY-MM-DD (contoh: 2025-12-25)';
    await ctx.reply(errorMsg);
    return;
  }

  if (!timeRegex.test(time)) {
    const errorMsg = lang === 'en'
      ? '❌ Invalid time format! Use HH:MM (e.g., 10:00)'
      : '❌ Format masa tidak sah! Guna HH:MM (contoh: 10:00)';
    await ctx.reply(errorMsg);
    return;
  }

  const schedules = await db.getScheduledMessages();

  const newSchedule = {
    id: generateId('SCH'),
    date,
    time,
    message,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  scheduledMessages.push(newSchedule);
  await db.saveScheduledMessages(scheduledMessages);

  const successMsg = lang === 'en'
    ? `✅ Message scheduled successfully!\n\n📅 Date: ${date}\n⏰ Time: ${time}\n📝 Message: ${message}\n\nID: ${newSchedule.id}`
    : `✅ Mesej berjadual berjaya!\n\n📅 Tarikh: ${date}\n⏰ Masa: ${time}\n📝 Mesej: ${message}\n\nID: ${newSchedule.id}`;

  await ctx.reply(successMsg);
}

async function handleAddPromoTemplate(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const { generateId } = require('../utils/helpers');
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const text = ctx.message.text.replace('/addpromotemplate', '').trim();
  const parts = text.split(' ');

  if (parts.length < 2) {
    const message = lang === 'en'
      ? '❌ Invalid format!\n\nUsage: /addpromotemplate [name] [message]\nExample: /addpromotemplate welcome Welcome to our store!'
      : '❌ Format tidak sah!\n\nGuna: /addpromotemplate [nama] [mesej]\nContoh: /addpromotemplate selamat Selamat datang ke kedai kami!';
    await ctx.reply(message);
    return;
  }

  const name = parts[0];
  const message = parts.slice(1).join(' ');

  const templates = await db.getPromoTemplates();

  const existing = templates.find(t => t.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    const errorMsg = lang === 'en'
      ? `❌ Template "${name}" already exists!`
      : `❌ Templat "${name}" sudah wujud!`;
    await ctx.reply(errorMsg);
    return;
  }

  const newTemplate = {
    id: generateId('TPL'),
    name,
    message,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    usageCount: 0
  };

  templates.push(newTemplate);
  await db.savePromoTemplates(templates);

  const successMsg = lang === 'en'
    ? `✅ Template created successfully!\n\n📝 Name: ${name}\n💬 Message: ${message}\n\nID: ${newTemplate.id}`
    : `✅ Templat berjaya dicipta!\n\n📝 Nama: ${name}\n💬 Mesej: ${message}\n\nID: ${newTemplate.id}`;

  await ctx.reply(successMsg);
}

async function handleCreateABTestCommand(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const { generateId } = require('../utils/helpers');
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const text = ctx.message.text.replace('/createabtest', '').trim();

  if (!text.includes('|')) {
    const message = lang === 'en'
      ? '❌ Invalid format!\n\nUsage: /createabtest [name] [messageA] | [messageB]\nExample: /createabtest "Sale Test" Get 20% off today! | Limited time 20% discount!'
      : '❌ Format tidak sah!\n\nGuna: /createabtest [nama] [mesejA] | [mesejB]\nContoh: /createabtest "Ujian Jualan" Dapat 20% diskaun hari ini! | Diskaun 20% masa terhad!';
    await ctx.reply(message);
    return;
  }

  const mainParts = text.split('|');
  if (mainParts.length !== 2) {
    const errorMsg = lang === 'en'
      ? '❌ Please provide exactly 2 message variants separated by |'
      : '❌ Sila berikan tepat 2 varian mesej dipisahkan dengan |';
    await ctx.reply(errorMsg);
    return;
  }

  const firstPart = mainParts[0].trim();
  const messageB = mainParts[1].trim();

  const firstWords = firstPart.split(' ');
  const name = firstWords[0];
  const messageA = firstWords.slice(1).join(' ');

  if (!name || !messageA || !messageB) {
    const errorMsg = lang === 'en'
      ? '❌ All fields are required: name, messageA, and messageB'
      : '❌ Semua medan diperlukan: nama, mesejA, dan mesejB';
    await ctx.reply(errorMsg);
    return;
  }

  const campaigns = await db.getCampaigns();

  const newTest = {
    id: generateId('ABT'),
    name,
    messageA,
    messageB,
    results: {
      a: { sent: 0, clicks: 0 },
      b: { sent: 0, clicks: 0 }
    },
    status: 'active',
    createdBy: userId,
    createdAt: new Date().toISOString()
  };

  campaigns.push(newTest);
  await db.saveCampaigns(campaigns);

  const successMsg = lang === 'en'
    ? `✅ A/B Test created successfully!\n\n📝 Name: ${name}\n\n🅰️ Message A:\n${messageA}\n\n🅱️ Message B:\n${messageB}\n\nID: ${newTest.id}\n\nThe system will randomly send either version and track performance.`
    : `✅ Ujian A/B berjaya dicipta!\n\n📝 Nama: ${name}\n\n🅰️ Mesej A:\n${messageA}\n\n🅱️ Mesej B:\n${messageB}\n\nID: ${newTest.id}\n\nSistem akan hantar salah satu versi secara rawak dan jejak prestasi.`;

  await ctx.reply(successMsg);
}

async function handleCreateDiscount(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const text = ctx.message.text.replace('/creatediscount', '').trim();
  const parts = text.split(' ');

  if (parts.length !== 3) {
    const message = lang === 'en'
      ? '❌ Invalid format!\n\nUsage: /creatediscount [code] [percentage] [maxUses]\nExample: /creatediscount SAVE20 20 100'
      : '❌ Format tidak sah!\n\nGuna: /creatediscount [kod] [peratusan] [maksPenggunaan]\nContoh: /creatediscount JIMAT20 20 100';
    await ctx.reply(message);
    return;
  }

  const code = parts[0].toUpperCase();
  const percentage = parseInt(parts[1]);
  const maxUses = parseInt(parts[2]);

  if (isNaN(percentage) || percentage < 1 || percentage > 100) {
    const errorMsg = lang === 'en'
      ? '❌ Percentage must be between 1 and 100!'
      : '❌ Peratusan mesti antara 1 dan 100!';
    await ctx.reply(errorMsg);
    return;
  }

  if (isNaN(maxUses) || maxUses < 1) {
    const errorMsg = lang === 'en'
      ? '❌ Max uses must be a positive number!'
      : '❌ Maks penggunaan mesti nombor positif!';
    await ctx.reply(errorMsg);
    return;
  }

  const discounts = await db.getVouchers();

  const existing = discounts.find(d => d.code === code);
  if (existing) {
    const errorMsg = lang === 'en'
      ? `❌ Discount code "${code}" already exists!`
      : `❌ Kod diskaun "${code}" sudah wujud!`;
    await ctx.reply(errorMsg);
    return;
  }

  const { generateId } = require('../utils/helpers');
  const newDiscount = {
    id: generateId('VOUCH'),
    code,
    value: percentage, // Unified to match voucher schema
    type: 'percentage',
    maxUses,
    usedCount: 0,
    usedBy: [],
    expiryDate: null,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    active: true
  };

  discounts.push(newDiscount);
  await db.saveVouchers(discounts);

  const successMsg = lang === 'en'
    ? `✅ Discount code created successfully!\n\n💰 Code: ${code}\n📊 Discount: ${percentage}%\n🎯 Max Uses: ${maxUses}\n📈 Used: 0/${maxUses}\n\nShare this code with your customers!`
    : `✅ Kod diskaun berjaya dicipta!\n\n💰 Kod: ${code}\n📊 Diskaun: ${percentage}%\n🎯 Maks Penggunaan: ${maxUses}\n📈 Digunakan: 0/${maxUses}\n\nKongsi kod ini dengan pelanggan anda!`;

  await ctx.reply(successMsg);
}

async function handleCreateFlash(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const { generateId } = require('../utils/helpers');
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const text = ctx.message.text.replace('/createflash', '').trim();
  const parts = text.split(' ');

  if (parts.length !== 3) {
    const message = lang === 'en'
      ? '❌ Invalid format!\n\nUsage: /createflash [productId] [discount%] [duration_hours]\nExample: /createflash PROD123 30 24'
      : '❌ Format tidak sah!\n\nGuna: /createflash [idProduk] [diskaun%] [jam_durasi]\nContoh: /createflash PROD123 30 24';
    await ctx.reply(message);
    return;
  }

  const productId = parts[0];
  const discount = parseInt(parts[1]);
  const durationHours = parseInt(parts[2]);

  if (isNaN(discount) || discount < 1 || discount > 100) {
    const errorMsg = lang === 'en'
      ? '❌ Discount must be between 1 and 100!'
      : '❌ Diskaun mesti antara 1 dan 100!';
    await ctx.reply(errorMsg);
    return;
  }

  if (isNaN(durationHours) || durationHours < 1) {
    const errorMsg = lang === 'en'
      ? '❌ Duration must be a positive number of hours!'
      : '❌ Durasi mesti nombor jam positif!';
    await ctx.reply(errorMsg);
    return;
  }

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    const errorMsg = lang === 'en'
      ? `❌ Product "${productId}" not found!`
      : `❌ Produk "${productId}" tidak dijumpai!`;
    await ctx.reply(errorMsg);
    return;
  }

  const abTests = await db.getABTests();

  const startTime = new Date().toISOString();
  const endTime = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();

  const newFlash = {
    id: generateId('FLS'),
    productId,
    productName: product.name.en || product.name.ms || product.name,
    discount,
    startTime,
    endTime,
    createdBy: userId,
    active: true
  };

  flashSales.push(newFlash);
  await db.saveFlashSales(flashSales);

  const successMsg = lang === 'en'
    ? `✅ Flash sale created successfully!\n\n⚡ Product: ${newFlash.productName}\n💰 Discount: ${discount}%\n⏰ Duration: ${durationHours} hours\n📅 Ends: ${new Date(endTime).toLocaleString()}\n\nID: ${newFlash.id}`
    : `✅ Jualan kilat berjaya dicipta!\n\n⚡ Produk: ${newFlash.productName}\n💰 Diskaun: ${discount}%\n⏰ Durasi: ${durationHours} jam\n📅 Tamat: ${new Date(endTime).toLocaleString()}\n\nID: ${newFlash.id}`;

  await ctx.reply(successMsg);
}

async function handleRepeatCampaign(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const { generateId } = require('../utils/helpers');
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const text = ctx.message.text.replace('/repeatcampaign', '').trim();
  const parts = text.split(' ');

  if (parts.length < 2) {
    const message = lang === 'en'
      ? '❌ Invalid format!\n\nUsage: /repeatcampaign [interval] [message]\nIntervals: daily, weekly, monthly\n\nExample: /repeatcampaign weekly Check our new products!'
      : '❌ Format tidak sah!\n\nGuna: /repeatcampaign [selang] [mesej]\nSelang: daily, weekly, monthly\n\nContoh: /repeatcampaign weekly Lihat produk baharu kami!';
    await ctx.reply(message);
    return;
  }

  const interval = parts[0].toLowerCase();
  const message = parts.slice(1).join(' ');

  const allowedIntervals = ['daily', 'weekly', 'monthly'];
  if (!allowedIntervals.includes(interval)) {
    const errorMsg = lang === 'en'
      ? `❌ Invalid interval! Must be one of: ${allowedIntervals.join(', ')}`
      : `❌ Selang tidak sah! Mesti salah satu: ${allowedIntervals.join(', ')}`;
    await ctx.reply(errorMsg);
    return;
  }

  const repeatCampaigns = await db.getRepeatCampaigns();

  const newCampaign = {
    id: generateId('RPC'),
    interval,
    message,
    lastSent: null,
    nextSend: null,
    active: true,
    createdBy: userId,
    createdAt: new Date().toISOString()
  };

  repeatCampaigns.push(newCampaign);
  await db.saveRepeatCampaigns(repeatCampaigns);

  const successMsg = lang === 'en'
    ? `✅ Repeat campaign created successfully!\n\n🔁 Interval: ${interval}\n📝 Message: ${message}\n\nID: ${newCampaign.id}\n\nThe campaign will run automatically at the specified interval.`
    : `✅ Kempen berulang berjaya dicipta!\n\n🔁 Selang: ${interval}\n📝 Mesej: ${message}\n\nID: ${newCampaign.id}\n\nKempen akan berjalan secara automatik pada selang yang dinyatakan.`;

  await ctx.reply(successMsg);
}

async function handleDeleteDiscount(ctx) {
  const userId = ctx.from.id;
  if (!await isAdmin(userId)) return;

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const discountCode = ctx.match[1]; // Get code from regex match
  const vouchers = await db.getVouchers();
  const index = vouchers.findIndex(v => v.code === discountCode);

  /*
  if (index === -1) {
    const errorMsg = lang === 'en' ? '❌ Discount code not found' : '❌ Kod diskaun tidak dijumpai';
    await ctx.answerCbQuery(errorMsg);
    return;
  }
  */

  if (index !== -1) {
    vouchers.splice(index, 1);
    await db.saveVouchers(vouchers);
  }

  const message = lang === 'en'
    ? `✅ Discount code *${discountCode}* deleted successfully!`
    : `✅ Kod diskaun *${discountCode}* berjaya dipadam!`;

  await ctx.answerCbQuery();
  await ctx.reply(message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: lang === 'en' ? '🔙 Back' : '🔙 Kembali', callback_data: 'promo_discounts' }]
      ]
    }
  });
}

module.exports = {
  handleAutoPromotePanel,
  handleCreateBroadcast,
  handleScheduleMessage,
  handlePromoTemplates,
  handleUserTargeting,
  handlePromoAnalytics,
  handleABTesting,
  handleDiscountCodes,
  handleFlashSales,
  handleRepeatCampaigns,
  handleActiveCampaigns,
  handleBroadcastAll,
  handleBroadcastActive,
  handleBroadcastTagged,
  handleTargetAll,
  handleTargetActive,
  handleTargetTagged,
  handleTargetBuyers,
  handlePromoDetailedReport,
  handleCreateABTest,
  handleABTestResults,
  handlePauseAllCampaigns,
  handleViewSchedule,
  handleUsePromoTemplate,
  handleViewDiscount,
  handleDeleteDiscount,
  handleViewFlash,
  handleViewRepeat,
  handleScheduleMsg,
  handleAddPromoTemplate,
  handleCreateABTestCommand,
  handleCreateDiscount,
  handleCreateFlash,
  handleRepeatCampaign
};
