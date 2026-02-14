const db = require('../utils/database');
const { generateId } = require('../utils/helpers');
const { t } = require('../utils/translations');

async function handleCreateVoucher(ctx) {
  const { isAdmin } = require('./admin');
  const userId = ctx.from.id;
  
  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized / Tidak dibenarkan');
    return;
  }
  
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  
  const input = ctx.message.text.replace('/createvoucher', '').trim();
  
  if (!input) {
    const message = lang === 'ms'
      ? `🎫 *Buat Baucher Baru*

Format:
\`/createvoucher [kod] | [diskaun%] | [max guna] | [tamat (opsional)]\`

Contoh:
\`/createvoucher JIMAT50 | 50 | 100\`
\`/createvoucher RAYA2025 | 30 | 50 | 2025-12-31\`

📝 Penjelasan:
• Kod: Kod baucher (contoh: JIMAT50)
• Diskaun%: Peratus diskaun (1-99)
• Max Guna: Bilangan maksimum penggunaan
• Tamat: Tarikh tamat (opsional, format: YYYY-MM-DD)`
      : `🎫 *Create New Voucher*

Format:
\`/createvoucher [code] | [discount%] | [max uses] | [expiry (optional)]\`

Example:
\`/createvoucher SAVE50 | 50 | 100\`
\`/createvoucher RAYA2025 | 30 | 50 | 2025-12-31\`

📝 Explanation:
• Code: Voucher code (example: SAVE50)
• Discount%: Discount percentage (1-99)
• Max Uses: Maximum number of uses
• Expiry: Expiry date (optional, format: YYYY-MM-DD)`;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }
  
  const parts = input.split('|').map(p => p.trim());
  
  if (parts.length < 3) {
    const message = lang === 'ms'
      ? '❌ Format tidak sah. Sila berikan semua maklumat yang diperlukan.'
      : '❌ Invalid format. Please provide all required information.';
    await ctx.reply(message);
    return;
  }
  
  const code = parts[0].toUpperCase();
  const discount = parseInt(parts[1]);
  const maxUses = parseInt(parts[2]);
  const expiryDate = parts[3] || null;
  
  if (!code || code.length < 3) {
    const message = lang === 'ms'
      ? '❌ Kod baucher mesti sekurang-kurangnya 3 aksara.'
      : '❌ Voucher code must be at least 3 characters.';
    await ctx.reply(message);
    return;
  }
  
  if (isNaN(discount) || discount < 1 || discount > 99) {
    const message = lang === 'ms'
      ? '❌ Diskaun mesti antara 1% hingga 99%.'
      : '❌ Discount must be between 1% and 99%.';
    await ctx.reply(message);
    return;
  }
  
  if (isNaN(maxUses) || maxUses < 1) {
    const message = lang === 'ms'
      ? '❌ Bilangan maksimum penggunaan mesti sekurang-kurangnya 1.'
      : '❌ Maximum uses must be at least 1.';
    await ctx.reply(message);
    return;
  }
  
  const vouchers = await db.getVouchers();
  
  const existing = vouchers.find(v => v.code.toUpperCase() === code);
  if (existing) {
    const message = lang === 'ms'
      ? '❌ Kod baucher ini sudah wujud. Sila gunakan kod yang berbeza.'
      : '❌ This voucher code already exists. Please use a different code.';
    await ctx.reply(message);
    return;
  }
  
  const newVoucher = {
    id: generateId('VOUCH'),
    code: code,
    value: discount,
    type: 'percentage',
    maxUses: maxUses,
    usedCount: 0,
    usedBy: [],
    expiryDate: expiryDate,
    createdBy: userId,
    createdAt: new Date().toISOString(),
    active: true
  };
  
  vouchers.push(newVoucher);
  await db.saveVouchers(vouchers);
  
  const expiryText = expiryDate 
    ? (lang === 'ms' ? `\n📅 Tamat: ${expiryDate}` : `\n📅 Expires: ${expiryDate}`)
    : '';
  
  const message = lang === 'ms'
    ? `✅ *Baucher Berjaya Dibuat!*

🎫 Kod: \`${code}\`
💰 Diskaun: ${discount}%
📊 Max Guna: ${maxUses}
🔢 Digunakan: 0${expiryText}

Customer boleh guna kod ini dengan command:
\`/redeem ${code}\``
    : `✅ *Voucher Created Successfully!*

🎫 Code: \`${code}\`
💰 Discount: ${discount}%
📊 Max Uses: ${maxUses}
🔢 Used: 0${expiryText}

Customers can use this code with command:
\`/redeem ${code}\``;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleRedeemVoucher(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  
  const code = ctx.message.text.replace('/redeem', '').trim().toUpperCase();
  
  if (!code) {
    const message = lang === 'ms'
      ? `🎫 *Cara Guna Baucher*

Format:
\`/redeem [KOD_BAUCHER]\`

Contoh:
\`/redeem JIMAT50\`

📝 Panduan:
1️⃣ Dapatkan kod baucher dari admin/promosi
2️⃣ Taip \`/redeem\` diikuti kod baucher
3️⃣ Baucher akan disimpan untuk digunakan pada order seterusnya
4️⃣ Diskaun akan ditolak automatik semasa checkout

💡 Nota: Kod baucher tidak case-sensitive (huruf besar/kecil sama sahaja)`
      : `🎫 *How to Use Voucher*

Format:
\`/redeem [VOUCHER_CODE]\`

Example:
\`/redeem SAVE50\`

📝 Guide:
1️⃣ Get voucher code from admin/promotion
2️⃣ Type \`/redeem\` followed by voucher code
3️⃣ Voucher will be saved for your next order
4️⃣ Discount will be applied automatically at checkout

💡 Note: Voucher codes are not case-sensitive`;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }
  
  const voucher = await db.getVoucher(code);
  
  if (!voucher) {
    const message = lang === 'ms'
      ? `❌ Kod baucher tidak sah atau tidak wujud.

Sila pastikan:
• Kod baucher betul
• Kod baucher masih aktif
• Tiada typo dalam kod

Sila dapatkan kod baucher yang sah dari admin.`
      : `❌ Invalid or non-existent voucher code.

Please ensure:
• Voucher code is correct
• Voucher code is still active
• No typos in the code

Please get a valid voucher code from admin.`;
    
    await ctx.reply(message);
    return;
  }
  
  if (!voucher.active) {
    const message = lang === 'ms'
      ? '❌ Baucher ini tidak aktif lagi. Sila hubungi admin untuk maklumat lanjut.'
      : '❌ This voucher is no longer active. Please contact admin for more information.';
    await ctx.reply(message);
    return;
  }
  
  if (voucher.expiryDate) {
    const expiryDate = new Date(voucher.expiryDate);
    const now = new Date();
    if (now > expiryDate) {
      const message = lang === 'ms'
        ? `❌ Baucher ini telah tamat tempoh pada ${voucher.expiryDate}.`
        : `❌ This voucher expired on ${voucher.expiryDate}.`;
      await ctx.reply(message);
      return;
    }
  }
  
  if (voucher.usedCount >= voucher.maxUses) {
    const message = lang === 'ms'
      ? '❌ Baucher ini telah mencapai had maksimum penggunaan.'
      : '❌ This voucher has reached its maximum usage limit.';
    await ctx.reply(message);
    return;
  }
  
  if (voucher.usedBy && voucher.usedBy.includes(userId)) {
    const message = lang === 'ms'
      ? '❌ Anda telah menggunakan baucher ini sebelum ini. Setiap user hanya boleh guna sekali sahaja.'
      : '❌ You have already used this voucher. Each user can only use it once.';
    await ctx.reply(message);
    return;
  }
  
  await db.updateUser(userId, { activeVoucher: code });
  
  const message = lang === 'ms'
    ? `✅ *Baucher Berjaya Ditebus!*

🎫 Kod: \`${code}\`
💰 Diskaun: ${voucher.value}%

Baucher ini akan digunakan pada order seterusnya anda. Diskaun akan ditolak automatik semasa checkout.

🛒 Tekan butang "Beli Produk" untuk mula shopping!`
    : `✅ *Voucher Redeemed Successfully!*

🎫 Code: \`${code}\`
💰 Discount: ${voucher.value}%

This voucher will be used on your next order. Discount will be applied automatically at checkout.

🛒 Click "Buy Products" button to start shopping!`;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleListVouchers(ctx) {
  const { isAdmin } = require('./admin');
  const userId = ctx.from.id;
  
  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized / Tidak dibenarkan');
    return;
  }
  
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  
  const vouchers = await db.getVouchers();
  
  if (vouchers.length === 0) {
    const message = lang === 'ms'
      ? '📋 Tiada baucher dijumpai. Gunakan /createvoucher untuk buat baucher baru.'
      : '📋 No vouchers found. Use /createvoucher to create a new voucher.';
    await ctx.reply(message);
    return;
  }
  
  let message = lang === 'ms'
    ? '🎫 *SENARAI BAUCHER*\n\n'
    : '🎫 *VOUCHER LIST*\n\n';
  
  vouchers.forEach((v, index) => {
    const status = v.active ? '✅' : '❌';
    const expiryText = v.expiryDate ? ` | ${lang === 'ms' ? 'Tamat' : 'Expires'}: ${v.expiryDate}` : '';
    
    message += `${index + 1}. ${status} \`${v.code}\`\n`;
    message += `   💰 ${v.value}% | 📊 ${v.usedCount}/${v.maxUses}${expiryText}\n\n`;
  });
  
  message += lang === 'ms'
    ? '\n💡 Gunakan /togglevoucher [kod] untuk aktif/nyahaktif baucher'
    : '\n💡 Use /togglevoucher [code] to activate/deactivate voucher';
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleToggleVoucher(ctx) {
  const { isAdmin } = require('./admin');
  const userId = ctx.from.id;
  
  if (!await isAdmin(userId)) {
    await ctx.reply('❌ Unauthorized / Tidak dibenarkan');
    return;
  }
  
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  
  const code = ctx.message.text.replace('/togglevoucher', '').trim().toUpperCase();
  
  if (!code) {
    const message = lang === 'ms'
      ? 'Format: /togglevoucher [kod]\n\nContoh: /togglevoucher JIMAT50'
      : 'Format: /togglevoucher [code]\n\nExample: /togglevoucher SAVE50';
    await ctx.reply(message);
    return;
  }
  
  const vouchers = await db.getVouchers();
  const voucher = vouchers.find(v => v.code.toUpperCase() === code);
  
  if (!voucher) {
    const message = lang === 'ms'
      ? '❌ Baucher tidak dijumpai.'
      : '❌ Voucher not found.';
    await ctx.reply(message);
    return;
  }
  
  voucher.active = !voucher.active;
  await db.saveVouchers(vouchers);
  
  const status = voucher.active
    ? (lang === 'ms' ? 'AKTIF' : 'ACTIVE')
    : (lang === 'ms' ? 'TIDAK AKTIF' : 'INACTIVE');
  
  const message = lang === 'ms'
    ? `✅ Baucher \`${code}\` kini ${status}`
    : `✅ Voucher \`${code}\` is now ${status}`;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleCheckVoucher(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  
  if (!user.activeVoucher) {
    const message = lang === 'ms'
      ? `❌ Anda tiada baucher aktif sekarang.

Gunakan \`/redeem [KOD]\` untuk tebus baucher.

Contoh: \`/redeem JIMAT50\``
      : `❌ You don't have an active voucher.

Use \`/redeem [CODE]\` to redeem a voucher.

Example: \`/redeem SAVE50\``;
    
    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }
  
  const voucher = await db.getVoucher(user.activeVoucher);
  
  if (!voucher || !voucher.active) {
    await db.updateUser(userId, { activeVoucher: null });
    const message = lang === 'ms'
      ? '❌ Baucher anda tidak sah lagi. Sila tebus baucher baru.'
      : '❌ Your voucher is no longer valid. Please redeem a new voucher.';
    await ctx.reply(message);
    return;
  }
  
  const expiryText = voucher.expiryDate
    ? (lang === 'ms' ? `\n📅 Tamat: ${voucher.expiryDate}` : `\n📅 Expires: ${voucher.expiryDate}`)
    : '';
  
  const message = lang === 'ms'
    ? `✅ *Baucher Aktif Anda*

🎫 Kod: \`${voucher.code}\`
💰 Diskaun: ${voucher.value}%${expiryText}

Baucher ini akan digunakan pada order seterusnya anda.`
    : `✅ *Your Active Voucher*

🎫 Code: \`${voucher.code}\`
💰 Discount: ${voucher.value}%${expiryText}

This voucher will be used on your next order.`;
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function applyVoucherToOrder(userId, totalAmount) {
  const user = await db.getUser(userId);
  
  if (!user || !user.activeVoucher) {
    return { finalAmount: totalAmount, discount: 0, voucherCode: null };
  }
  
  const voucher = await db.getVoucher(user.activeVoucher);
  
  if (!voucher || !voucher.active) {
    await db.updateUser(userId, { activeVoucher: null });
    return { finalAmount: totalAmount, discount: 0, voucherCode: null };
  }
  
  if (voucher.expiryDate) {
    const expiryDate = new Date(voucher.expiryDate);
    const now = new Date();
    if (now > expiryDate) {
      await db.updateUser(userId, { activeVoucher: null });
      return { finalAmount: totalAmount, discount: 0, voucherCode: null };
    }
  }
  
  if (voucher.usedCount >= voucher.maxUses) {
    await db.updateUser(userId, { activeVoucher: null });
    return { finalAmount: totalAmount, discount: 0, voucherCode: null };
  }
  
  if (voucher.usedBy && voucher.usedBy.includes(userId)) {
    await db.updateUser(userId, { activeVoucher: null });
    return { finalAmount: totalAmount, discount: 0, voucherCode: null };
  }
  
  const discountAmount = (totalAmount * voucher.value) / 100;
  const finalAmount = totalAmount - discountAmount;
  
  const vouchers = await db.getVouchers();
  const voucherIndex = vouchers.findIndex(v => v.code.toUpperCase() === voucher.code.toUpperCase());
  
  if (voucherIndex !== -1) {
    vouchers[voucherIndex].usedCount += 1;
    if (!vouchers[voucherIndex].usedBy) {
      vouchers[voucherIndex].usedBy = [];
    }
    vouchers[voucherIndex].usedBy.push(userId);
    await db.saveVouchers(vouchers);
  }
  
  await db.updateUser(userId, { activeVoucher: null });
  
  return {
    finalAmount: finalAmount,
    discount: discountAmount,
    voucherCode: voucher.code,
    discountPercentage: voucher.value
  };
}

module.exports = {
  handleCreateVoucher,
  handleRedeemVoucher,
  handleListVouchers,
  handleToggleVoucher,
  handleCheckVoucher,
  applyVoucherToOrder
};
