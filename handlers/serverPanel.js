const { Markup } = require('telegraf');
const db = require('../utils/database');
const ptero = require('../utils/pteroAPI');
const { t } = require('../utils/translations');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwner } = require('./owner');

// ─── Main Server Panel ───────────────────────────────────────
async function handleServerPanel(ctx) {
    const userId = ctx.from.id;
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('❌ Owner only');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';
    const panels = await db.getPteroPanels();

    let text = lang === 'ms'
        ? '🖥️ *Panel Server Pterodactyl*\n\n'
        : '🖥️ *Pterodactyl Server Panel*\n\n';

    if (panels.length === 0) {
        text += lang === 'ms'
            ? 'Tiada panel ditambah lagi.\nTekan butang di bawah untuk tambah panel.'
            : 'No panels added yet.\nTap the button below to add a panel.';
    } else {
        panels.forEach((p, i) => {
            const statusIcon = p.status === 'active' ? '🟢' : p.status === 'offline' ? '🔴' : '🟡';
            const primaryLabel = p.isPrimary ? ' ⭐' : '';
            text += `${statusIcon} *${p.name}*${primaryLabel}\n`;
            text += `   🌐 ${p.domain}\n`;
            text += `   📋 Server: ${p.serverId || 'None'}\n\n`;
        });
    }

    const buttons = [];
    panels.forEach(p => {
        buttons.push([Markup.button.callback(
            `${p.isPrimary ? '⭐ ' : ''}${p.name} — ${p.status}`,
            `ptero_view_${p.id}`
        )]);
    });

    buttons.push([Markup.button.callback(lang === 'ms' ? '➕ Tambah Panel' : '➕ Add Panel', 'ptero_add')]);
    if (panels.length > 0) {
        buttons.push([Markup.button.callback(lang === 'ms' ? '🔍 Health Check Semua' : '🔍 Health Check All', 'ptero_healthcheck')]);
    }
    buttons.push([Markup.button.callback(t('btnBack', lang), 'owner_panel')]);

    try { await ctx.answerCbQuery(); } catch (e) { /* ignore */ }
    await safeEditMessage(ctx, text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
    });
}

// ─── View Panel Detail ───────────────────────────────────────
async function handleViewPanel(ctx, panelId) {
    const userId = ctx.from.id;
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('❌ Owner only');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';
    const panels = await db.getPteroPanels();
    const panel = panels.find(p => p.id === parseInt(panelId));

    if (!panel) {
        await ctx.answerCbQuery(lang === 'ms' ? 'Panel tidak dijumpai' : 'Panel not found');
        return;
    }

    const statusIcon = panel.status === 'active' ? '🟢' : panel.status === 'offline' ? '🔴' : '🟡';

    let text = `🖥️ *${panel.name}*\n\n`;
    text += `${statusIcon} Status: ${panel.status}\n`;
    text += `🌐 Domain: ${panel.domain}\n`;
    text += `🔑 PTLA: ${panel.apiKeyApp ? '✅ Set' : '❌ Not set'}\n`;
    text += `🔑 PTLC: ${panel.apiKeyClient ? '✅ Set' : '❌ Not set'}\n`;
    text += `📋 Server ID: ${panel.serverId || 'None'}\n`;
    text += `⭐ Primary: ${panel.isPrimary ? 'Yes' : 'No'}\n`;

    // Try to get live server status
    if (panel.serverIdentifier) {
        const status = await ptero.getServerStatus(panel);
        if (status.success) {
            const state = status.data.current_state;
            const stateIcon = state === 'running' ? '🟢' : state === 'starting' ? '🟡' : '🔴';
            text += `\n⚡ *Live Status:* ${stateIcon} ${state}`;
            if (status.data.resources) {
                const res = status.data.resources;
                const memMB = (res.memory_bytes / 1024 / 1024).toFixed(0);
                const cpuPct = res.cpu_absolute?.toFixed(1) || '0';
                text += `\n💾 RAM: ${memMB} MB | ⚙️ CPU: ${cpuPct}%`;
            }
        } else {
            text += `\n⚡ *Live Status:* ❌ Cannot reach`;
        }
    }

    await ctx.answerCbQuery();

    const buttons = [];
    if (panel.serverIdentifier) {
        buttons.push([
            Markup.button.callback('▶️ Start', `ptero_power_${panel.id}_start`),
            Markup.button.callback('⏹️ Stop', `ptero_power_${panel.id}_stop`),
            Markup.button.callback('🔄 Restart', `ptero_power_${panel.id}_restart`)
        ]);
    }
    if (!panel.serverId) {
        buttons.push([Markup.button.callback(lang === 'ms' ? '🚀 Buat Server' : '🚀 Create Server', `ptero_create_${panel.id}`)]);
    }
    if (!panel.isPrimary) {
        buttons.push([Markup.button.callback(lang === 'ms' ? '⭐ Set Primary' : '⭐ Set Primary', `ptero_primary_${panel.id}`)]);
    }
    buttons.push([Markup.button.callback(lang === 'ms' ? '🗑️ Padam Panel' : '🗑️ Delete Panel', `ptero_delete_${panel.id}`)]);
    buttons.push([Markup.button.callback(t('btnBack', lang), 'server_panel')]);

    await safeEditMessage(ctx, text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
    });
}

// ─── Power Control ───────────────────────────────────────────
async function handleServerPower(ctx, panelId, action) {
    const userId = ctx.from.id;
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('❌ Owner only');
        return;
    }

    const panels = await db.getPteroPanels();
    const panel = panels.find(p => p.id === parseInt(panelId));
    if (!panel) {
        await ctx.answerCbQuery('Panel not found');
        return;
    }

    await ctx.answerCbQuery(`⏳ Sending ${action}...`);

    const result = await ptero.sendPowerAction(panel, action);

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    if (result.success) {
        const newStatus = action === 'stop' ? 'standby' : 'active';
        await db.updatePteroPanel(panel.id, { status: newStatus });

        await ctx.reply(
            lang === 'ms'
                ? `✅ *${panel.name}* — ${action} berjaya!`
                : `✅ *${panel.name}* — ${action} successful!`,
            { parse_mode: 'Markdown' }
        );
    } else {
        await ctx.reply(
            `❌ *${panel.name}* — ${action} failed:\n${result.error}`,
            { parse_mode: 'Markdown' }
        );
    }
}

// ─── Create Server ───────────────────────────────────────────
async function handleCreateServer(ctx, panelId) {
    const userId = ctx.from.id;
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('❌ Owner only');
        return;
    }

    const panels = await db.getPteroPanels();
    const panel = panels.find(p => p.id === parseInt(panelId));
    if (!panel) {
        await ctx.answerCbQuery('Panel not found');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    await ctx.answerCbQuery('⏳ Creating server...');
    await ctx.reply(
        lang === 'ms'
            ? `⏳ Sedang membuat server di *${panel.name}*...\nNest: 5 | Egg: 15 | Startup: npm start`
            : `⏳ Creating server on *${panel.name}*...\nNest: 5 | Egg: 15 | Startup: npm start`,
        { parse_mode: 'Markdown' }
    );

    const result = await ptero.createServer(panel, {
        name: `CexiBot-${panel.name}`,
        egg: 15,
        startup: 'npm start'
    });

    if (result.success) {
        await db.updatePteroPanel(panel.id, {
            serverId: String(result.serverId),
            serverIdentifier: result.identifier,
            status: 'standby'
        });

        await ctx.reply(
            lang === 'ms'
                ? `✅ *Server Berjaya Dibuat!*\n\n🖥️ Panel: ${panel.name}\n📋 Server ID: ${result.serverId}\n🔑 Identifier: ${result.identifier}\n📦 Name: ${result.name}\n\n_Tekan Start untuk mulakan server._`
                : `✅ *Server Created Successfully!*\n\n🖥️ Panel: ${panel.name}\n📋 Server ID: ${result.serverId}\n🔑 Identifier: ${result.identifier}\n📦 Name: ${result.name}\n\n_Press Start to launch the server._`,
            {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('▶️ Start Server', `ptero_power_${panel.id}_start`)],
                    [Markup.button.callback('🔙 Back', `ptero_view_${panel.id}`)]
                ])
            }
        );
    } else {
        await ctx.reply(
            `❌ *Server creation failed:*\n${result.error}`,
            { parse_mode: 'Markdown' }
        );
    }
}

// ─── Set Primary ─────────────────────────────────────────────
async function handleSetPrimary(ctx, panelId) {
    const userId = ctx.from.id;
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('❌ Owner only');
        return;
    }

    const panels = await db.getPteroPanels();

    // Unset current primary
    for (const p of panels) {
        if (p.isPrimary) {
            await db.updatePteroPanel(p.id, { isPrimary: false });
        }
    }

    // Set new primary
    await db.updatePteroPanel(parseInt(panelId), { isPrimary: true });

    await ctx.answerCbQuery('⭐ Primary set!');
    await handleViewPanel(ctx, panelId);
}

// ─── Delete Panel ────────────────────────────────────────────
async function handleDeletePanel(ctx, panelId) {
    const userId = ctx.from.id;
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('❌ Owner only');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    await ctx.answerCbQuery();
    await safeEditMessage(ctx,
        lang === 'ms'
            ? '⚠️ *Pasti nak padam panel ini?*\n\nData panel akan dipadam. Server di Pterodactyl tidak akan dipadam.'
            : '⚠️ *Are you sure you want to delete this panel?*\n\nPanel data will be removed. The Pterodactyl server itself will NOT be deleted.',
        {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [Markup.button.callback(lang === 'ms' ? '✅ Ya, Padam' : '✅ Yes, Delete', `ptero_confirmdelete_${panelId}`)],
                [Markup.button.callback(lang === 'ms' ? '❌ Batal' : '❌ Cancel', `ptero_view_${panelId}`)]
            ])
        }
    );
}

async function handleConfirmDeletePanel(ctx, panelId) {
    const userId = ctx.from.id;
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('❌ Owner only');
        return;
    }

    await db.deletePteroPanel(parseInt(panelId));
    await ctx.answerCbQuery('✅ Panel deleted');
    await handleServerPanel(ctx);
}

// ─── Health Check All Panels ─────────────────────────────────
async function handleHealthCheck(ctx) {
    const userId = ctx.from.id;
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('❌ Owner only');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';
    const panels = await db.getPteroPanels();

    await ctx.answerCbQuery('⏳ Checking...');

    const results = await ptero.checkAllPanels(panels);

    let text = lang === 'ms'
        ? '🔍 *Health Check — Semua Panel*\n\n'
        : '🔍 *Health Check — All Panels*\n\n';

    for (const r of results) {
        const icon = r.healthy ? '🟢' : '🔴';
        text += `${icon} *${r.panel.name}*`;
        if (r.state) text += ` — ${r.state}`;
        if (r.reason) text += ` — ${r.reason}`;
        text += '\n';

        // Update panel status in DB
        const newStatus = r.healthy ? 'active' : 'offline';
        await db.updatePteroPanel(r.panel.id, { status: newStatus });
    }

    // Try auto-failover
    const failoverResult = await ptero.autoFailover(panels, db);
    if (failoverResult) {
        text += lang === 'ms'
            ? `\n⚡ *Auto-Failover:* Beralih ke *${failoverResult.name}*`
            : `\n⚡ *Auto-Failover:* Switched to *${failoverResult.name}*`;
    }

    await safeEditMessage(ctx, text, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback(t('btnBack', lang), 'server_panel')]
        ])
    });
}

// ─── Add Panel Flow (triggered from adminFlows) ──────────────
async function handleAddPanelStart(ctx) {
    const userId = ctx.from.id;
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('❌ Owner only');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    // Use adminFlows state
    const { setAdminFlow } = require('./adminFlows');
    const panels = await db.getPteroPanels();
    const panelNum = panels.length + 1;

    setAdminFlow(userId, 'ptero_add_domain', { name: `Panel ${panelNum}` });

    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? `🖥️ *Tambah Panel Baru — Panel ${panelNum}*\n\n🌐 Masukkan domain panel:\n\n_Contoh: https://panel.example.com_`
            : `🖥️ *Add New Panel — Panel ${panelNum}*\n\n🌐 Enter panel domain:\n\n_Example: https://panel.example.com_`,
        { parse_mode: 'Markdown' }
    );
}

// Process flow inputs (called from adminFlows)
async function processPteroFlowInput(ctx, state, text, lang) {
    const userId = ctx.from.id;
    const { setAdminFlow, clearAdminFlow } = require('./adminFlows');

    switch (state.flow) {
        case 'ptero_add_domain': {
            let domain = text.trim();
            if (!domain.startsWith('http')) domain = 'https://' + domain;
            domain = domain.replace(/\/$/, '');

            state.data.domain = domain;
            setAdminFlow(userId, 'ptero_add_ptla', state.data);
            await ctx.reply(
                lang === 'ms'
                    ? `✅ Domain: ${domain}\n\n🔑 Masukkan API Key Application (PTLA):\n\n_Key bermula dengan ptla\\_ ..._`
                    : `✅ Domain: ${domain}\n\n🔑 Enter Application API Key (PTLA):\n\n_Key starts with ptla\\_ ..._`,
                { parse_mode: 'Markdown' }
            );
            return true;
        }

        case 'ptero_add_ptla': {
            state.data.apiKeyApp = text.trim();
            setAdminFlow(userId, 'ptero_add_ptlc', state.data);
            await ctx.reply(
                lang === 'ms'
                    ? '✅ PTLA disimpan.\n\n🔑 Masukkan API Key Client (PTLC):\n\n_Key bermula dengan ptlc\\_ ..._'
                    : '✅ PTLA saved.\n\n🔑 Enter Client API Key (PTLC):\n\n_Key starts with ptlc\\_ ..._',
                { parse_mode: 'Markdown' }
            );
            return true;
        }

        case 'ptero_add_ptlc': {
            state.data.apiKeyClient = text.trim();
            clearAdminFlow(userId);

            // Test connection before saving
            await ctx.reply(lang === 'ms' ? '⏳ Menguji sambungan...' : '⏳ Testing connection...');

            const testPanel = {
                domain: state.data.domain,
                apiKeyApp: state.data.apiKeyApp,
                apiKeyClient: state.data.apiKeyClient
            };

            const testResult = await ptero.testConnection(testPanel);

            // Save panel regardless (user can fix keys later)
            const panels = await db.getPteroPanels();
            const isFirst = panels.length === 0;

            const newPanel = await db.addPteroPanel({
                name: state.data.name,
                domain: state.data.domain,
                apiKeyApp: state.data.apiKeyApp,
                apiKeyClient: state.data.apiKeyClient,
                status: testResult.success ? 'standby' : 'offline',
                isPrimary: isFirst
            });

            if (testResult.success) {
                await ctx.reply(
                    lang === 'ms'
                        ? `✅ *Panel Berjaya Ditambah!*\n\n🖥️ ${state.data.name}\n🌐 ${state.data.domain}\n🟢 Sambungan OK\n${isFirst ? '⭐ Set sebagai Primary\n' : ''}\n_Pergi ke Server Panel untuk buat server._`
                        : `✅ *Panel Added Successfully!*\n\n🖥️ ${state.data.name}\n🌐 ${state.data.domain}\n🟢 Connection OK\n${isFirst ? '⭐ Set as Primary\n' : ''}\n_Go to Server Panel to create a server._`,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('🖥️ Server Panel', 'server_panel')],
                        ])
                    }
                );
            } else {
                await ctx.reply(
                    lang === 'ms'
                        ? `⚠️ *Panel Ditambah (Sambungan Gagal)*\n\n🖥️ ${state.data.name}\n🌐 ${state.data.domain}\n🔴 Error: ${testResult.error}\n\n_Panel disimpan. Sila semak API key anda._`
                        : `⚠️ *Panel Added (Connection Failed)*\n\n🖥️ ${state.data.name}\n🌐 ${state.data.domain}\n🔴 Error: ${testResult.error}\n\n_Panel saved. Please check your API keys._`,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('🖥️ Server Panel', 'server_panel')],
                        ])
                    }
                );
            }
            return true;
        }

        default:
            return false;
    }
}

module.exports = {
    handleServerPanel,
    handleViewPanel,
    handleServerPower,
    handleCreateServer,
    handleSetPrimary,
    handleDeletePanel,
    handleConfirmDeletePanel,
    handleHealthCheck,
    handleAddPanelStart,
    processPteroFlowInput
};
