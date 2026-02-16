/**
 * Auto-Update Handler — Owner-only /update command
 * Fetches latest files from GitHub repo and updates the bot automatically
 */
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const db = require('../utils/database');
const { isOwner } = require('./owner');

// GitHub Configuration (hardcoded)
const GITHUB_TOKEN = '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';
const GITHUB_REPO = 'nbcgggh0-alt/cexishope';
const GITHUB_BRANCH = 'main';
const BOT_DIR = path.resolve(__dirname, '..');

/**
 * Make authenticated GitHub API request
 */
function githubAPI(endpoint) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.github.com',
            path: endpoint,
            method: 'GET',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent': 'CexiStore-Bot-Updater',
                'Accept': 'application/vnd.github.v3+json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(JSON.parse(data));
                    } else {
                        reject(new Error(`GitHub API ${res.statusCode}: ${data.substring(0, 200)}`));
                    }
                } catch (e) {
                    reject(new Error(`Parse error: ${e.message}`));
                }
            });
            res.on('error', reject);
        });
        req.on('error', reject);
        req.end();
    });
}

/**
 * Download a raw file from GitHub
 */
function downloadFile(downloadUrl) {
    return new Promise((resolve, reject) => {
        const url = new URL(downloadUrl);
        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'GET',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'User-Agent': 'CexiStore-Bot-Updater',
                'Accept': 'application/vnd.github.v3.raw'
            }
        };

        const req = https.request(options, (res) => {
            // Handle redirects
            if (res.statusCode === 301 || res.statusCode === 302) {
                downloadFile(res.headers.location).then(resolve).catch(reject);
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.end();
    });
}

/**
 * Get file tree from GitHub repo
 */
async function getRepoTree() {
    const tree = await githubAPI(`/repos/${GITHUB_REPO}/git/trees/${GITHUB_BRANCH}?recursive=1`);
    return tree.tree.filter(item => item.type === 'blob'); // Only files
}

/**
 * Get latest commit info
 */
async function getLatestCommit() {
    const commits = await githubAPI(`/repos/${GITHUB_REPO}/commits?sha=${GITHUB_BRANCH}&per_page=1`);
    return commits[0];
}

/**
 * Main update handler — /update command
 */
async function handleUpdate(ctx) {
    const userId = ctx.from.id;

    // Owner only
    if (!await isOwner(userId)) {
        await ctx.reply('🚫 Only the owner can use this command.');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    // Send initial status
    const statusMsg = await ctx.reply(
        lang === 'ms'
            ? '🔄 *Memeriksa kemas kini dari GitHub...*\n\n⏳ Sila tunggu...'
            : '🔄 *Checking for updates from GitHub...*\n\n⏳ Please wait...',
        { parse_mode: 'Markdown' }
    );

    try {
        // Try git pull first (fastest method)
        let useGit = false;
        try {
            // Check if git is available and we're in a git repo
            execSync('git --version', { cwd: BOT_DIR, timeout: 5000, encoding: 'utf8' });

            // Check if it's a git repo
            const isGitRepo = fs.existsSync(path.join(BOT_DIR, '.git'));

            if (isGitRepo) {
                useGit = true;
            } else {
                // Initialize git and set remote
                execSync(`git init`, { cwd: BOT_DIR, timeout: 10000 });
                execSync(`git remote add origin https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git`, { cwd: BOT_DIR, timeout: 5000 });
                useGit = true;
            }
        } catch (e) {
            useGit = false;
        }

        if (useGit) {
            // ── Git Pull Method ──────────────────────
            await ctx.telegram.editMessageText(
                ctx.chat.id, statusMsg.message_id, null,
                lang === 'ms'
                    ? '🔄 *Mengemas kini menggunakan Git Pull...*\n\n⏳ Memuat turun fail terbaru...'
                    : '🔄 *Updating via Git Pull...*\n\n⏳ Downloading latest files...',
                { parse_mode: 'Markdown' }
            );

            try {
                // Set remote URL with token
                try {
                    execSync(`git remote set-url origin https://${GITHUB_TOKEN}@github.com/${GITHUB_REPO}.git`, { cwd: BOT_DIR, timeout: 5000 });
                } catch (e) { /* ignore if remote doesn't exist yet */ }

                // Fetch and reset to latest
                const fetchOutput = execSync(`git fetch origin ${GITHUB_BRANCH} --force`, { cwd: BOT_DIR, timeout: 30000, encoding: 'utf8' });
                const resetOutput = execSync(`git reset --hard origin/${GITHUB_BRANCH}`, { cwd: BOT_DIR, timeout: 15000, encoding: 'utf8' });

                // Get latest commit
                const logOutput = execSync('git log -1 --pretty=format:"%h - %s (%cr)"', { cwd: BOT_DIR, timeout: 5000, encoding: 'utf8' });

                // Count changed files
                let changedFiles = 'N/A';
                try {
                    changedFiles = execSync('git diff --stat HEAD~1 HEAD --name-only 2>/dev/null | wc -l', { cwd: BOT_DIR, timeout: 5000, encoding: 'utf8' }).trim();
                } catch (e) { changedFiles = 'Unknown'; }

                await ctx.telegram.editMessageText(
                    ctx.chat.id, statusMsg.message_id, null,
                    lang === 'ms'
                        ? `✅ *Kemas Kini Berjaya!* (Git Pull)\n\n` +
                        `📦 Commit: \`${logOutput}\`\n\n` +
                        `🔄 *Bot perlu dimulakan semula untuk perubahan berkuat kuasa.*\n\n` +
                        `_Gunakan butang di bawah untuk restart:_`
                        : `✅ *Update Successful!* (Git Pull)\n\n` +
                        `📦 Commit: \`${logOutput}\`\n\n` +
                        `🔄 *Bot needs to restart for changes to take effect.*\n\n` +
                        `_Use the button below to restart:_`,
                    {
                        parse_mode: 'Markdown',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '🔄 Restart Bot', callback_data: 'update_restart' }],
                                [{ text: lang === 'ms' ? '🔙 Kembali' : '🔙 Back', callback_data: 'owner_panel' }]
                            ]
                        }
                    }
                );
                return;
            } catch (gitErr) {
                console.error('Git pull failed, falling back to API method:', gitErr.message);
                // Fall through to API method
            }
        }

        // ── GitHub API Method (fallback) ──────────
        await ctx.telegram.editMessageText(
            ctx.chat.id, statusMsg.message_id, null,
            lang === 'ms'
                ? '🔄 *Mengemas kini menggunakan GitHub API...*\n\n⏳ Memuat turun fail...'
                : '🔄 *Updating via GitHub API...*\n\n⏳ Downloading files...',
            { parse_mode: 'Markdown' }
        );

        // Get latest commit
        const latestCommit = await getLatestCommit();
        const commitMsg = latestCommit.commit.message.split('\n')[0];
        const commitSha = latestCommit.sha.substring(0, 7);

        // Get file tree
        const files = await getRepoTree();

        // Filter files (skip .git, node_modules, .env)
        const skipPatterns = ['.git/', 'node_modules/', '.env', '.DS_Store'];
        const filesToUpdate = files.filter(f => {
            return !skipPatterns.some(skip => f.path.startsWith(skip) || f.path === skip);
        });

        let updated = 0;
        let skipped = 0;
        let errors = 0;

        // Download and update each file
        for (const file of filesToUpdate) {
            try {
                const content = await downloadFile(
                    `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${file.path}`
                );

                const filePath = path.join(BOT_DIR, file.path);
                const dirPath = path.dirname(filePath);

                // Create directory if needed
                if (!fs.existsSync(dirPath)) {
                    fs.mkdirSync(dirPath, { recursive: true });
                }

                // Check if file has changed
                let hasChanged = true;
                if (fs.existsSync(filePath)) {
                    const existing = fs.readFileSync(filePath, 'utf8');
                    if (existing === content) {
                        hasChanged = false;
                        skipped++;
                    }
                }

                if (hasChanged) {
                    fs.writeFileSync(filePath, content, 'utf8');
                    updated++;
                }
            } catch (fileErr) {
                console.error(`Error updating ${file.path}:`, fileErr.message);
                errors++;
            }
        }

        await ctx.telegram.editMessageText(
            ctx.chat.id, statusMsg.message_id, null,
            lang === 'ms'
                ? `✅ *Kemas Kini Berjaya!* (API)\n\n` +
                `📦 Commit: \`${commitSha}\` - ${commitMsg}\n\n` +
                `📊 *Keputusan:*\n` +
                `✅ Dikemas kini: ${updated} fail\n` +
                `⏭️ Tiada perubahan: ${skipped} fail\n` +
                (errors > 0 ? `❌ Ralat: ${errors} fail\n` : '') +
                `\n🔄 *Bot perlu dimulakan semula untuk perubahan berkuat kuasa.*`
                : `✅ *Update Successful!* (API)\n\n` +
                `📦 Commit: \`${commitSha}\` - ${commitMsg}\n\n` +
                `📊 *Results:*\n` +
                `✅ Updated: ${updated} files\n` +
                `⏭️ Unchanged: ${skipped} files\n` +
                (errors > 0 ? `❌ Errors: ${errors} files\n` : '') +
                `\n🔄 *Bot needs to restart for changes to take effect.*`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Restart Bot', callback_data: 'update_restart' }],
                        [{ text: lang === 'ms' ? '🔙 Kembali' : '🔙 Back', callback_data: 'owner_panel' }]
                    ]
                }
            }
        );

    } catch (error) {
        console.error('Update error:', error);
        await ctx.telegram.editMessageText(
            ctx.chat.id, statusMsg.message_id, null,
            lang === 'ms'
                ? `❌ *Kemas Kini Gagal!*\n\n📝 Ralat: ${error.message}\n\nSila cuba lagi.`
                : `❌ *Update Failed!*\n\n📝 Error: ${error.message}\n\nPlease try again.`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔄 Try Again', callback_data: 'update_retry' }],
                        [{ text: lang === 'ms' ? '🔙 Kembali' : '🔙 Back', callback_data: 'owner_panel' }]
                    ]
                }
            }
        );
    }
}

/**
 * Restart bot after update
 */
async function handleUpdateRestart(ctx) {
    const userId = ctx.from.id;
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('🚫 Owner only');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    await ctx.answerCbQuery(lang === 'ms' ? '🔄 Memulakan semula...' : '🔄 Restarting...');
    await ctx.editMessageText(
        lang === 'ms'
            ? '🔄 *Bot sedang dimulakan semula...*\n\n⏳ Sila tunggu beberapa saat.'
            : '🔄 *Bot is restarting...*\n\n⏳ Please wait a few seconds.',
        { parse_mode: 'Markdown' }
    );

    // Try PM2 restart first, then simple process exit
    setTimeout(() => {
        try {
            execSync('pm2 restart all', { timeout: 5000 });
        } catch (e) {
            // If PM2 not available, just exit and let the process manager restart
            process.exit(0);
        }
    }, 1000);
}

/**
 * Check for updates (inline button from owner panel)
 */
async function handleCheckUpdate(ctx) {
    const userId = ctx.from.id;
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('🚫 Owner only');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    await ctx.answerCbQuery();

    try {
        const latestCommit = await getLatestCommit();
        const commitMsg = latestCommit.commit.message.split('\n')[0];
        const commitSha = latestCommit.sha.substring(0, 7);
        const commitDate = new Date(latestCommit.commit.committer.date).toLocaleString();
        const author = latestCommit.commit.author.name;

        await ctx.editMessageText(
            lang === 'ms'
                ? `📦 *Kemas Kini Tersedia*\n\n` +
                `🔖 Commit: \`${commitSha}\`\n` +
                `📝 Mesej: ${commitMsg}\n` +
                `👤 Oleh: ${author}\n` +
                `📅 Tarikh: ${commitDate}\n\n` +
                `Tekan butang untuk kemas kini:`
                : `📦 *Latest Update Available*\n\n` +
                `🔖 Commit: \`${commitSha}\`\n` +
                `📝 Message: ${commitMsg}\n` +
                `👤 By: ${author}\n` +
                `📅 Date: ${commitDate}\n\n` +
                `Press button to update:`,
            {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '⬇️ Update Now', callback_data: 'update_now' }],
                        [{ text: lang === 'ms' ? '🔙 Kembali' : '🔙 Back', callback_data: 'owner_panel' }]
                    ]
                }
            }
        );
    } catch (error) {
        await ctx.editMessageText(
            `❌ Failed to check: ${error.message}`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: lang === 'ms' ? '🔙 Kembali' : '🔙 Back', callback_data: 'owner_panel' }]
                    ]
                }
            }
        );
    }
}

module.exports = {
    handleUpdate,
    handleUpdateRestart,
    handleCheckUpdate
};
