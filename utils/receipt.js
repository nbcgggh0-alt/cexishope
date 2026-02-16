const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { formatDate, formatPrice } = require('./helpers');

async function generateReceipt(transaction, product, user) {
  const doc = new PDFDocument({ margin: 50 });
  const fileName = `receipt-${transaction.id}.pdf`;
  const filePath = path.join('logs', fileName);
  
  const writeStream = fs.createWriteStream(filePath);
  doc.pipe(writeStream);
  
  doc.fontSize(20).text('CexiStore Ultimate Pro', { align: 'center' });
  doc.fontSize(12).text('Digital Store Receipt', { align: 'center' });
  doc.moveDown();
  
  doc.fontSize(10).text(`Receipt Date: ${formatDate(new Date())}`, { align: 'right' });
  doc.moveDown();
  
  doc.fontSize(14).text('Order Details', { underline: true });
  doc.fontSize(10).moveDown(0.5);
  doc.text(`Order ID: ${transaction.id}`);
  doc.text(`Customer ID: ${user.id}`);
  doc.text(`Customer Name: ${user.firstName} ${user.lastName || ''}`);
  doc.moveDown();
  
  doc.fontSize(14).text('Product Information', { underline: true });
  doc.fontSize(10).moveDown(0.5);
  doc.text(`Product: ${product.name.ms || product.name}`);
  doc.text(`Price: ${formatPrice(transaction.price)}`);
  doc.text(`Order Date: ${formatDate(transaction.createdAt)}`);
  doc.moveDown();
  
  doc.fontSize(14).text('Payment Information', { underline: true });
  doc.fontSize(10).moveDown(0.5);
  doc.text(`Status: ${transaction.status.toUpperCase()}`);
  doc.text(`Total Amount: ${formatPrice(transaction.price)}`);
  doc.moveDown();
  
  if (transaction.deliveredItem) {
    doc.fontSize(14).text('Delivered Item', { underline: true });
    doc.fontSize(10).moveDown(0.5);
    doc.text(transaction.deliveredItem);
    doc.moveDown();
  }
  
  doc.fontSize(8).text('Thank you for your purchase!', { align: 'center' });
  doc.text('For support, contact us via the bot.', { align: 'center' });
  
  doc.end();
  
  return new Promise((resolve, reject) => {
    writeStream.on('finish', () => resolve(filePath));
    writeStream.on('error', reject);
  });
}

module.exports = { generateReceipt };
