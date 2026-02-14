const db = require('../utils/database');

async function setOwner() {
    const newOwnerId = parseInt(process.argv[2]);

    if (!newOwnerId || isNaN(newOwnerId)) {
        console.error('❌ Usage: node scripts/set_new_owner.js <TELEGRAM_USER_ID>');
        console.error('   Example: node scripts/set_new_owner.js 123456789');
        process.exit(1);
    }

    console.log(`Setting owner to ${newOwnerId}...`);

    try {
        const admins = await db.getAdmins();
        console.log('Current admins:', admins);

        // Set new owner
        admins.owner = newOwnerId;

        // Remove from admins list if present (avoid duplicates)
        if (admins.admins) {
            admins.admins = admins.admins.filter(id => id !== newOwnerId);
        }

        await db.saveAdmins(admins);
        console.log('✅ Owner updated successfully!');
        console.log('New admins state:', await db.getAdmins());
    } catch (error) {
        console.error('❌ Failed to set owner:', error);
    }
}

setOwner();
