const db = require('./database');

/**
 * Auto-cancel expired pending orders.
 * Orders that have been 'pending' for more than the configured hours
 * will be automatically cancelled.
 */

const DEFAULT_EXPIRY_HOURS = 24; // default: cancel after 24 hours

async function cancelExpiredOrders(bot) {
    try {
        const settings = await db.getSettings();
        const expiryHours = settings.orderExpiryHours || DEFAULT_EXPIRY_HOURS;
        const cutoff = new Date(Date.now() - expiryHours * 60 * 60 * 1000).toISOString();

        const transactions = await db.getTransactions();
        const expired = transactions.filter(t =>
            t.status === 'pending' &&
            !t.paymentProof &&
            t.createdAt &&
            t.createdAt < cutoff
        );

        if (expired.length === 0) return 0;

        let cancelledCount = 0;

        for (const order of expired) {
            await db.updateTransaction(order.id, {
                status: 'expired',
                expiredAt: new Date().toISOString()
            });
            cancelledCount++;

            // Notify customer
            if (bot && order.userId) {
                try {
                    await bot.telegram.sendMessage(
                        order.userId,
                        `⏰ *Pesanan Tamat Tempoh / Order Expired*\n\n` +
                        `🆔 Order: \`${order.id}\`\n` +
                        `📦 Produk: ${typeof order.productName === 'object' ? (order.productName.ms || Object.values(order.productName)[0]) : order.productName}\n` +
                        `💰 RM${order.price}\n\n` +
                        `Order ini telah dibatalkan kerana tiada pembayaran dalam ${expiryHours} jam.\n` +
                        `This order was cancelled due to no payment within ${expiryHours} hours.\n\n` +
                        `💡 Sila buat pesanan baru jika masih berminat.`,
                        { parse_mode: 'Markdown' }
                    );
                } catch (notifyErr) {
                    // Customer may have blocked the bot
                    console.error(`Failed to notify user ${order.userId} about expired order:`, notifyErr.message);
                }
            }
        }

        if (cancelledCount > 0) {
            console.log(`[OrderExpiry] Auto-cancelled ${cancelledCount} expired orders (>${expiryHours}h old)`);
        }

        return cancelledCount;
    } catch (error) {
        console.error('[OrderExpiry] Error in cancelExpiredOrders:', error.message);
        return 0;
    }
}

/**
 * Start the background interval that checks for expired orders.
 * Runs every 30 minutes.
 */
let expiryInterval = null;

function startOrderExpiryJob(bot) {
    const CHECK_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

    // Run once on startup
    cancelExpiredOrders(bot).then(count => {
        if (count > 0) console.log(`[OrderExpiry] Startup cleanup: ${count} orders expired`);
    });

    // Schedule recurring check
    expiryInterval = setInterval(() => {
        cancelExpiredOrders(bot).catch(err => {
            console.error('[OrderExpiry] Interval error:', err.message);
        });
    }, CHECK_INTERVAL_MS);

    console.log('[OrderExpiry] Background job started (checks every 30 min)');
}

function stopOrderExpiryJob() {
    if (expiryInterval) {
        clearInterval(expiryInterval);
        expiryInterval = null;
        console.log('[OrderExpiry] Background job stopped');
    }
}

module.exports = {
    cancelExpiredOrders,
    startOrderExpiryJob,
    stopOrderExpiryJob
};
