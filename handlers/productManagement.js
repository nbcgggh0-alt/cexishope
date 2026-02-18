const { Markup } = require('telegraf');
const db = require('../utils/database');
const { generateId } = require('../utils/helpers');
const { smartFormatItem } = require('../utils/smartParser');
const { isOwnerOrAdmin } = require('./userManagement');

// Product Duplication
async function handleDuplicateProduct(ctx, productId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can duplicate products.');
    return;
  }

  if (!productId || typeof productId !== 'string') {
    if (typeof productId === 'object') {
      console.warn('handleDuplicateProduct received object:', productId);
      // attempt to extract if it's a context or event, though usually we expect string here
      // if we can't extract, return usage
    }
    await ctx.reply('Usage: /duplicate [product_id]\n\nExample: /duplicate PROD-ABC123');
    return;
  }

  const products = await db.getProducts();
  const originalProduct = products.find(p => p.id === productId);

  if (!originalProduct) {
    await ctx.reply(`❌ Product ${productId} not found.`);
    return;
  }

  // Create duplicate with new ID
  const newProduct = {
    ...originalProduct,
    id: generateId('PROD'),
    name: {
      ms: `${originalProduct.name.ms} (Copy)`,
      en: `${originalProduct.name.en || originalProduct.name.ms} (Copy)`
    },
    stock: 0, // Start with 0 stock
    items: [], // Empty items for auto-delivery
    createdAt: new Date().toISOString()
  };

  await db.addProduct(newProduct);

  // Log inventory movement
  await logInventoryMovement({
    productId: newProduct.id,
    productName: newProduct.name.ms,
    type: 'product_created',
    quantity: 0,
    note: `Duplicated from ${productId}`,
    adminId: adminId
  });

  await ctx.reply(
    `✅ *Product Duplicated Successfully!*\n\n` +
    `🆔 New ID: \`${newProduct.id}\`\n` +
    `📦 Name: ${newProduct.name.ms}\n` +
    `💰 Price: RM${newProduct.price}\n` +
    `📊 Stock: ${newProduct.stock}\n\n` +
    `Use /additem to add stock for auto-delivery products.`,
    { parse_mode: 'Markdown' }
  );
}

// Inventory Management
async function logInventoryMovement(movement) {
  const inventory = await db.getInventoryLogs();

  const log = {
    id: generateId('INV'),
    ...movement,
    timestamp: new Date().toISOString()
  };

  inventory.push(log);
  await db.saveInventoryLogs(inventory);

  return log;
}

async function handleInventoryHistory(ctx, productId) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can view inventory.');
    return;
  }

  const inventory = await db.getInventoryLogs();

  let logs = [...inventory];

  if (productId) {
    logs = logs.filter(l => l.productId === productId);

    if (logs.length === 0) {
      await ctx.reply(`❌ No inventory history for product: ${productId}`);
      return;
    }
  }

  // Sort by date (newest first)
  logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Limit to 30 recent logs
  const displayLogs = logs.slice(0, 30);

  let message = productId
    ? `📊 *Inventory History: ${productId}*\n\n`
    : `📊 *Recent Inventory Movements*\n\n`;

  displayLogs.forEach((log, index) => {
    const typeEmoji = {
      'stock_added': '➕',
      'stock_reduced': '➖',
      'product_created': '🆕',
      'stock_verified': '✅',
      'stock_rejected': '❌',
      'manual_adjustment': '🔧'
    }[log.type] || '📦';

    message += `${index + 1}. ${typeEmoji} *${log.type.replace(/_/g, ' ').toUpperCase()}*\n`;
    message += `   📦 ${log.productName}\n`;
    message += `   📊 Qty: ${log.quantity > 0 ? '+' : ''}${log.quantity}\n`;
    message += `   📅 ${new Date(log.timestamp).toLocaleString()}\n`;
    if (log.note) {
      message += `   📝 ${log.note}\n`;
    }
    message += '\n';
  });

  if (logs.length > 30) {
    message += `... and ${logs.length - 30} older movements\n`;
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function handleStockAdjustment(ctx, productId, adjustment, note) {
  const adminId = ctx.from.id;

  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.reply('❌ Unauthorized. Only admins can adjust stock.');
    return;
  }

  if (!productId || typeof productId !== 'string' || !adjustment) {
    if (typeof productId === 'object') {
      console.warn('handleStockAdjustment received object:', productId);
      // Return early to avoid [object Object] errors
      await ctx.reply('❌ Error: Invalid product ID format.');
      return;
    }
    await ctx.reply(
      'Usage: /adjuststock [product_id] [+/-amount] [note]\n\n' +
      'Examples:\n' +
      '• /adjuststock PROD-ABC +50 Restocked\n' +
      '• /adjuststock PROD-ABC -10 Damaged items removed'
    );
    return;
  }

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    await ctx.reply(`❌ Product ${productId} not found.`);
    return;
  }

  const amount = parseInt(adjustment);

  if (isNaN(amount)) {
    await ctx.reply('❌ Invalid amount. Use +/- with number (e.g., +10 or -5)');
    return;
  }

  const oldStock = product.stock;
  const newStock = Math.max(0, product.stock + amount);

  // For auto-delivery products, adjust items count too
  const updates = { stock: newStock };
  if (product.deliveryType === 'auto' && amount < 0) {
    const removeCount = Math.abs(amount);
    updates.items = (product.items || []).slice(removeCount);
  }

  await db.updateProduct(product.id, updates);
  product.stock = newStock;

  // Log inventory movement
  await logInventoryMovement({
    productId: product.id,
    productName: product.name.ms,
    type: 'manual_adjustment',
    quantity: amount,
    note: note || 'Manual stock adjustment',
    adminId: adminId,
    oldStock: oldStock,
    newStock: product.stock
  });

  await ctx.reply(
    `✅ *Stock Adjusted!*\n\n` +
    `📦 Product: ${product.name.ms}\n` +
    `📊 Old Stock: ${oldStock}\n` +
    `📊 Change: ${amount > 0 ? '+' : ''}${amount}\n` +
    `📊 New Stock: ${product.stock}\n` +
    `📝 Note: ${note || 'N/A'}`,
    { parse_mode: 'Markdown' }
  );
}

// Track stock change helper
async function trackStockChange(productId, productName, type, quantity, note, adminId = null) {
  await logInventoryMovement({
    productId,
    productName,
    type,
    quantity,
    note,
    adminId
  });
}

/**
 * /additem [product_id] | [data]
 * Add a single item (account data, code, key) to an auto-delivery product
 */
async function handleAddItem(ctx) {
  const userId = ctx.from.id;
  if (!await isOwnerOrAdmin(userId)) {
    await ctx.reply('❌ Unauthorized / Tidak dibenarkan');
    return;
  }

  const text = ctx.message.text.replace(/^\/additem\s*/, '').trim();
  const parts = text.split('|').map(s => s.trim());

  if (parts.length < 2 || !parts[0] || !parts[1]) {
    await ctx.reply(
      '📝 *Cara Guna / Usage:*\n\n' +
      '`/additem [product_id] | [data]`\n\n' +
      '*Contoh / Example:*\n' +
      '`/additem PROD-ABC | account@email.com:pass123`\n\n' +
      '_Data boleh jadi akaun, kod, kunci, atau apa-apa item digital._\n' +
      '_Data can be an account, code, key, or any digital item._',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const productId = parts[0];
  const itemData = parts[1];

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    await ctx.reply(`❌ Product \`${productId}\` not found.`, { parse_mode: 'Markdown' });
    return;
  }

  if (product.deliveryType !== 'auto') {
    await ctx.reply(
      `⚠️ Product *${product.name.ms}* is set to *Manual Delivery*.\n\n` +
      `Items can only be added to Auto Delivery products.\n` +
      `Change delivery type first if you want auto-delivery.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Add item
  if (!product.items) product.items = [];

  // Smart Format
  const formattedItem = smartFormatItem(itemData);
  product.items.push(formattedItem);

  const newStock2 = product.items.length;
  await db.updateProduct(product.id, { items: product.items, stock: newStock2 });
  product.stock = newStock2;

  await logInventoryMovement({
    productId,
    productName: product.name.ms,
    type: 'stock_added',
    quantity: 1,
    note: 'Single item added via /additem',
    adminId: userId
  });

  await ctx.reply(
    `✅ *Item Ditambah / Item Added!*\n\n` +
    `📦 Product: ${product.name.ms}\n` +
    `📊 Stock: ${product.stock} items\n` +
    `🔄 Type: Auto Delivery\n\n` +
    `_Item akan dihantar automatik apabila pesanan disahkan._\n` +
    `_Item will be auto-delivered when order is verified._\n\n` +
    `📝 *Preview:*\n\`${formattedItem}\``,
    { parse_mode: 'Markdown' }
  );
}

/**
 * /additems [product_id]
 * Prompts the admin to upload a .txt file with one item per line
 */
const addItemsState = new Map();

async function handleAddItems(ctx) {
  const userId = ctx.from.id;
  if (!await isOwnerOrAdmin(userId)) {
    await ctx.reply('❌ Unauthorized / Tidak dibenarkan');
    return;
  }

  const productId = ctx.message.text.replace(/^\/additems\s*/, '').trim();

  if (!productId) {
    await ctx.reply(
      '📝 *Cara Guna / Usage:*\n\n' +
      '`/additems [product_id]`\n\n' +
      'Kemudian hantar fail `.txt` dengan satu item setiap baris.\n' +
      'Then send a `.txt` file with one item per line.\n\n' +
      '*Contoh / Example:*\n' +
      '`/additems PROD-ABC`\n\n' +
      '_Fail .txt:_\n' +
      '```\naccount1@email.com:pass1\naccount2@email.com:pass2\naccount3@email.com:pass3\n```',
      { parse_mode: 'Markdown' }
    );
    return;
  }

  const products = await db.getProducts();
  const product = products.find(p => p.id === productId);

  if (!product) {
    await ctx.reply(`❌ Product \`${productId}\` not found.`, { parse_mode: 'Markdown' });
    return;
  }

  if (product.deliveryType !== 'auto') {
    await ctx.reply(
      `⚠️ Product *${product.name.ms}* is set to *Manual Delivery*.\n` +
      `Items can only be added to Auto Delivery products.`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  // Set state: waiting for file upload
  addItemsState.set(userId, productId);

  await ctx.reply(
    `📁 *Sila hantar fail .txt sekarang*\n\n` +
    `📦 Product: *${product.name.ms}*\n` +
    `📊 Stok semasa: ${product.stock} items\n\n` +
    `Format fail: satu item setiap baris\n` +
    `File format: one item per line\n\n` +
    `_Hantar fail .txt untuk muat naik item._\n` +
    `_Send a .txt file to upload items._`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Parse items from file content
 * Supports two modes:
 * 1. Block mode: accounts separated by "---" (for multi-line data like email + link)
 * 2. Simple mode: one item per line (for single-line data like email:password)
 */
function parseItemsFromContent(content) {
  // Normalize line endings
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Check if file uses --- separators (block mode)
  if (normalized.includes('---')) {
    const blocks = normalized.split(/^-{3,}$/m);
    return blocks
      .map(block => block.trim())
      .filter(block => block.length > 0);
  }

  // Check if file uses blank-line separators (multi-line accounts with gaps)
  // Detect: if there are groups of lines separated by 2+ blank lines
  const groups = normalized.split(/\n\s*\n\s*\n/);
  if (groups.length > 1 && groups.every(g => g.trim().includes('\n'))) {
    // Multiple multi-line groups detected — treat blank line gaps as separators
    return groups
      .map(group => group.trim())
      .filter(group => group.length > 0);
  }

  // Simple mode: one item per line
  return normalized.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
}

/**
 * Process uploaded .txt file for bulk item import
 * Called from the document handler in index.js
 * Returns true if the document was handled
 */
async function handleAddItemsFile(ctx) {
  const userId = ctx.from.id;
  const productId = addItemsState.get(userId);

  if (!productId) return false;

  // Check if it's a text file
  const doc = ctx.message.document;
  if (!doc || !doc.file_name.endsWith('.txt')) {
    await ctx.reply('❌ Sila hantar fail .txt sahaja / Please send a .txt file only.');
    return true; // Handled but rejected
  }

  try {
    // Download file content
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const fileUrl = fileLink.href || fileLink;
    let content;
    if (typeof globalThis.fetch === 'function') {
      const response = await globalThis.fetch(fileUrl);
      content = await response.text();
    } else {
      // Fallback for older Node versions
      const https = require('https');
      const http = require('http');
      const mod = fileUrl.startsWith('https') ? https : http;
      content = await new Promise((resolve, reject) => {
        mod.get(fileUrl, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
          res.on('error', reject);
        }).on('error', reject);
      });
    }

    // Smart parse: detects block mode (---) vs simple mode (line by line)
    // Then apply smart formatting to each item
    const rawItems = parseItemsFromContent(content);
    const items = rawItems.map(item => smartFormatItem(item));

    if (items.length === 0) {
      await ctx.reply('❌ Fail kosong / Empty file. No items found.');
      addItemsState.delete(userId);
      return true;
    }

    // Add to product
    const products = await db.getProducts();
    const product = products.find(p => p.id === productId);

    if (!product) {
      if (typeof productId === 'object') {
        console.warn('handleAddItemsFile: productId is object', productId);
        await ctx.reply('❌ Error: Invalid product context. Please try again.');
        addItemsState.delete(userId);
        return true;
      }
      await ctx.reply(`❌ Product \`${productId}\` not found.`, { parse_mode: 'Markdown' });
      addItemsState.delete(userId);
      return true;
    }

    if (!product.items) product.items = [];
    product.items.push(...items);
    const newStock3 = product.items.length;
    await db.updateProduct(product.id, { items: product.items, stock: newStock3 });
    product.stock = newStock3;

    await logInventoryMovement({
      productId,
      productName: product.name.ms,
      type: 'stock_added',
      quantity: items.length,
      note: `Bulk import via /additems (${doc.file_name})`,
      adminId: userId
    });

    addItemsState.delete(userId);

    // Show preview of first item (truncated)
    const preview = items[0].length > 50 ? items[0].substring(0, 50) + '...' : items[0];
    const isBlockMode = items.some(i => i.includes('\n'));

    await ctx.reply(
      `✅ *${items.length} Items Ditambah / Added!*\n\n` +
      `📦 Product: ${product.name.ms}\n` +
      `📊 Jumlah Stok: ${product.stock} items\n` +
      `🔄 Type: Auto Delivery\n` +
      `📋 Mode: ${isBlockMode ? 'Block (multi-line)' : 'Simple (one per line)'}\n\n` +
      `👁️ Preview item pertama:\n\`${preview}\`\n\n` +
      `_Semua item akan dihantar automatik apabila pesanan disahkan._\n` +
      `_All items will be auto-delivered when orders are verified._`,
      { parse_mode: 'Markdown' }
    );

    return true;
  } catch (error) {
    console.error('Failed to process items file:', error.message);
    await ctx.reply('❌ Gagal memproses fail / Failed to process file. Please try again.');
    addItemsState.delete(userId);
    return true;
  }
}

module.exports = {
  handleDuplicateProduct,
  handleInventoryHistory,
  handleStockAdjustment,
  trackStockChange,
  logInventoryMovement,
  handleAddItem,
  handleAddItems,
  handleAddItemsFile,
  addItemsState
};
