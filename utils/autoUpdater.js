const { exec } = require('child_process');
const config = require('../config');
const db = require('./database');

const CHECK_INTERVAL = 300000; // 5 minutes

class AutoUpdater {
    constructor(bot) {
        this.bot = bot;
        this.interval = null;
    }

    start() {
        console.log('🔄 Auto-Updater started. Checking every 5 minutes...');
        // Initial check after 10 seconds
        setTimeout(() => this.checkUpdates(), 10000);

        this.interval = setInterval(() => this.checkUpdates(), CHECK_INTERVAL);
    }

    async checkUpdates() {
        exec('git fetch', (err, stdout, stderr) => {
            if (err) return; // Silent fail on fetch error

            exec('git status -uno', async (err, stdout, stderr) => {
                if (err) return;

                if (stdout.includes('Your branch is behind')) {
                    console.log('⬆️ New update detected. Pulling changes...');
                    await this.performUpdate();
                }
            });
        });
    }

    async performUpdate() {
        exec('git pull', async (err, stdout, stderr) => {
            if (err) {
                console.error('❌ Update failed:', err.message);
                await this.notifyAdmins(`❌ Auto-Update Failed: ${err.message}`);
                return;
            }

            console.log('✅ Update downloaded successfully.');
            await this.notifyAdmins(`✅ **System Updated**\n\nThe bot has successfully pulled new changes from the repository. Restarting to apply updates...`);

            // Allow time for message to send
            setTimeout(() => {
                console.log('♻️ Restarting process...');
                process.exit(0); // Exit code 0 tells Pterodactyl/PM2 to restart
            }, 2000);
        });
    }

    async notifyAdmins(message) {
        try {
            if (config.OWNER_ID) {
                await this.bot.telegram.sendMessage(config.OWNER_ID, message, { parse_mode: 'Markdown' });
            }

            // Also notify other admins if possible
            const { admins } = await db.getAdmins();
            if (admins && admins.length > 0) {
                for (const adminId of admins) {
                    try {
                        await this.bot.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' });
                    } catch (e) {
                        // Ignore blocked bot errors
                    }
                }
            }
        } catch (error) {
            console.error('Error sending update notification:', error.message);
        }
    }
}

module.exports = AutoUpdater;
