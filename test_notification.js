const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

// MOCK CONFIGURATION (Load from env or use defaults)
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHANNEL_ID = process.env.TRANSACTION_CHANNEL_ID || '-1003785593024';

if (!BOT_TOKEN) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN is missing in .env file.');
    console.error('Please make sure you have a .env file with your bot token.');
    process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

async function testNotification() {
    console.log('🚀 Starting Notification Test...');
    console.log(`📡 Target Channel: ${CHANNEL_ID}`);

    // 1. Mock Order Data (With complex symbols to test escaping)
    const order = {
        userId: 123456789,
        productId: 'VPS-TEST-ID',
        productName: 'VPS 16GB [PROMO] & <SPECIAL> "EDITION"', // Tricky name with symbols
        price: '60.69',
        paymentMethod: 'QRIS'
    };

    // 2. Escape HTML Function (Exact copy from admin.js)
    const escapeHtml = (str) => {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    // 3. Prepare Message
    const dateStr = new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(',', '');

    const cleanUserId = escapeHtml(order.userId);
    const cleanProductId = escapeHtml(order.productId);
    const cleanProductName = escapeHtml(order.productName);
    const cleanPrice = escapeHtml(order.price);
    const cleanMethod = escapeHtml(order.paymentMethod);

    const channelMsg =
        `🔔 <b>TRANSAKSI SELESAI</b> 🔔
<b>Testimoni Otomatis</b> | <b>Dibuat Bot</b> 📢
━━━━━━━━━━━━━━━━━━
🗓️ <b>TANGGAL</b> : ${dateStr}
📝 <b>BUYER</b> : ${cleanUserId}
🧾 <b>ID PRODUK</b> : <code>${cleanProductId}</code>
🛍️ <b>NAMA PRODUK</b> : ${cleanProductName}
♻️ <b>JUMLAH</b> : 1
✅ <b>TOTAL</b> : RM ${cleanPrice}
🏦 <b>METODE PEMBAYARAN</b> : ${cleanMethod}
━━━━━━━━━━━━━━━━━━
<b>TERIMAKASIH SUDAH BERBELANJA</b> 😊
━━━━━━━━━━━━━━━━━━
<b>BUY MANUAL</b>: @colebrs
<b>TESTIMONI</b>: @cexistore_testi
━━━━━━━━━━━━━━━━━━`;

    console.log('\n📝 Generated Message (HTML):');
    console.log(channelMsg);

    // 4. Send Message
    try {
        const keyboard = Markup.inlineKeyboard([
            [Markup.button.url('🛒 ORDER SEKARANG', `https://t.me/test_bot`)]
        ]);

        await bot.telegram.sendMessage(CHANNEL_ID, channelMsg, { parse_mode: 'HTML', ...keyboard });
        console.log('\n✅ SUCCESS! Message sent to channel.');
    } catch (e) {
        console.error('\n❌ FAILED to send message:');
        console.error(e.message);
        if (e.response) {
            console.error('Telegram Error Description:', e.response.description);
        }
    }
}

testNotification();
