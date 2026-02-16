const db = require('../utils/database');
const { Markup } = require('telegraf');
const { safeEditMessage } = require('../utils/messageHelper');

// Track users who are in "upload proof" mode: Map<userId, orderId>
const proofUploadState = new Map();

/**
 * Set user into "waiting for proof" mode after order creation
 */
function setAwaitingProof(userId, orderId) {
    proofUploadState.set(userId, orderId);
}

/**
 * Clear proof upload state
 */
function clearProofState(userId) {
    proofUploadState.delete(userId);
}

/**
 * Check if user is awaiting proof upload
 */
function isAwaitingProof(userId) {
    return proofUploadState.has(userId);
}

/**
 * Handle payment proof photo upload from customer
 * Layer 1: Auto-link bukti to specific order
 * Returns true if the photo was handled as a payment proof
 */
async function handlePaymentProof(ctx) {
    const userId = ctx.from.id;
    const orderId = proofUploadState.get(userId);

    if (!orderId) return false;

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    // Get the highest resolution photo
    const photos = ctx.message.photo;
    const bestPhoto = photos[photos.length - 1];
    const fileId = bestPhoto.file_id;

    // Fetch the specific order atomically
    const order = await db.getTransaction(orderId);

    if (!order) {
        proofUploadState.delete(userId);
        return false;
    }

    // Layer 3: prevent overwriting existing proof
    if (order.paymentProof) {
        const msg = lang === 'ms'
            ? `⚠️ Order \`${orderId}\` sudah ada bukti pembayaran.`
            : `⚠️ Order \`${orderId}\` already has payment proof.`;
        await ctx.reply(msg, { parse_mode: 'Markdown' });
        proofUploadState.delete(userId);
        return true;
    }

    // ATOMIC UPDATE — no more full table overwrite
    await db.updateTransaction(orderId, {
        paymentProof: fileId,
        status: 'awaiting_verification',
        proofUploadedAt: new Date().toISOString()
    });

    // Clear state
    proofUploadState.delete(userId);

    // Confirm to customer
    const confirmMsg = lang === 'ms'
        ? `✅ *Bukti Pembayaran Diterima!*\n\n` +
        `🆔 Order: \`${orderId}\`\n` +
        `📸 Bukti pembayaran anda telah dimuat naik.\n\n` +
        `⏳ Admin sedang menyemak pembayaran anda.\n` +
        `Kami akan maklumkan anda selepas sahkan.`
        : `✅ *Payment Proof Received!*\n\n` +
        `🆔 Order: \`${orderId}\`\n` +
        `📸 Your payment proof has been uploaded.\n\n` +
        `⏳ Admin is reviewing your payment.\n` +
        `We will notify you once verified.`;

    await ctx.reply(confirmMsg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback(
                lang === 'ms' ? '📦 Lihat Pesanan Saya' : '📦 View My Orders',
                'my_orders'
            )],
            [Markup.button.callback(
                lang === 'ms' ? '🏠 Menu Utama' : '🏠 Main Menu',
                'main_menu'
            )]
        ])
    });

    // Layer 2: Enhanced admin notification with order summary
    try {
        const admins = await db.getAdmins();
        const allAdmins = [admins.owner, ...admins.admins].filter(Boolean);
        const productName = typeof order.productName === 'object'
            ? (order.productName.ms || Object.values(order.productName)[0])
            : order.productName;

        // Fetch ALL orders from this customer to show summary
        const allTransactions = await db.getTransactions();
        const customerOrders = allTransactions.filter(t => t.userId === userId);
        const pendingNoProof = customerOrders.filter(t =>
            t.status === 'pending' && !t.paymentProof
        );
        const awaitingVerify = customerOrders.filter(t =>
            t.status === 'awaiting_verification'
        );

        // Build order summary for admin
        let orderSummary = `\n\n📋 *Ringkasan Customer:*\n`;
        customerOrders.forEach(o => {
            const pName = typeof o.productName === 'object'
                ? (o.productName.ms || Object.values(o.productName)[0])
                : o.productName;
            const statusIcon = o.paymentProof ? '✅' : '❌';
            const statusLabel = {
                'pending': 'Belum Bayar',
                'awaiting_verification': 'Menunggu Verify',
                'completed': 'Selesai',
                'rejected': 'Ditolak'
            }[o.status] || o.status;
            orderSummary += `${statusIcon} \`${o.id}\` — ${pName} (RM${o.price}) [${statusLabel}]\n`;
        });

        if (pendingNoProof.length > 0) {
            orderSummary += `\n⚠️ *${pendingNoProof.length} order belum ada bukti bayaran!*`;
        }

        const adminMsg =
            `💳 *Bukti Pembayaran Diterima*\n\n` +
            `🆔 Order: \`${orderId}\`\n` +
            `👤 Customer: ${userId} (@${ctx.from.username || 'N/A'})\n` +
            `📦 Produk: ${productName}\n` +
            `💰 Jumlah: RM${order.price}\n` +
            `📸 Bukti pembayaran di atas ⬆️` +
            orderSummary;

        const buttons = Markup.inlineKeyboard([
            [Markup.button.callback(`✅ Verify ${orderId}`, `verify_order_${orderId}`)],
            [Markup.button.callback(`❌ Reject ${orderId}`, `reject_order_${orderId}`)]
        ]);

        for (const adminId of allAdmins) {
            try {
                await ctx.telegram.sendPhoto(adminId, fileId, {
                    caption: adminMsg,
                    parse_mode: 'Markdown',
                    ...buttons
                });
            } catch (notifyError) {
                console.error(`Failed to notify admin ${adminId}:`, notifyError.message);
            }
        }
    } catch (error) {
        console.error('Error notifying admins about payment proof:', error.message);
    }

    return true;
}

/**
 * Handle "Upload Proof" button from My Orders view
 * Layer 1: If customer has multiple pending orders, show selection
 */
async function handleUploadProofPrompt(ctx, orderId) {
    const userId = ctx.from.id;
    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    // If orderId is 'select', show pending orders for selection
    if (orderId === 'select') {
        const allTransactions = await db.getTransactions();
        const pendingOrders = allTransactions.filter(t =>
            t.userId === userId &&
            (t.status === 'pending' || t.status === 'awaiting_verification') &&
            !t.paymentProof
        );

        if (pendingOrders.length === 0) {
            await ctx.reply(
                lang === 'ms' ? '✅ Semua order sudah ada bukti pembayaran!' : '✅ All orders already have payment proof!',
                { parse_mode: 'Markdown' }
            );
            return;
        }

        if (pendingOrders.length === 1) {
            // Only 1 order — auto-select
            return handleUploadProofPrompt(ctx, pendingOrders[0].id);
        }

        // Multiple orders — let customer choose
        const msg = lang === 'ms'
            ? `📋 *Pilih Order untuk Muat Naik Bukti*\n\nAnda ada ${pendingOrders.length} order yang belum ada bukti:\n`
            : `📋 *Select Order for Proof Upload*\n\nYou have ${pendingOrders.length} orders without proof:\n`;

        const buttons = pendingOrders.map(o => {
            const pName = typeof o.productName === 'object'
                ? (o.productName.ms || Object.values(o.productName)[0])
                : o.productName;
            return [Markup.button.callback(
                `${o.id} — ${pName} (RM${o.price})`,
                `uploadproof_${o.id}`
            )];
        });

        buttons.push([Markup.button.callback(
            lang === 'ms' ? '🏠 Menu Utama' : '🏠 Main Menu',
            'main_menu'
        )]);

        await ctx.reply(msg, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
        return;
    }

    // Specific order selected
    const order = await db.getTransaction(orderId);

    if (!order || order.userId !== userId) {
        await ctx.answerCbQuery(lang === 'ms' ? 'Pesanan tidak dijumpai' : 'Order not found');
        return;
    }

    if (order.paymentProof) {
        await ctx.answerCbQuery(lang === 'ms' ? 'Bukti sudah dimuat naik' : 'Proof already uploaded');
        return;
    }

    // Set awaiting proof state for this specific order
    proofUploadState.set(userId, orderId);

    const productName = typeof order.productName === 'object'
        ? (order.productName.ms || Object.values(order.productName)[0])
        : order.productName;

    const promptMsg = lang === 'ms'
        ? `📸 *Muat Naik Bukti Pembayaran*\n\n` +
        `🆔 Order: \`${orderId}\`\n` +
        `📦 Produk: ${productName}\n` +
        `💰 Jumlah: RM${order.price}\n\n` +
        `📷 Sila hantar tangkap skrin/gambar resit pembayaran anda sekarang.\n\n` +
        `_Hantar gambar untuk bukti pembayaran._`
        : `📸 *Upload Payment Proof*\n\n` +
        `🆔 Order: \`${orderId}\`\n` +
        `📦 Product: ${productName}\n` +
        `💰 Amount: RM${order.price}\n\n` +
        `📷 Please send a screenshot/photo of your payment receipt now.\n\n` +
        `_Send a photo as payment proof._`;

    await ctx.reply(promptMsg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback(
                lang === 'ms' ? '❌ Langkau' : '❌ Skip',
                `skipproof_${orderId}`
            )]
        ])
    });
}

/**
 * Handle skip proof button
 */
async function handleSkipProof(ctx, orderId) {
    const userId = ctx.from.id;
    proofUploadState.delete(userId);

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    const msg = lang === 'ms'
        ? `⏭️ Muat naik bukti dilangkau.\n\n💬 Anda boleh chat dengan admin menggunakan butang "Support" untuk hantar bukti pembayaran.\n\n💡 Atau guna \`/send ${orderId}\` untuk hantar bukti kemudian.`
        : `⏭️ Proof upload skipped.\n\nYou can chat with admin using the "Support" button to send payment proof.\n\n💡 Or use \`/send ${orderId}\` to submit proof later.`;

    await ctx.reply(msg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback(
                lang === 'ms' ? '💬 Chat Admin' : '💬 Chat Admin',
                'support'
            )],
            [Markup.button.callback(
                lang === 'ms' ? '🏠 Menu Utama' : '🏠 Main Menu',
                'main_menu'
            )]
        ])
    });
}

module.exports = {
    setAwaitingProof,
    clearProofState,
    isAwaitingProof,
    handlePaymentProof,
    handleUploadProofPrompt,
    handleSkipProof
};
