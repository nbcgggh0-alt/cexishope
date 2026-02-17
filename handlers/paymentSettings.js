const { Markup } = require('telegraf');
const db = require('../utils/database');
const { isOwner } = require('./owner');

async function handlePaymentSettings(ctx) {
    if (!await isOwner(ctx.from.id)) return;

    const settings = await db.getSettings();
    const bank = settings.bankDetails || { bankName: 'Not Set', accountNo: 'Not Set', holderName: 'Not Set' };
    const qr = settings.paymentQr || {};

    let msg = `⚙️ *Payment Settings*\n\n`;
    msg += `🏦 *Bank Details:*\n`;
    msg += `Bank: ${bank.bankName}\n`;
    msg += `Account: \`${bank.accountNo}\`\n`;
    msg += `Holder: ${bank.holderName}\n\n`;

    msg += `📱 *QR Codes:*\n`;
    msg += `TnG/DuitNow: ${qr.tng ? '✅ Set' : '❌ Not Set'}\n`;
    msg += `QRIS/DANA: ${qr.qris ? '✅ Set' : '❌ Not Set'}\n\n`;

    msg += `*How to Change:*\n\n`;
    msg += `📝 *Set Bank Details:*\n`;
    msg += `/setbank Bank Name | Account No | Holder Name\n`;
    msg += `Example: \`/setbank Maybank | 1122334455 | Ali Bin Abu\`\n\n`;

    msg += `📸 *Set QR Code:*\n`;
    msg += `Send photo with caption:\n`;
    msg += `/setqr tng\n`;
    msg += `or\n`;
    msg += `/setqr qris`;

    await ctx.reply(msg, { parse_mode: 'Markdown' });
}

async function handleSetBank(ctx) {
    if (!await isOwner(ctx.from.id)) return;

    const input = ctx.message.text.split(' ').slice(1).join(' '); // Remove command
    if (!input) {
        await ctx.reply('❌ Usage: `/setbank Bank Name | Account No | Holder Name`', { parse_mode: 'Markdown' });
        return;
    }

    const parts = input.split('|').map(p => p.trim());
    if (parts.length < 3) {
        await ctx.reply('❌ Invalid format. Use `|` to separate fields.\nExample: `/setbank Maybank | 123456789 | Name`', { parse_mode: 'Markdown' });
        return;
    }

    const bankDetails = {
        bankName: parts[0],
        accountNo: parts[1],
        holderName: parts[2]
    };

    const currentSettings = await db.getSettings();
    await db.saveSettings({ ...currentSettings, bankDetails });

    await ctx.reply(`✅ *Bank Details Updated!*\n\n🏦 ${bankDetails.bankName}\n🔢 \`${bankDetails.accountNo}\`\n👤 ${bankDetails.holderName}`, { parse_mode: 'Markdown' });
}

async function handleSetQR(ctx) {
    // This handler expects a photo with caption /setqr tng or command with reply
    if (!await isOwner(ctx.from.id)) return;

    let type = '';
    const caption = ctx.message.caption || ctx.message.text || '';

    if (caption.includes('tng')) type = 'tng';
    else if (caption.includes('qris')) type = 'qris';
    else {
        await ctx.reply('❌ Usage: Send photo with caption `/setqr tng` or `/setqr qris`', { parse_mode: 'Markdown' });
        return;
    }

    // Get photo from message or reply
    let photo = null;
    if (ctx.message.photo) {
        photo = ctx.message.photo[ctx.message.photo.length - 1];
    } else if (ctx.message.reply_to_message && ctx.message.reply_to_message.photo) {
        photo = ctx.message.reply_to_message.photo[ctx.message.reply_to_message.photo.length - 1];
    }

    if (!photo) {
        await ctx.reply('❌ No photo found. Please attach a photo or reply to one.');
        return;
    }

    const currentSettings = await db.getSettings();
    const paymentQr = currentSettings.paymentQr || {};
    paymentQr[type] = photo.file_id;

    await db.saveSettings({ ...currentSettings, paymentQr });

    await ctx.reply(`✅ *QR Code (${type.toUpperCase()}) Updated!*`, { parse_mode: 'Markdown' });
}

module.exports = {
    handlePaymentSettings,
    handleSetBank,
    handleSetQR
};
