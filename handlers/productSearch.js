const { Markup } = require('telegraf');
const db = require('../utils/database');
const { safeEditMessage } = require('../utils/messageHelper');
const { isOwnerOrAdmin } = require('./userManagement');

const searchState = new Map();

async function handleProductSearch(ctx) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  searchState.set(adminId, true);
  
  const message = lang === 'ms'
    ? '🔍 *Cari Produk*\n\nHantar nama produk, ID, atau kategori untuk cari:\n\nContoh:\n• Netflix\n• PROD-ABC123\n• Premium'
    : '🔍 *Search Product*\n\nSend product name, ID, or category to search:\n\nExample:\n• Netflix\n• PROD-ABC123\n• Premium';
  
  await ctx.answerCbQuery();
  await ctx.reply(message, { parse_mode: 'Markdown' });
}

async function processProductSearch(ctx) {
  const adminId = ctx.from.id;
  
  if (!searchState.has(adminId)) {
    return false;
  }
  
  searchState.delete(adminId);
  
  const query = ctx.message.text.trim().toLowerCase();
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  const products = await db.getProducts();
  const categories = await db.getCategories();
  
  const results = products.filter(p => {
    const nameMatch = (p.name.ms || '').toLowerCase().includes(query) ||
                      (p.name.en || '').toLowerCase().includes(query);
    const idMatch = p.id.toLowerCase().includes(query);
    const categoryMatch = categories.some(c => 
      c.id === p.categoryId && 
      ((c.name.ms || '').toLowerCase().includes(query) || 
       (c.name.en || '').toLowerCase().includes(query))
    );
    
    return nameMatch || idMatch || categoryMatch;
  });
  
  if (results.length === 0) {
    await ctx.reply(
      lang === 'ms' 
        ? '❌ Tiada produk dijumpai untuk carian anda.'
        : '❌ No products found for your search.',
      { parse_mode: 'Markdown' }
    );
    return true;
  }
  
  let text = lang === 'ms'
    ? `🔍 *Hasil Carian*\n\nDijumpai ${results.length} produk:\n\n`
    : `🔍 *Search Results*\n\nFound ${results.length} products:\n\n`;
  
  const buttons = [];
  
  results.slice(0, 10).forEach(prod => {
    const cat = categories.find(c => c.id === prod.categoryId);
    const status = prod.active ? '✅' : '❌';
    text += `${status} \`${prod.id}\`\n`;
    text += `📦 ${prod.name.ms}\n`;
    text += `💰 RM${prod.price} | 📊 Stok: ${prod.stock}\n`;
    text += `📂 ${cat?.name.ms || 'Unknown'}\n\n`;
    
    buttons.push([
      Markup.button.callback(`${prod.name.ms}`, `prod_detail_${prod.id}`)
    ]);
  });
  
  if (results.length > 10) {
    text += lang === 'ms'
      ? `\n_Menunjukkan 10 hasil pertama dari ${results.length}_`
      : `\n_Showing first 10 results of ${results.length}_`;
  }
  
  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]);
  
  await ctx.reply(text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
  
  return true;
}

async function handleProductFilter(ctx) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  const text = lang === 'ms'
    ? '🔍 *Tapis Produk*\n\nPilih kriteria penapisan:'
    : '🔍 *Filter Products*\n\nSelect filter criteria:';
  
  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '✅ Produk Aktif' : '✅ Active Products', 'filter_active')],
    [Markup.button.callback(lang === 'ms' ? '❌ Produk Tidak Aktif' : '❌ Inactive Products', 'filter_inactive')],
    [Markup.button.callback(lang === 'ms' ? '⚠️ Stok Rendah (<5)' : '⚠️ Low Stock (<5)', 'filter_low_stock')],
    [Markup.button.callback(lang === 'ms' ? '📦 Stok Habis (0)' : '📦 Out of Stock (0)', 'filter_out_stock')],
    [Markup.button.callback(lang === 'ms' ? '💰 Harga Tertinggi' : '💰 Highest Price', 'filter_high_price')],
    [Markup.button.callback(lang === 'ms' ? '💵 Harga Terendah' : '💵 Lowest Price', 'filter_low_price')],
    [Markup.button.callback(lang === 'ms' ? '📅 Terbaru' : '📅 Newest', 'filter_newest')],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_products_menu')]
  ];
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

async function handleFilterCallback(ctx, filterType) {
  const adminId = ctx.from.id;
  
  if (!await isOwnerOrAdmin(adminId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }
  
  const user = await db.getUser(adminId);
  const lang = user?.language || 'ms';
  
  let products = await db.getProducts();
  const categories = await db.getCategories();
  let filterName = '';
  
  switch(filterType) {
    case 'active':
      products = products.filter(p => p.active);
      filterName = lang === 'ms' ? 'Produk Aktif' : 'Active Products';
      break;
    case 'inactive':
      products = products.filter(p => !p.active);
      filterName = lang === 'ms' ? 'Produk Tidak Aktif' : 'Inactive Products';
      break;
    case 'low_stock':
      products = products.filter(p => p.stock > 0 && p.stock < 5);
      filterName = lang === 'ms' ? 'Stok Rendah' : 'Low Stock';
      break;
    case 'out_stock':
      products = products.filter(p => p.stock === 0);
      filterName = lang === 'ms' ? 'Stok Habis' : 'Out of Stock';
      break;
    case 'high_price':
      products = products.sort((a, b) => b.price - a.price).slice(0, 20);
      filterName = lang === 'ms' ? 'Harga Tertinggi' : 'Highest Price';
      break;
    case 'low_price':
      products = products.sort((a, b) => a.price - b.price).slice(0, 20);
      filterName = lang === 'ms' ? 'Harga Terendah' : 'Lowest Price';
      break;
    case 'newest':
      products = products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 20);
      filterName = lang === 'ms' ? 'Terbaru' : 'Newest';
      break;
  }
  
  if (products.length === 0) {
    await ctx.answerCbQuery(lang === 'ms' ? '❌ Tiada produk dijumpai' : '❌ No products found');
    return;
  }
  
  let text = lang === 'ms'
    ? `🔍 *${filterName}*\n\nDijumpai ${products.length} produk:\n\n`
    : `🔍 *${filterName}*\n\nFound ${products.length} products:\n\n`;
  
  const buttons = [];
  
  products.slice(0, 10).forEach(prod => {
    const cat = categories.find(c => c.id === prod.categoryId);
    const status = prod.active ? '✅' : '❌';
    text += `${status} \`${prod.id}\`\n`;
    text += `📦 ${prod.name.ms}\n`;
    text += `💰 RM${prod.price} | 📊 ${prod.stock}\n`;
    text += `📂 ${cat?.name.ms || 'Unknown'}\n\n`;
    
    buttons.push([
      Markup.button.callback(`${prod.name.ms.substring(0, 30)}...`, `prod_detail_${prod.id}`)
    ]);
  });
  
  if (products.length > 10) {
    text += lang === 'ms'
      ? `\n_Menunjukkan 10 hasil pertama dari ${products.length}_`
      : `\n_Showing first 10 results of ${products.length}_`;
  }
  
  buttons.push([Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'product_filter')]);
  
  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

module.exports = {
  handleProductSearch,
  processProductSearch,
  handleProductFilter,
  handleFilterCallback,
  searchState
};
