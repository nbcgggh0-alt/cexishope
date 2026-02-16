const AutoUpdater = require('./utils/autoUpdater');
const cp = require('child_process');

// 1. Mock the Bot object
const mockBot = {
    telegram: {
        sendMessage: async (id, msg) => {
            console.log(`\n📨 [TELEGRAM MOCK] Sent to ${id}:`);
            console.log(msg);
            console.log('-----------------------------------');
        }
    }
};

// 2. Monkey-patch child_process.exec to simulate Git updates
const originalExec = cp.exec;
cp.exec = function (command, callback) {
    console.log(`\n💻 [SYSTEM] Executing command: "${command}"`);

    if (command === 'git fetch') {
        // Simulate successful fetch
        return callback(null, 'Fetched origin', '');
    }

    if (command === 'git status -uno') {
        // SIMULATE: We are behind remote
        console.log('⚠️  [SIMULATION] Injecting "Your branch is behind" status...');
        const fakeStatus = `On branch main
Your branch is behind 'origin/main' by 1 commit, and can be fast-forwarded.
  (use "git pull" to update your local branch)

nothing to commit (use -u to show untracked files)`;
        return callback(null, fakeStatus, '');
    }

    if (command === 'git pull') {
        // Simulate successful pull
        console.log('⬇️  [SIMULATION] Pulling fake updates...');
        return callback(null, 'Updating 84ab668..cbda917\nFast-forward\n README.md | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)', '');
    }

    // Default behavior for other commands
    return originalExec(command, callback);
};

// 3. Run the test
console.log('🧪 STARTING AUTO-UPDATER SIMULATION');
console.log('====================================');

const updater = new AutoUpdater(mockBot);

// Force immediate check (don't wait for timer)
updater.checkUpdates();

// Prevent script from exiting immediately
setTimeout(() => {
    console.log('\n✅ TEST COMPLETE. If you see the Telegram message above, logic is working.');
    // We override process.exit so the test doesn't actually kill itself during the test
    process.exit = (code) => console.log(`\n🛑 [SYSTEM] Process would exit with code ${code} here.`);
}, 1000);
