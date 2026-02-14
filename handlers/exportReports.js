const db = require('../utils/database');
const fs = require('fs').promises;
const path = require('path');
const { isOwnerOrAdmin } = require('./userManagement');

function arrayToCSV(data, headers) {
  if (data.length === 0) return '';

  const csv = [];
  csv.push(headers.join(','));

  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header] !== undefined ? row[header] : '';
      const stringValue = String(value).replace(/"/g, '""');
      return `"${stringValue}"`;
    });
    csv.push(values.join(','));
  });

  return csv.join('\n');
}

async function exportProductsCSV(ctx) {
  const userId = ctx.from.id;

  if (!await isOwnerOrAdmin(userId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const categories = await db.getCategories();

  const data = products.map(p => {
    const cat = categories.find(c => c.id === p.categoryId);
    return {
      ID: p.id,
      Name: p.name.ms,
      Category: cat?.name.ms || '',
      Price: p.price,
      Stock: p.stock,
      Active: p.active ? 'Yes' : 'No',
      DeliveryType: p.deliveryType,
      CreatedAt: new Date(p.createdAt).toISOString()
    };
  });

  const headers = ['ID', 'Name', 'Category', 'Price', 'Stock', 'Active', 'DeliveryType', 'CreatedAt'];
  const csv = arrayToCSV(data, headers);

  const filename = `products_${new Date().toISOString().split('T')[0]}.csv`;
  const filepath = path.join('data', filename);

  await fs.writeFile(filepath, csv, 'utf8');

  await ctx.replyWithDocument(
    { source: filepath, filename },
    {
      caption: lang === 'ms'
        ? `📊 Export Produk\n\n${products.length} produk diexport`
        : `📊 Products Export\n\n${products.length} products exported`
    }
  );

  await fs.unlink(filepath).catch(() => { });
}

async function exportTransactionsCSV(ctx, startDate = null, endDate = null) {
  const userId = ctx.from.id;

  if (!await isOwnerOrAdmin(userId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  let transactions = await db.getTransactions();
  const products = await db.getProducts();

  // Filter by date range if provided
  if (startDate) {
    transactions = transactions.filter(t => new Date(t.createdAt) >= new Date(startDate));
  }
  if (endDate) {
    transactions = transactions.filter(t => new Date(t.createdAt) <= new Date(endDate));
  }

  const data = transactions.map(t => {
    const prod = products.find(p => p.id === t.productId);
    return {
      OrderID: t.id,
      UserID: t.userId,
      ProductName: prod?.name.ms || 'Unknown',
      Price: t.price,
      Status: t.status,
      CreatedAt: new Date(t.createdAt).toISOString(),
      CompletedAt: t.completedAt ? new Date(t.completedAt).toISOString() : ''
    };
  });

  const headers = ['OrderID', 'UserID', 'ProductName', 'Price', 'Status', 'CreatedAt', 'CompletedAt'];
  const csv = arrayToCSV(data, headers);

  const filename = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
  const filepath = path.join('data', filename);

  await fs.writeFile(filepath, csv, 'utf8');

  const totalRevenue = transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.price || 0), 0);

  await ctx.replyWithDocument(
    { source: filepath, filename },
    {
      caption: lang === 'ms'
        ? `💰 Export Transaksi\n\n${transactions.length} transaksi\nJumlah: RM${totalRevenue.toFixed(2)}`
        : `💰 Transactions Export\n\n${transactions.length} transactions\nTotal: RM${totalRevenue.toFixed(2)}`
    }
  );

  await fs.unlink(filepath).catch(() => { });
}

async function exportUsersCSV(ctx) {
  const userId = ctx.from.id;

  if (!await isOwnerOrAdmin(userId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const users = await db.getUsers();
  const transactions = await db.getTransactions();

  const data = users.map(u => {
    const userOrders = transactions.filter(t => t.userId === u.id);
    const completedOrders = userOrders.filter(t => t.status === 'completed');
    const totalSpent = completedOrders.reduce((sum, t) => sum + (t.price || 0), 0);

    return {
      UserID: u.id,
      Username: u.username || '',
      FirstName: u.first_name || '',
      Language: u.language || 'ms',
      TotalOrders: userOrders.length,
      CompletedOrders: completedOrders.length,
      TotalSpent: totalSpent.toFixed(2),
      JoinedAt: new Date(u.createdAt).toISOString(),
      Banned: u.banned ? 'Yes' : 'No'
    };
  });

  const headers = ['UserID', 'Username', 'FirstName', 'Language', 'TotalOrders', 'CompletedOrders', 'TotalSpent', 'JoinedAt', 'Banned'];
  const csv = arrayToCSV(data, headers);

  const filename = `users_${new Date().toISOString().split('T')[0]}.csv`;
  const filepath = path.join('data', filename);

  await fs.writeFile(filepath, csv, 'utf8');

  await ctx.replyWithDocument(
    { source: filepath, filename },
    {
      caption: lang === 'ms'
        ? `👥 Export Pengguna\n\n${users.length} pengguna diexport`
        : `👥 Users Export\n\n${users.length} users exported`
    }
  );

  await fs.unlink(filepath).catch(() => { });
}

async function exportSalesReport(ctx) {
  const userId = ctx.from.id;

  if (!await isOwnerOrAdmin(userId)) {
    await ctx.reply('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const products = await db.getProducts();
  const transactions = await db.getTransactions();
  const categories = await db.getCategories();

  // Sales by product
  const productSales = products.map(p => {
    const orders = transactions.filter(t => t.productId === p.id && t.status === 'completed');
    const revenue = orders.reduce((sum, t) => sum + (t.price || 0), 0);
    const cat = categories.find(c => c.id === p.categoryId);

    return {
      ProductID: p.id,
      ProductName: p.name.ms,
      Category: cat?.name.ms || '',
      UnitsSold: orders.length,
      Revenue: revenue.toFixed(2),
      CurrentStock: p.stock,
      Status: p.active ? 'Active' : 'Inactive'
    };
  });

  const headers = ['ProductID', 'ProductName', 'Category', 'UnitsSold', 'Revenue', 'CurrentStock', 'Status'];
  const csv = arrayToCSV(productSales, headers);

  const filename = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
  const filepath = path.join('data', filename);

  await fs.writeFile(filepath, csv, 'utf8');

  const totalRevenue = productSales.reduce((sum, p) => sum + parseFloat(p.Revenue), 0);
  const totalUnits = productSales.reduce((sum, p) => sum + p.UnitsSold, 0);

  await ctx.replyWithDocument(
    { source: filepath, filename },
    {
      caption: lang === 'ms'
        ? `📈 Laporan Jualan\n\n💰 Jumlah: RM${totalRevenue.toFixed(2)}\n📦 Unit Dijual: ${totalUnits}`
        : `📈 Sales Report\n\n💰 Total: RM${totalRevenue.toFixed(2)}\n📦 Units Sold: ${totalUnits}`
    }
  );

  await fs.unlink(filepath).catch(() => { });
}

async function handleExportMenu(ctx) {
  const userId = ctx.from.id;

  if (!await isOwnerOrAdmin(userId)) {
    await ctx.answerCbQuery('❌ Unauthorized');
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const { safeEditMessage } = require('../utils/messageHelper');
  const { Markup } = require('telegraf');

  const text = lang === 'ms'
    ? '📊 *Export Data*\n\nPilih jenis data untuk export dalam format CSV:'
    : '📊 *Export Data*\n\nSelect data type to export in CSV format:';

  const buttons = [
    [Markup.button.callback(lang === 'ms' ? '📦 Export Produk' : '📦 Export Products', 'export_products')],
    [Markup.button.callback(lang === 'ms' ? '💰 Export Transaksi' : '💰 Export Transactions', 'export_transactions')],
    [Markup.button.callback(lang === 'ms' ? '👥 Export Pengguna' : '👥 Export Users', 'export_users')],
    [Markup.button.callback(lang === 'ms' ? '📈 Laporan Jualan' : '📈 Sales Report', 'export_sales')],
    [Markup.button.callback(lang === 'ms' ? '🔙 Kembali' : '🔙 Back', 'admin_panel')]
  ];

  await safeEditMessage(ctx, text, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(buttons)
  });
}

module.exports = {
  exportProductsCSV,
  exportTransactionsCSV,
  exportUsersCSV,
  exportSalesReport,
  handleExportMenu
};
