const db = require('../utils/database');
const cron = require('node-cron');

let alertsInitialized = false;
let botInstance = null;

async function initializeStockAlerts(bot) {
  if (alertsInitialized) return;
  
  botInstance = bot;
  
  // Check stock every hour
  cron.schedule('0 * * * *', async () => {
    await checkAndSendStockAlerts();
  });
  
  // Check stock every 6 hours for critical alerts
  cron.schedule('0 */6 * * *', async () => {
    await checkCriticalStockAlerts();
  });
  
  alertsInitialized = true;
  console.log('✅ Stock alert system initialized');
}

async function checkAndSendStockAlerts() {
  try {
    const products = await db.getProducts();
    const admins = await db.getAdmins();
    
    const lowStockProducts = products.filter(p => p.stock > 0 && p.stock < 5 && p.active);
    
    if (lowStockProducts.length === 0) return;
    
    const allAdmins = [admins.owner, ...admins.admins].filter(Boolean);
    
    let message = `⚠️ *Low Stock Alert*\n\n${lowStockProducts.length} products have low stock (<5 units):\n\n`;
    
    lowStockProducts.forEach(prod => {
      message += `📦 ${prod.name.ms}\n`;
      message += `📊 Stock: ${prod.stock} units\n`;
      message += `🆔 ${prod.id}\n\n`;
    });
    
    message += '_This is an automated alert. Use /adjuststock to update stock levels._';
    
    for (const adminId of allAdmins) {
      try {
        await botInstance.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(`Failed to send stock alert to admin ${adminId}:`, error.message);
      }
    }
    
    console.log(`📊 Sent low stock alerts for ${lowStockProducts.length} products`);
  } catch (error) {
    console.error('Error in stock alert system:', error);
  }
}

async function checkCriticalStockAlerts() {
  try {
    const products = await db.getProducts();
    const admins = await db.getAdmins();
    
    const outOfStockProducts = products.filter(p => p.stock === 0 && p.active);
    
    if (outOfStockProducts.length === 0) return;
    
    const allAdmins = [admins.owner, ...admins.admins].filter(Boolean);
    
    let message = `🚨 *CRITICAL: Out of Stock Alert*\n\n${outOfStockProducts.length} active products are OUT OF STOCK:\n\n`;
    
    outOfStockProducts.forEach(prod => {
      message += `📦 ${prod.name.ms}\n`;
      message += `💰 RM${prod.price}\n`;
      message += `🆔 ${prod.id}\n\n`;
    });
    
    message += '⚠️ *URGENT ACTION REQUIRED*\n';
    message += '_These products are active but cannot be sold. Please restock or deactivate them._';
    
    for (const adminId of allAdmins) {
      try {
        await botInstance.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(`Failed to send critical stock alert to admin ${adminId}:`, error.message);
      }
    }
    
    console.log(`🚨 Sent critical stock alerts for ${outOfStockProducts.length} products`);
  } catch (error) {
    console.error('Error in critical stock alert system:', error);
  }
}

async function sendManualStockAlert(bot, adminId) {
  try {
    const products = await db.getProducts();
    const lowStockProducts = products.filter(p => p.stock > 0 && p.stock < 5 && p.active);
    const outOfStockProducts = products.filter(p => p.stock === 0 && p.active);
    
    let message = `📊 *Stock Status Report*\n\n`;
    
    if (outOfStockProducts.length > 0) {
      message += `🚨 *OUT OF STOCK (${outOfStockProducts.length})*\n`;
      outOfStockProducts.slice(0, 5).forEach(prod => {
        message += `  • ${prod.name.ms} (${prod.id})\n`;
      });
      if (outOfStockProducts.length > 5) {
        message += `  _...and ${outOfStockProducts.length - 5} more_\n`;
      }
      message += `\n`;
    }
    
    if (lowStockProducts.length > 0) {
      message += `⚠️ *LOW STOCK (${lowStockProducts.length})*\n`;
      lowStockProducts.slice(0, 5).forEach(prod => {
        message += `  • ${prod.name.ms}: ${prod.stock} units (${prod.id})\n`;
      });
      if (lowStockProducts.length > 5) {
        message += `  _...and ${lowStockProducts.length - 5} more_\n`;
      }
    }
    
    if (lowStockProducts.length === 0 && outOfStockProducts.length === 0) {
      message += `✅ All products have sufficient stock!`;
    }
    
    await bot.telegram.sendMessage(adminId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error sending manual stock alert:', error);
    throw error;
  }
}

module.exports = {
  initializeStockAlerts,
  checkAndSendStockAlerts,
  checkCriticalStockAlerts,
  sendManualStockAlert
};
