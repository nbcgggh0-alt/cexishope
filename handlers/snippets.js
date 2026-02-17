const db = require('../utils/database');
const { Markup } = require('telegraf');

async function isAdmin(userId) {
    const admins = await db.getAdmins();
    return admins.owner === userId || admins.admins.includes(userId);
}

/**
 * /addsnippet [name] [content]
 * Example: /addsnippet bank Akaun Bank: 1234567890 (Maybank)
 */
async function handleAddSnippet(ctx) {
    const userId = ctx.from.id;

    if (!await isAdmin(userId)) {
        return; // Silent fail
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 3) {
        await ctx.reply('⚠️ Invalid format. Use:\n`/addsnippet [name] [content]`\n\nExample: `/addsnippet bank Akaun: 1234567890`', { parse_mode: 'Markdown' });
        return;
    }

    const snippetName = args[1].toLowerCase();
    const snippetContent = args.slice(2).join(' ');

    try {
        const snippets = await db.getAll('cexi_snippets');
        const existing = snippets.find(s => s.name === snippetName);

        if (existing) {
            await ctx.reply(`⚠️ Snippet \`${snippetName}\` already exists. Use \`/delsnippet ${snippetName}\` to delete it first.`, { parse_mode: 'Markdown' });
            return;
        }

        // Insert new snippet
        const { error } = await require('../utils/supabase').from('cexi_snippets').insert({
            name: snippetName,
            content: snippetContent,
            created_by: userId
        });

        if (error) throw error;

        await ctx.reply(`✅ Snippet \`${snippetName}\` saved!\n\nUse: \`/s ${snippetName}\``, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Failed to save snippet:', error);
        await ctx.reply('❌ Failed to save snippet.');
    }
}

/**
 * /delsnippet [name]
 */
async function handleDelSnippet(ctx) {
    const userId = ctx.from.id;

    if (!await isAdmin(userId)) {
        return;
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        await ctx.reply('⚠️ Invalid format. Use:\n`/delsnippet [name]`', { parse_mode: 'Markdown' });
        return;
    }

    const snippetName = args[1].toLowerCase();

    try {
        const { error } = await require('../utils/supabase').from('cexi_snippets').delete().eq('name', snippetName);

        if (error) throw error;

        await ctx.reply(`✅ Snippet \`${snippetName}\` deleted.`, { parse_mode: 'Markdown' });
    } catch (error) {
        console.error('Failed to delete snippet:', error);
        await ctx.reply('❌ Failed to delete snippet.');
    }
}

/**
 * /s [name]
 * Sends the snippet content into current chat
 */
async function handleSnippet(ctx) {
    const userId = ctx.from.id;

    if (!await isAdmin(userId)) {
        return;
    }

    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        // Show all snippets
        try {
            const snippets = await db.getAll('cexi_snippets');
            if (snippets.length === 0) {
                await ctx.reply('📦 No snippets saved yet. Add one with `/addsnippet [name] [content]`', { parse_mode: 'Markdown' });
                return;
            }

            let list = '📦 *Available Snippets:*\n\n';
            snippets.forEach(s => {
                list += `• \`${s.name}\` - ${s.content.substring(0, 30)}...\n`;
            });
            list += `\n💡 Use: \`/s [name]\``;

            await ctx.reply(list, { parse_mode: 'Markdown' });
        } catch (error) {
            console.error('Failed to list snippets:', error);
            await ctx.reply('❌ Failed to list snippets.');
        }
        return;
    }

    const snippetName = args[1].toLowerCase();

    try {
        const snippets = await db.getAll('cexi_snippets');
        const snippet = snippets.find(s => s.name === snippetName);

        if (!snippet) {
            await ctx.reply(`❌ Snippet \`${snippetName}\` not found. Use \`/s\` to see all.`, { parse_mode: 'Markdown' });
            return;
        }

        // Send snippet content
        await ctx.reply(snippet.content);
    } catch (error) {
        console.error('Failed to send snippet:', error);
        await ctx.reply('❌ Failed to send snippet.');
    }
}

async function handleQuickReplyList(ctx, token) {
    const userId = ctx.from.id;
    if (!await isAdmin(userId)) return;

    try {
        const snippets = await db.getAll('cexi_snippets');
        if (snippets.length === 0) {
            await ctx.answerCbQuery('No snippets found. Add with /addsnippet');
            return;
        }

        const buttons = snippets.map(s => [
            Markup.button.callback(`📝 ${s.name}`, `use_snippet_${token}_${s.name}`)
        ]);

        buttons.push([Markup.button.callback('🔙 Back', `active_session_${token}`)]);

        await ctx.editMessageText('🤖 *Select a Quick Reply:*', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard(buttons)
        });
    } catch (error) {
        console.error('Failed to list quick replies:', error);
        await ctx.answerCbQuery('Error loading snippets');
    }
}

async function handleUseSnippet(ctx, token, snippetName) {
    const userId = ctx.from.id;
    if (!await isAdmin(userId)) return;

    try {
        const snippets = await db.getAll('cexi_snippets');
        const snippet = snippets.find(s => s.name === snippetName);

        if (!snippet) {
            await ctx.answerCbQuery('Snippet not found');
            return;
        }

        const session = await db.getSession(token);
        if (!session) {
            await ctx.answerCbQuery('Session not found');
            return;
        }

        // Send to User
        await ctx.telegram.sendMessage(session.userId, snippet.content);

        // Log to DB
        await db.addSessionMessage(token, {
            from: 'admin',
            type: 'text',
            text: snippet.content,
            timestamp: new Date().toISOString()
        });

        await ctx.answerCbQuery(`Sent: ${snippetName}`);

        // Return to session view
        const { handleSetActiveSession } = require('./session');
        await handleSetActiveSession(ctx, token);

    } catch (error) {
        console.error('Failed to send quick reply:', error);
        await ctx.answerCbQuery('Failed to send message');
    }
}

module.exports = {
    handleAddSnippet,
    handleDelSnippet,
    handleSnippet,
    handleQuickReplyList,
    handleUseSnippet
};
