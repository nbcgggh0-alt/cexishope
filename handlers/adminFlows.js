/**
 * Admin Interactive Flows — Button-triggered state-based handlers
 * Replaces command-only functions with inline button flows
 */
const { Markup } = require('telegraf');
const db = require('../utils/database');
const { isOwnerOrAdmin } = require('./userManagement');
const { generateId } = require('../utils/helpers');

// State management for interactive flows
const adminFlowState = new Map();

/**
 * Set admin flow state
 */
function setAdminFlow(userId, flow, data = {}) {
    adminFlowState.set(userId, { flow, data, timestamp: Date.now() });
}

/**
 * Get and validate admin flow state (expires after 5 minutes)
 */
function getAdminFlow(userId) {
    const state = adminFlowState.get(userId);
    if (!state) return null;
    if (Date.now() - state.timestamp > 300000) {
        adminFlowState.delete(userId);
        return null;
    }
    return state;
}

/**
 * Clear admin flow state
 */
function clearAdminFlow(userId) {
    adminFlowState.delete(userId);
}

// ─── Add Product Flow ─────────────────────────────────────────

async function handleAddProductStart(ctx) {
    const userId = ctx.from.id;
    if (!await isOwnerOrAdmin(userId)) {
        await ctx.answerCbQuery('❌ Unauthorized');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    // Show category selection first
    const categories = await db.getCategories();

    if (categories.length === 0) {
        await ctx.answerCbQuery();
        await ctx.reply(
            lang === 'ms'
                ? '⚠️ Tiada kategori! Sila tambah kategori dahulu.'
                : '⚠️ No categories! Please add a category first.',
            Markup.inlineKeyboard([
                [Markup.button.callback(lang === 'ms' ? '📂 Tambah Kategori' : '📂 Add Category', 'flow_add_category')],
                [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]
            ])
        );
        return;
    }

    const buttons = categories.map(cat => [
        Markup.button.callback(
            `${cat.icon || '📂'} ${cat.name.ms}`,
            `flow_addprod_cat_${cat.id}`
        )
    ]);
    buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]);

    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? '➕ *Tambah Produk Baru*\n\n📂 Pilih kategori untuk produk ini:'
            : '➕ *Add New Product*\n\n📂 Select category for this product:',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
    );
}

async function handleAddProductCategory(ctx, categoryId) {
    const userId = ctx.from.id;
    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    setAdminFlow(userId, 'addproduct_name', { categoryId });
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? '📝 *Langkah 1/5 — Nama Produk*\n\nTaip nama produk (BM):\n\n_Contoh: Netflix Premium 1 Bulan_'
            : '📝 *Step 1/5 — Product Name*\n\nType product name:\n\n_Example: Netflix Premium 1 Month_',
        { parse_mode: 'Markdown' }
    );
}

// ─── Add Category Flow ────────────────────────────────────────

async function handleAddCategoryStart(ctx) {
    const userId = ctx.from.id;
    if (!await isOwnerOrAdmin(userId)) {
        await ctx.answerCbQuery('❌ Unauthorized');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    setAdminFlow(userId, 'addcategory_name', {});
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? '📂 *Tambah Kategori Baru*\n\nTaip nama kategori:\n\n_Contoh: Game Accounts_'
            : '📂 *Add New Category*\n\nType category name:\n\n_Example: Game Accounts_',
        { parse_mode: 'Markdown' }
    );
}

// ─── Add Stock Items Flow ─────────────────────────────────────

async function handleAddStockStart(ctx, productId) {
    const userId = ctx.from.id;
    if (!await isOwnerOrAdmin(userId)) {
        await ctx.answerCbQuery('❌ Unauthorized');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    const products = await db.getProducts();
    const product = products.find(p => p.id === productId);

    if (!product) {
        await ctx.answerCbQuery(lang === 'ms' ? 'Produk tidak dijumpai' : 'Product not found');
        return;
    }

    const isAuto = product.deliveryType === 'auto';

    const buttons = [];
    if (isAuto) {
        buttons.push([Markup.button.callback(
            lang === 'ms' ? '📝 Tambah 1 Item' : '📝 Add 1 Item',
            `flow_additem_single_${productId}`
        )]);
        buttons.push([Markup.button.callback(
            lang === 'ms' ? '📁 Muat Naik Fail .txt' : '📁 Upload .txt File',
            `flow_additem_bulk_${productId}`
        )]);
    }
    buttons.push([Markup.button.callback(
        lang === 'ms' ? '📊 Ubah Stok (+/-)' : '📊 Adjust Stock (+/-)',
        `flow_adjuststock_${productId}`
    )]);
    buttons.push([Markup.button.callback(
        lang === 'ms' ? '🔙 Kembali' : '🔙 Back',
        `prod_detail_${productId}`
    )]);

    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? `📦 *Urus Stok — ${product.name.ms}*\n\n` +
            `📊 Stok Semasa: ${product.stock}\n` +
            `🔄 Jenis: ${isAuto ? 'Auto Delivery' : 'Manual'}\n` +
            (isAuto ? `📋 Items: ${(product.items || []).length}\n` : '') +
            `\nPilih tindakan:`
            : `📦 *Manage Stock — ${product.name.en || product.name.ms}*\n\n` +
            `📊 Current Stock: ${product.stock}\n` +
            `🔄 Type: ${isAuto ? 'Auto Delivery' : 'Manual'}\n` +
            (isAuto ? `📋 Items: ${(product.items || []).length}\n` : '') +
            `\nChoose action:`,
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
    );
}

async function handleAddItemSingle(ctx, productId) {
    const userId = ctx.from.id;
    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    setAdminFlow(userId, 'additem_single', { productId });
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? '📝 *Tambah Item*\n\nTaip data item:\n\n_Contoh: account@email.com:password123_\n_Contoh: ABCD-EFGH-IJKL-MNOP_'
            : '📝 *Add Item*\n\nType item data:\n\n_Example: account@email.com:password123_\n_Example: ABCD-EFGH-IJKL-MNOP_',
        { parse_mode: 'Markdown' }
    );
}

async function handleAddItemBulk(ctx, productId) {
    const userId = ctx.from.id;
    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    // Use the existing addItemsState from productManagement
    const { handleAddItems } = require('./productManagement');

    setAdminFlow(userId, 'additem_bulk', { productId });

    // Set the addItemsState directly
    const prodMgmt = require('./productManagement');
    // We need to trigger the file upload state
    if (prodMgmt.addItemsState) {
        prodMgmt.addItemsState.set(userId, String(productId));
    }

    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }

    const products = await db.getProducts();
    const product = products.find(p => p.id === productId);

    await ctx.reply(
        lang === 'ms'
            ? `📁 *Muat Naik Fail .txt*\n\n` +
            `📦 Produk: *${product?.name.ms || productId}*\n` +
            `📊 Stok semasa: ${product?.stock || 0}\n\n` +
            `Format:\n` +
            `• Satu item setiap baris\n` +
            `• Atau guna \`---\` sebagai pemisah untuk item berbilang baris\n\n` +
            `_Hantar fail .txt sekarang_`
            : `📁 *Upload .txt File*\n\n` +
            `📦 Product: *${product?.name.en || product?.name.ms || productId}*\n` +
            `📊 Current stock: ${product?.stock || 0}\n\n` +
            `Format:\n` +
            `• One item per line\n` +
            `• Or use \`---\` as separator for multi-line items\n\n` +
            `_Send .txt file now_`,
        { parse_mode: 'Markdown' }
    );
}

async function handleAdjustStockStart(ctx, productId) {
    const userId = ctx.from.id;
    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    setAdminFlow(userId, 'adjuststock', { productId });
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? '📊 *Ubah Stok*\n\nTaip jumlah:\n\n• `+50` untuk tambah\n• `-10` untuk kurang\n\n_Contoh: +100_'
            : '📊 *Adjust Stock*\n\nType amount:\n\n• `+50` to add\n• `-10` to reduce\n\n_Example: +100_',
        { parse_mode: 'Markdown' }
    );
}

// ─── Process Text Input ───────────────────────────────────────

async function processAdminFlowInput(ctx) {
    const userId = ctx.from.id;
    const state = getAdminFlow(userId);

    if (!state) return false;

    const text = ctx.message?.text?.trim();
    if (!text) return false;

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    try {
        switch (state.flow) {
            // ── Add Product Flow ───────────────────
            case 'addproduct_name': {
                state.data.name = text;
                setAdminFlow(userId, 'addproduct_price', state.data);
                await ctx.reply(
                    lang === 'ms'
                        ? '💰 *Langkah 2/5 — Harga*\n\nTaip harga (RM):\n\n_Contoh: 15.00_'
                        : '💰 *Step 2/5 — Price*\n\nType price:\n\n_Example: 15.00_',
                    { parse_mode: 'Markdown' }
                );
                return true;
            }

            case 'addproduct_price': {
                const price = parseFloat(text);
                if (isNaN(price) || price <= 0) {
                    await ctx.reply(lang === 'ms' ? '❌ Harga tidak sah. Cuba lagi:' : '❌ Invalid price. Try again:');
                    return true;
                }
                state.data.price = price;
                setAdminFlow(userId, 'addproduct_delivery', state.data);
                await ctx.reply(
                    lang === 'ms'
                        ? '🔄 *Langkah 3/5 — Jenis Penghantaran*\n\nPilih:'
                        : '🔄 *Step 3/5 — Delivery Type*\n\nSelect:',
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback('🤖 Auto Delivery', 'flow_delivery_auto')],
                            [Markup.button.callback('👤 Manual Delivery', 'flow_delivery_manual')]
                        ])
                    }
                );
                return true;
            }

            case 'addproduct_desc': {
                state.data.description = text;
                // Create the product
                const newProduct = {
                    id: generateId('PROD'),
                    name: { ms: state.data.name, en: state.data.name },
                    price: state.data.price,
                    description: { ms: state.data.description, en: state.data.description },
                    categoryId: state.data.categoryId,
                    deliveryType: state.data.deliveryType,
                    stock: 0,
                    items: [],
                    active: true,
                    images: [],
                    createdAt: new Date().toISOString()
                };
                // Atomic insert — no full table overwrite
                await db.addProduct(newProduct);
                clearAdminFlow(userId);

                const buttons = [[
                    Markup.button.callback(
                        lang === 'ms' ? '📦 Tambah Stok' : '📦 Add Stock',
                        `flow_stock_${newProduct.id}`
                    )
                ], [
                    Markup.button.callback(
                        lang === 'ms' ? '🔙 Senarai Produk' : '🔙 Product List',
                        'admin_products_menu'
                    )
                ]];

                await ctx.reply(
                    lang === 'ms'
                        ? `✅ *Produk Berjaya Ditambah!*\n\n` +
                        `🆔 ID: \`${newProduct.id}\`\n` +
                        `📦 Nama: ${newProduct.name.ms}\n` +
                        `💰 Harga: RM${newProduct.price}\n` +
                        `🔄 Jenis: ${newProduct.deliveryType === 'auto' ? 'Auto' : 'Manual'}\n\n` +
                        `Nak tambah stok sekarang?`
                        : `✅ *Product Added Successfully!*\n\n` +
                        `🆔 ID: \`${newProduct.id}\`\n` +
                        `📦 Name: ${newProduct.name.ms}\n` +
                        `💰 Price: RM${newProduct.price}\n` +
                        `🔄 Type: ${newProduct.deliveryType === 'auto' ? 'Auto' : 'Manual'}\n\n` +
                        `Want to add stock now?`,
                    { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
                );
                return true;
            }

            // ── Add Category Flow ──────────────────
            case 'addcategory_name': {
                const categories = await db.getCategories();
                const newCat = {
                    id: generateId('CAT'),
                    name: { ms: text, en: text },
                    icon: '📂',
                    active: true
                };
                categories.push(newCat);
                await db.saveCategories(categories);
                clearAdminFlow(userId);

                await ctx.reply(
                    lang === 'ms'
                        ? `✅ *Kategori Ditambah!*\n\n📂 ${newCat.name.ms}\n🆔 ID: \`${newCat.id}\``
                        : `✅ *Category Added!*\n\n📂 ${newCat.name.ms}\n🆔 ID: \`${newCat.id}\``,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback(lang === 'ms' ? '➕ Tambah Produk' : '➕ Add Product', 'prod_add_new')],
                            [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]
                        ])
                    }
                );
                return true;
            }

            // ── Add Single Item Flow ───────────────
            case 'additem_single': {
                const products = await db.getProducts();
                const product = products.find(p => p.id === state.data.productId);
                if (!product) {
                    await ctx.reply('❌ Product not found');
                    clearAdminFlow(userId);
                    return true;
                }

                if (!product.items) product.items = [];
                product.items.push(text);
                const newStock = product.items.length;
                await db.updateProduct(product.id, { items: product.items, stock: newStock });
                product.stock = newStock;
                clearAdminFlow(userId);

                await ctx.reply(
                    lang === 'ms'
                        ? `✅ *Item Ditambah!*\n\n📦 ${product.name.ms}\n📊 Stok: ${product.stock}`
                        : `✅ *Item Added!*\n\n📦 ${product.name.ms}\n📊 Stock: ${product.stock}`,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback(lang === 'ms' ? '📝 Tambah Lagi' : '📝 Add More', `flow_additem_single_${state.data.productId}`)],
                            [Markup.button.callback(lang === 'ms' ? '📁 Muat Naik Fail' : '📁 Upload File', `flow_additem_bulk_${state.data.productId}`)],
                            [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', `prod_detail_${state.data.productId}`)]
                        ])
                    }
                );
                return true;
            }

            // ── Adjust Stock Flow ──────────────────
            case 'adjuststock': {
                const amount = parseInt(text);
                if (isNaN(amount) || amount === 0) {
                    await ctx.reply(lang === 'ms' ? '❌ Nombor tidak sah. Contoh: +50 atau -10' : '❌ Invalid number. Example: +50 or -10');
                    return true;
                }

                const products = await db.getProducts();
                const product = products.find(p => p.id === state.data.productId);
                if (!product) {
                    await ctx.reply('❌ Product not found');
                    clearAdminFlow(userId);
                    return true;
                }

                const oldStock = product.stock;
                const newStock = Math.max(0, product.stock + amount);
                await db.updateProduct(product.id, { stock: newStock });
                product.stock = newStock;
                clearAdminFlow(userId);

                await ctx.reply(
                    lang === 'ms'
                        ? `✅ *Stok Dikemaskini!*\n\n📦 ${product.name.ms}\n📊 ${oldStock} → ${product.stock}`
                        : `✅ *Stock Updated!*\n\n📦 ${product.name.ms}\n📊 ${oldStock} → ${product.stock}`,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', `prod_detail_${state.data.productId}`)]
                        ])
                    }
                );
                return true;
            }

            // ── Add Admin Flow ──────────────────────
            case 'addadmin_id': {
                const adminId = parseInt(text);
                if (isNaN(adminId)) {
                    await ctx.reply(lang === 'ms' ? '❌ ID tidak sah. Taip nombor.' : '❌ Invalid ID. Type a number.');
                    return true;
                }

                const admins = await db.getAdmins();
                if (!admins.admins) admins.admins = [];
                if (admins.admins.includes(adminId)) {
                    await ctx.reply(
                        lang === 'ms' ? '⚠️ Pengguna ini sudah menjadi admin.' : '⚠️ This user is already an admin.',
                        Markup.inlineKeyboard([
                            [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'owner_admins')]
                        ])
                    );
                    clearAdminFlow(userId);
                    return true;
                }
                admins.admins.push(adminId);
                await db.saveAdmins(admins);
                clearAdminFlow(userId);

                await ctx.reply(
                    lang === 'ms'
                        ? `✅ *Admin Ditambah!*\n\n👨‍💼 ID: \`${adminId}\``
                        : `✅ *Admin Added!*\n\n👨‍💼 ID: \`${adminId}\``,
                    {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            [Markup.button.callback(lang === 'ms' ? '👨‍💼 Tambah Lagi' : '👨‍💼 Add Another', 'flow_add_admin')],
                            [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'owner_admins')]
                        ])
                    }
                );
                return true;
            }

            // ── Ban User Flow ────────────────────────
            case 'banuser_id': {
                const targetId = parseInt(text);
                if (isNaN(targetId)) {
                    await ctx.reply(lang === 'ms' ? '❌ ID tidak sah.' : '❌ Invalid ID.');
                    return true;
                }

                const users = await db.getUsers();
                const target = users.find(u => (u.userId || u.id) === targetId);
                if (target) {
                    const targetUserId2 = target.userId || target.id;
                    target.banned = true;
                    target.bannedReason = 'Banned by admin';
                    await db.updateUser(targetUserId2, { banned: true, bannedReason: 'Banned by admin' });
                }
                clearAdminFlow(userId);

                await ctx.reply(
                    lang === 'ms'
                        ? `🚫 Pengguna ${targetId} telah diban.`
                        : `🚫 User ${targetId} has been banned.`,
                    Markup.inlineKeyboard([
                        [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_panel')]
                    ])
                );
                return true;
            }

            // ── Tag User Flow ────────────────────────
            case 'taguser_id': {
                const parts = text.split(/\s+/);
                if (parts.length < 2) {
                    await ctx.reply(lang === 'ms' ? '❌ Format: ID tag\nContoh: 123456789 VIP' : '❌ Format: ID tag\nExample: 123456789 VIP');
                    return true;
                }
                const targetUserId = parseInt(parts[0]);
                const tag = parts.slice(1).join(' ');

                if (isNaN(targetUserId)) {
                    await ctx.reply(lang === 'ms' ? '❌ ID tidak sah.' : '❌ Invalid ID.');
                    return true;
                }

                const users = await db.getUsers();
                const targetUser = users.find(u => (u.userId || u.id) === targetUserId);
                if (targetUser) {
                    if (!targetUser.tags) targetUser.tags = [];
                    if (!targetUser.tags.includes(tag)) targetUser.tags.push(tag);
                    const targetUserId3 = targetUser.userId || targetUser.id;
                    await db.updateUser(targetUserId3, { tags: targetUser.tags });
                }
                clearAdminFlow(userId);

                await ctx.reply(
                    lang === 'ms'
                        ? `🏷️ Tag "${tag}" ditambah untuk pengguna ${targetUserId}.`
                        : `🏷️ Tag "${tag}" added to user ${targetUserId}.`,
                    Markup.inlineKeyboard([
                        [Markup.button.callback(lang === 'ms' ? '🏷️ Tag Lagi' : '🏷️ Tag Another', 'flow_tag_user')],
                        [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_panel')]
                    ])
                );
                return true;
            }

            // ── Pterodactyl Panel Flow ─────────────────
            case 'ptero_add_domain':
            case 'ptero_add_ptla':
            case 'ptero_add_ptlc': {
                const { processPteroFlowInput } = require('./serverPanel');
                return await processPteroFlowInput(ctx, state, text, lang);
            }

            default:
                clearAdminFlow(userId);
                return false;
        }
    } catch (error) {
        console.error('Admin flow error:', error.message);
        clearAdminFlow(userId);
        return false;
    }
}

// ─── Delivery Type Selection (callback) ──────────────────────

async function handleDeliveryTypeSelect(ctx, type) {
    const userId = ctx.from.id;
    const state = getAdminFlow(userId);
    if (!state || state.flow !== 'addproduct_delivery') return;

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    state.data.deliveryType = type;
    setAdminFlow(userId, 'addproduct_desc', state.data);

    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? '📝 *Langkah 4/5 — Penerangan*\n\nTaip penerangan produk:\n\n_Contoh: Akaun Netflix Premium untuk 1 bulan_'
            : '📝 *Step 4/5 — Description*\n\nType product description:\n\n_Example: Netflix Premium account for 1 month_',
        { parse_mode: 'Markdown' }
    );
}

// ─── Add Admin Flow ───────────────────────────────────────────

async function handleAddAdminStart(ctx) {
    const userId = ctx.from.id;
    const { isOwner } = require('./owner');
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('❌ Owner only');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    setAdminFlow(userId, 'addadmin_id', {});
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? '👨‍💼 *Tambah Admin*\n\nTaip ID pengguna Telegram:\n\n_Contoh: 123456789_\n_Tip: Admin perlu mulakan bot dahulu agar boleh dikesan_'
            : '👨‍💼 *Add Admin*\n\nType Telegram user ID:\n\n_Example: 123456789_\n_Tip: Admin must start the bot first to be detected_',
        { parse_mode: 'Markdown' }
    );
}

async function handleRemoveAdminStart(ctx) {
    const userId = ctx.from.id;
    const { isOwner } = require('./owner');
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('❌ Owner only');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    const admins = await db.getAdmins();
    if (!admins.admins || admins.admins.length === 0) {
        await ctx.answerCbQuery(lang === 'ms' ? 'Tiada admin' : 'No admins');
        return;
    }

    // Show admin list with remove buttons
    const buttons = admins.admins.map(adminId => [
        Markup.button.callback(`❌ Remove ${adminId}`, `flow_removeadmin_${adminId}`)
    ]);
    buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'owner_admins')]);

    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? '🗑️ *Keluarkan Admin*\n\nPilih admin untuk dikeluarkan:'
            : '🗑️ *Remove Admin*\n\nSelect admin to remove:',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
    );
}

async function handleRemoveAdminConfirm(ctx, adminIdToRemove) {
    const userId = ctx.from.id;
    const { isOwner } = require('./owner');
    if (!await isOwner(userId)) {
        await ctx.answerCbQuery('❌ Owner only');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    const admins = await db.getAdmins();
    const idx = admins.admins.indexOf(adminIdToRemove);
    if (idx !== -1) {
        admins.admins.splice(idx, 1);
    } else {
        // Try as number
        const numId = parseInt(adminIdToRemove);
        const numIdx = admins.admins.indexOf(numId);
        if (numIdx !== -1) admins.admins.splice(numIdx, 1);
    }
    await db.saveAdmins(admins);

    await ctx.answerCbQuery(lang === 'ms' ? '✅ Admin dikeluarkan' : '✅ Admin removed');
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? `✅ Admin ${adminIdToRemove} telah dikeluarkan.`
            : `✅ Admin ${adminIdToRemove} has been removed.`,
        Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'owner_admins')]
        ])
    );
}

// ─── Ban User Flow ────────────────────────────────────────────

async function handleBanUserStart(ctx) {
    const userId = ctx.from.id;
    if (!await isOwnerOrAdmin(userId)) {
        await ctx.answerCbQuery('❌ Unauthorized');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    setAdminFlow(userId, 'banuser_id', {});
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? '🚫 *Ban Pengguna*\n\nTaip ID pengguna:\n\n_Contoh: 123456789_'
            : '🚫 *Ban User*\n\nType user ID:\n\n_Example: 123456789_',
        { parse_mode: 'Markdown' }
    );
}

async function handleUnbanUserStart(ctx) {
    const userId = ctx.from.id;
    if (!await isOwnerOrAdmin(userId)) {
        await ctx.answerCbQuery('❌ Unauthorized');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    // Show banned users list
    const users = await db.getUsers();
    const banned = users.filter(u => u.banned);

    if (banned.length === 0) {
        await ctx.answerCbQuery(lang === 'ms' ? 'Tiada pengguna diban' : 'No banned users');
        return;
    }

    const buttons = banned.map(u => [
        Markup.button.callback(`✅ Unban ${u.userId || u.id} (${u.username || 'N/A'})`, `flow_unban_${u.userId || u.id}`)
    ]);
    buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_panel')]);

    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? '✅ *Nyahban Pengguna*\n\nPilih pengguna:'
            : '✅ *Unban User*\n\nSelect user:',
        { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
    );
}

async function handleUnbanConfirm(ctx, targetId) {
    const userId = ctx.from.id;
    if (!await isOwnerOrAdmin(userId)) {
        await ctx.answerCbQuery('❌ Unauthorized');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    const users = await db.getUsers();
    const targetUnban = users.find(u => String(u.userId || u.id) === String(targetId));
    if (targetUnban) {
        const unbanUserId = targetUnban.userId || targetUnban.id;
        await db.updateUser(unbanUserId, { banned: false, bannedReason: null });
    }

    await ctx.answerCbQuery(lang === 'ms' ? '✅ Dinyahban' : '✅ Unbanned');
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? `✅ Pengguna ${targetId} telah dinyahban.`
            : `✅ User ${targetId} has been unbanned.`,
        Markup.inlineKeyboard([
            [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_panel')]
        ])
    );
}

// ─── Tag User Flow ────────────────────────────────────────────

async function handleTagUserStart(ctx) {
    const userId = ctx.from.id;
    if (!await isOwnerOrAdmin(userId)) {
        await ctx.answerCbQuery('❌ Unauthorized');
        return;
    }

    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';

    setAdminFlow(userId, 'taguser_id', {});
    await ctx.answerCbQuery();
    try { await ctx.deleteMessage(); } catch (e) { /* ignore */ }
    await ctx.reply(
        lang === 'ms'
            ? '🏷️ *Tag Pengguna*\n\nTaip ID pengguna dan tag:\n\nFormat: `ID tag`\n\n_Contoh: 123456789 VIP_'
            : '🏷️ *Tag User*\n\nType user ID and tag:\n\nFormat: `ID tag`\n\n_Example: 123456789 VIP_',
        { parse_mode: 'Markdown' }
    );
}

module.exports = {
    handleAddProductStart,
    handleAddProductCategory,
    handleAddCategoryStart,
    handleAddStockStart,
    handleAddItemSingle,
    handleAddItemBulk,
    handleAdjustStockStart,
    handleDeliveryTypeSelect,
    processAdminFlowInput,
    getAdminFlow,
    clearAdminFlow,
    setAdminFlow,
    handleAddAdminStart,
    handleRemoveAdminStart,
    handleRemoveAdminConfirm,
    handleBanUserStart,
    handleUnbanUserStart,
    handleUnbanConfirm,
    handleTagUserStart
};
