const { Markup } = require('telegraf');
const db = require('../utils/database');
const supabase = require('../utils/supabase');
const moment = require('moment');
const config = require('../config');

// QuickChart API Base URL
const QC_URL = 'https://quickchart.io/chart';

async function handleAnalytics(ctx) {
    if (ctx.from.id.toString() !== config.OWNER_ID.toString()) return;

    const loadingMsg = await ctx.reply('⏳ *Generating Analytics Report...*\n_Crunching numbers from the database..._', { parse_mode: 'Markdown' });

    try {
        const todayStart = moment().startOf('day').toISOString();
        const monthStart = moment().startOf('month').toISOString();
        const last7DaysStart = moment().subtract(6, 'days').startOf('day').toISOString();

        // --- 1. DATA AGGREGATION ---

        // A. REVENUE & ORDERS
        const { data: transactions } = await supabase
            .from('cexi_transactions')
            .select('price, status, created_at, product_name');

        let revToday = 0;
        let revMonth = 0;
        let revTotal = 0;
        let ordersPending = 0;
        let ordersCompleted = 0;

        let salesTrend = new Array(7).fill(0); // Last 7 days
        let productCounts = {}; // For Top Products

        transactions.forEach(t => {
            const price = parseFloat(t.price) || 0;
            const isCompleted = t.status === 'completed';
            const date = moment(t.created_at);

            // Status Counts
            if (t.status === 'pending') ordersPending++;
            if (isCompleted) ordersCompleted++;

            // Revenue Calculations (Only Completed)
            if (isCompleted) {
                revTotal += price;
                if (date.isAfter(todayStart)) revToday += price;
                if (date.isAfter(monthStart)) revMonth += price;

                // Trend (Last 7 Days)
                if (date.isAfter(last7DaysStart)) {
                    const diffDays = moment().diff(date, 'days');
                    if (diffDays >= 0 && diffDays < 7) {
                        salesTrend[6 - diffDays] += price;
                    }
                }

                // Top Products
                const pName = typeof t.product_name === 'object' ? (t.product_name.en || t.product_name.ms) : t.product_name;
                const cleanName = pName || 'Unknown';
                productCounts[cleanName] = (productCounts[cleanName] || 0) + 1;
            }
        });

        // B. USERS
        const { count: totalUsers } = await supabase
            .from('cexi_users')
            .select('*', { count: 'exact', head: true });

        const { count: newUsersToday } = await supabase
            .from('cexi_users')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', todayStart);

        // --- 2. CHART GENERATION ---

        // Generate Last 7 Days Labels (e.g., "Mon", "Tue")
        const trendLabels = [];
        for (let i = 6; i >= 0; i--) {
            trendLabels.push(moment().subtract(i, 'days').format('ddd'));
        }

        // Get Top 5 Products
        const sortedProducts = Object.entries(productCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        const topProdLabels = sortedProducts.map(p => p[0].substring(0, 10) + '...');
        const topProdData = sortedProducts.map(p => p[1]);

        // Construct Chart Config
        const chartConfig = {
            type: 'bar',
            data: {
                labels: trendLabels,
                datasets: [{
                    type: 'line',
                    label: 'Revenue (RM)',
                    borderColor: '#34d399',
                    borderWidth: 2,
                    fill: false,
                    data: salesTrend,
                    yAxisID: 'y1'
                }, {
                    type: 'bar',
                    label: 'Orders',
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    data: salesTrend.map(r => r > 0 ? 1 : 0), // Simplifying order count for viz or just reuse sales
                    hidden: true // Hide orders on chart for clarity, focused on Revenue
                }]
            },
            options: {
                title: { display: true, text: 'Weekly Revenue Trend', fontColor: '#fff' },
                legend: { display: false },
                scales: {
                    xAxes: [{ ticks: { fontColor: '#cbd5e1' }, gridLines: { display: false } }],
                    yAxes: [{ id: 'y1', ticks: { fontColor: '#cbd5e1' }, gridLines: { color: 'rgba(255,255,255,0.1)' } }]
                }
            }
        };

        const chartUrl = `${QC_URL}?c=${encodeURIComponent(JSON.stringify(chartConfig))}&backgroundColor=0f172a&width=500&height=300`;

        // --- 3. REPORT MESSAGE ---

        const report = `📊 *ANALYTICS REPORT* 📊\n` +
            `📅 ${moment().format('DD MMM YYYY, HH:mm')}\n\n` +

            `💰 *REVENUE*\n` +
            `• Today: *RM${revToday.toFixed(2)}*\n` +
            `• Month: *RM${revMonth.toFixed(2)}*\n` +
            `• Total: *RM${revTotal.toFixed(2)}*\n\n` +

            `📦 *ORDERS*\n` +
            `• Pending: *${ordersPending}*\n` +
            `• Completed: *${ordersCompleted}*\n\n` +

            `👥 *USERS*\n` +
            `• New Today: *${newUsersToday || 0}*\n` +
            `• Total Users: *${totalUsers || 0}*\n\n` +

            `🏆 *TOP PRODUCT*\n` +
            `• ${sortedProducts.length > 0 ? sortedProducts[0][0] : 'N/A'}`;

        // Send Chart + Caption
        await ctx.deleteMessage(loadingMsg.message_id).catch(() => { });
        await ctx.replyWithPhoto(chartUrl, {
            caption: report,
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback('🔄 Refresh Data', 'owner_analytics')]
            ])
        });

    } catch (e) {
        console.error('Analytics Error:', e);
        await ctx.deleteMessage(loadingMsg.message_id).catch(() => { });
        await ctx.reply(`❌ Error generating report: ${e.message}`);
    }
}

module.exports = { handleAnalytics };
