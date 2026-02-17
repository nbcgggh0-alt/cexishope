const db = require('../utils/database');
const supabase = require('../utils/supabase');
const { v4: uuidv4 } = require('uuid');

async function run() {
    console.log('🚀 Starting Pterodactyl Product Import...');

    // 1. Ensure Category "Panel Pterodactyl" exists
    const categories = await db.getCategories();
    console.log('DEBUG: Categories found:', JSON.stringify(categories, null, 2));

    // Handle localized name (object) or string
    let category = categories.find(c => {
        const name = (typeof c.name === 'object' && c.name !== null) ? (c.name.en || c.name.ms) : c.name;
        return name && typeof name === 'string' && name.toLowerCase().includes('ptero');
    });

    if (!category) {
        console.log('📦 Category "Panel Pterodactyl" not found. Creating...');
        const newCat = {
            id: uuidv4(),
            name: 'Panel Pterodactyl', // String for new one, or should it be object? Let's use string for now as it seems mixed or acceptable.
            description: 'High Performance Pterodactyl Hosting (sg range)', // Assuming SG based on user context or generic
            icon: '🦕'
        };

        // Manual insert since addCategory doesn't exist
        const { data, error } = await supabase
            .from('cexi_categories')
            .insert(newCat) // Using snake_case for DB if needed, but db.js usually handles it. Wait, verify db.js usage.
            // db.js uses toDb(obj) which converts camelCase to snake_case.
            // But here we are using raw supabase or we can use db.saveCategories which overwrites! 
            // Better to use db.saveCategories with APPEND logic?? No, saveCategories syncs table.
            // Safer to use raw supabase insert with snake_case keys just to be safe, OR use the helper if accessible.
            // Let's use raw supabase insert for safety. 
            // DB keys: id, name, description, icon. (Likely snake_case columns if they differ? name/icon usually same)
            .select() // Returning *
            .single();

        if (error) {
            console.error('❌ Failed to create category:', error.message);
            process.exit(1);
        }
        category = newCat; // Use local obj
        console.log(`✅ Category Created: ${category.name} (${category.id})`);
    } else {
        const name = (typeof category.name === 'object' && category.name !== null) ? (category.name.en || category.name.ms) : category.name;
        console.log(`✅ Category Found: ${name} (${category.id})`);
    }

    // 2. Define Products
    // Prices: 1k = 1000. 
    // Format: "RAM 1GB : 1k"
    const products = [
        // RAM PACKAGES
        { name: 'RAM 1GB', price: 1000, desc: 'Panel Pterodactyl (1GB RAM)' },
        { name: 'RAM 2GB', price: 2000, desc: 'Panel Pterodactyl (2GB RAM)' },
        { name: 'RAM 3GB', price: 3000, desc: 'Panel Pterodactyl (3GB RAM)' },
        { name: 'RAM 4GB', price: 4000, desc: 'Panel Pterodactyl (4GB RAM)' },
        { name: 'RAM 5GB', price: 5000, desc: 'Panel Pterodactyl (5GB RAM)' },
        { name: 'RAM 6GB', price: 6000, desc: 'Panel Pterodactyl (6GB RAM)' },
        { name: 'RAM 7GB', price: 7000, desc: 'Panel Pterodactyl (7GB RAM)' },
        { name: 'RAM 8GB', price: 8000, desc: 'Panel Pterodactyl (8GB RAM)' },
        { name: 'RAM 9GB', price: 9000, desc: 'Panel Pterodactyl (9GB RAM)' },
        { name: 'RAM 10GB', price: 10000, desc: 'Panel Pterodactyl (10GB RAM)' },
        { name: 'RAM 11GB', price: 11000, desc: 'Panel Pterodactyl (11GB RAM)' },
        { name: 'RAM 12GB', price: 12000, desc: 'Panel Pterodactyl (12GB RAM)' },

        // PROMO
        { name: '🚀 RAM UNLIMITED', price: 5000, desc: '🔥 SPECIAL PROMO: Unlimited RAM (Paling Laku!)' },

        // APPS
        { name: '🎥 Alight Motion 1 Tahun', price: 3000, desc: 'Acc Gen, Garansi 6 Bulan' },
        { name: '📺 YouTube Premium Fam (Invite)', price: 7000, desc: 'Invite 1 Bulan' },
        { name: '🤖 Gemini Pro (Invite)', price: 8000, desc: 'Invite Personal' },
        { name: '🔥 COMBO YT Prem + Gemini', price: 12000, desc: '1 Bulan Subscription' },
        { name: '🎨 Canva Pro (Invite)', price: 6000, desc: 'Invite Team' },
        { name: '🎬 CapCut Pro (28 Hari)', price: 10000, desc: 'Private Account (28 Hari)' }
    ];

    console.log(`📦 Preparing to add ${products.length} products...`);

    for (const p of products) {
        const productData = {
            id: uuidv4(),
            name: p.name,
            description: p.desc,
            price: p.price,
            category_id: category.id,
            stock: 999, // Default logical unlimited stock for digital goods
            active: true,
            delivery_type: 'manual'
            // Removed min_quantity and max_quantity as they don't exist in schema
        };

        const result = await db.addProduct(productData); // Uses toDb which handles snake_casing
        if (result) {
            console.log(`   ✅ Added: ${p.name}`);
        } else {
            console.error(`   ❌ Failed: ${p.name}`);
        }
    }

    console.log('🎉 Import Complete!');
    process.exit(0);
}

run().catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
});
