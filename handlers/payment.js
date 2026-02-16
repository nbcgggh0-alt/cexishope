const db = require('../utils/database');
const { t } = require('../utils/translations');
const { Markup } = require('telegraf');

// Database-backed state for payment proofs (survives bot restart)
// Map<userId, { fileId, isDocument }>
const pendingProofState = new Map();

async function handleSendPayment(ctx) {
  const userId = ctx.from.id;
  const orderId = ctx.message.text.split(' ')[1];

  if (!orderId) {
    await ctx.reply('❌ Invalid command format.\n\nUsage: /send [order_id]\n\nExample: /send ORD-ABC123');
    return;
  }

  const order = await db.getTransaction(orderId);

  if (!order || order.userId !== userId) {
    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';
    const msg = lang === 'ms'
      ? `❌ Pesanan tidak dijumpai atau bukan milik anda!\n\n🆔 Order ID: \`${orderId}\`\n\n💡 Tip: Gunakan "Pesanan Saya" di menu utama untuk lihat order anda.`
      : `❌ Order not found or does not belong to you!\n\n🆔 Order ID: \`${orderId}\`\n\n💡 Tip: Use "My Orders" in main menu to view your orders.`;
    await ctx.reply(msg, { parse_mode: 'Markdown' });
    return;
  }

  let photo = null;
  let document = null;

  if (ctx.message.photo) {
    photo = ctx.message.photo[ctx.message.photo.length - 1];
  } else if (ctx.message.reply_to_message?.photo) {
    photo = ctx.message.reply_to_message.photo[ctx.message.reply_to_message.photo.length - 1];
  } else if (ctx.message.document && ctx.message.document.mime_type?.startsWith('image/')) {
    document = ctx.message.document;
  } else if (ctx.message.reply_to_message?.document && ctx.message.reply_to_message.document.mime_type?.startsWith('image/')) {
    document = ctx.message.reply_to_message.document;
  }

  if (!photo && !document) {
    const user = await db.getUser(userId);
    const lang = user?.language || 'ms';
    const message = lang === 'ms'
      ? `📸 *Cara Hantar Bukti Pembayaran:*

📱 *Cara 1 (Mudah):*
1. Ambil screenshot resit pembayaran
2. Hantar gambar dengan caption \`/send\`

📱 *Cara 2:*
1. Hantar gambar resit dahulu
2. Reply gambar tersebut
3. Taip: \`/send\`

⚠️ *Penting:*
• Pastikan gambar jelas dan boleh dibaca
• Pastikan jumlah pembayaran betul
• Admin akan sahkan dalam 5-10 minit

💡 Jika ada masalah, hubungi support!`
      : `📸 *How to Send Payment Proof:*

📱 *Method 1 (Easy):*
1. Take screenshot of payment receipt
2. Send photo with caption \`/send\`

📱 *Method 2:*
1. Send receipt photo first
2. Reply to that photo
3. Type: \`/send\`

⚠️ *Important:*
• Ensure photo is clear and readable
• Ensure payment amount is correct
• Admin will verify within 5-10 minutes

💡 If you have issues, contact support!`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }

  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';
  const transactions = await db.getTransactions();
  const pendingOrders = transactions.filter(t => t.userId === userId && t.status === 'pending' && !t.paymentProof);

  if (pendingOrders.length === 0) {
    const message = lang === 'ms'
      ? `❌ *Tiada Order Pending*

Anda tidak mempunyai order yang menunggu pembayaran.

📝 *Langkah Seterusnya:*
1️⃣ Buat order baru dahulu
2️⃣ Lengkapkan pembayaran
3️⃣ Kemudian hantar bukti pembayaran

🛒 Tekan /start untuk ke menu utama dan buat order.`
      : `❌ *No Pending Order*

You don't have any orders waiting for payment.

📝 *Next Steps:*
1️⃣ Create a new order first
2️⃣ Complete payment
3️⃣ Then send payment proof

🛒 Press /start to go to main menu and create order.`;
    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }

  if (pendingOrders.length > 1) {
    const message = lang === 'ms'
      ? `📋 *Pilih Order untuk Bayar*\n\nAnda mempunyai ${pendingOrders.length} order yang menunggu pembayaran.\nSila pilih order:`
      : `📋 *Select Order to Pay*\n\nYou have ${pendingOrders.length} pending orders.\nPlease select an order:`;

    const buttons = pendingOrders.map(order => {
      const productName = typeof order.productName === 'object'
        ? (order.productName.ms || order.productName.en)
        : order.productName;
      return [Markup.button.callback(
        `${order.id} - ${productName} (RM${order.price})`,
        `send_payment_${order.id}`
      )];
    });

    // Use Map instead of ctx.session (survives bot restart)
    pendingProofState.set(userId, {
      fileId: photo?.file_id || document?.file_id,
      isDocument: !!document
    });

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
    return;
  }

  const pendingOrder = pendingOrders[0];

  // ATOMIC UPDATE — no more full table overwrite
  await db.updateTransaction(pendingOrder.id, {
    paymentProof: photo?.file_id || document?.file_id,
    status: 'awaiting_verification',
    paymentSubmittedAt: new Date().toISOString()
  });

  const successMessage = lang === 'ms'
    ? `✅ *Bukti Pembayaran Diterima!*

🆔 Order ID: \`${pendingOrder.id}\`
⏰ Diserahkan: ${new Date().toLocaleString('ms-MY')}

Admin kami akan sahkan pembayaran anda tidak lama lagi (biasanya dalam 5-10 minit).

Anda akan terima notifikasi sebaik sahaja order disahkan!

💬 Ada soalan? Hubungi support kami.`
    : `✅ *Payment Proof Received!*

🆔 Order ID: \`${pendingOrder.id}\`
⏰ Submitted: ${new Date().toLocaleString('en-MY')}

Our admin will verify your payment shortly (usually within 5-10 minutes).

You will receive a notification once the order is verified!

💬 Any questions? Contact our support.`;

  await ctx.reply(successMessage, { parse_mode: 'Markdown' });

  await sendPaymentProofToAdmins(ctx, pendingOrder, userId, photo, document);
}

async function handlePaymentSelection(ctx, orderId) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const order = await db.getTransaction(orderId);

  if (!order || order.userId !== userId || order.status !== 'pending') {
    await ctx.answerCbQuery(lang === 'ms' ? '❌ Order tidak sah' : '❌ Invalid order');
    return;
  }

  // Use Map instead of ctx.session
  const proofData = pendingProofState.get(userId);

  if (!proofData) {
    await ctx.answerCbQuery(lang === 'ms' ? '❌ Bukti pembayaran tidak dijumpai. Sila cuba semula.' : '❌ Payment proof not found. Please try again.');
    return;
  }

  // ATOMIC UPDATE — no more full table overwrite
  await db.updateTransaction(orderId, {
    paymentProof: proofData.fileId,
    status: 'awaiting_verification',
    paymentSubmittedAt: new Date().toISOString()
  });

  // Clean up state
  pendingProofState.delete(userId);

  const successMessage = lang === 'ms'
    ? `✅ *Bukti Pembayaran Diterima!*

🆔 Order ID: \`${orderId}\`
⏰ Diserahkan: ${new Date().toLocaleString('ms-MY')}

Admin kami akan sahkan pembayaran anda tidak lama lagi (biasanya dalam 5-10 minit).

Anda akan terima notifikasi sebaik sahaja order disahkan!

💬 Ada soalan? Hubungi support kami.`
    : `✅ *Payment Proof Received!*

🆔 Order ID: \`${orderId}\`
⏰ Submitted: ${new Date().toLocaleString('en-MY')}

Our admin will verify your payment shortly (usually within 5-10 minutes).

You will receive a notification once the order is verified!

💬 Any questions? Contact our support.`;

  await ctx.answerCbQuery(lang === 'ms' ? '✅ Bukti diterima' : '✅ Proof received');
  await ctx.reply(successMessage, { parse_mode: 'Markdown' });

  const photo = !proofData.isDocument ? { file_id: proofData.fileId } : null;
  const document = proofData.isDocument ? { file_id: proofData.fileId } : null;

  await sendPaymentProofToAdmins(ctx, order, userId, photo, document);
}

async function sendPaymentProofToAdmins(ctx, order, userId, photo, document) {
  const admins = await db.getAdmins();
  const allAdmins = [admins.owner, ...admins.admins].filter(Boolean);

  let voucherInfo = '';
  if (order.voucherCode && order.discount != null && order.originalPrice != null) {
    voucherInfo = `\n💳 Voucher: ${order.voucherCode}\n💰 Original: RM${order.originalPrice}\n🎉 Discount: -RM${order.discount.toFixed(2)}\n✅ Final: RM${order.price.toFixed(2)}`;
  } else {
    const amount = typeof order.price === 'number' ? order.price.toFixed(2) : order.price;
    voucherInfo = `\n💰 Amount: RM${amount}`;
  }

  const productName = typeof order.productName === 'object'
    ? (order.productName.ms || order.productName.en || 'Product')
    : (order.productName || 'Product');

  // Layer 2: Enhanced admin notification with customer order summary
  const allTransactions = await db.getTransactions();
  const customerOrders = allTransactions.filter(t => t.userId === userId);
  const pendingNoProof = customerOrders.filter(t =>
    t.status === 'pending' && !t.paymentProof
  );

  let orderSummary = '';
  if (customerOrders.length > 1) {
    orderSummary = `\n\n📋 *Semua Order Customer:*\n`;
    customerOrders.forEach(o => {
      const pName = typeof o.productName === 'object'
        ? (o.productName.ms || Object.values(o.productName)[0])
        : o.productName;
      const icon = o.paymentProof ? '✅' : '❌';
      orderSummary += `${icon} \`${o.id}\` — ${pName} (RM${o.price})\n`;
    });
    if (pendingNoProof.length > 0) {
      orderSummary += `\n⚠️ *${pendingNoProof.length} order belum ada bukti!*`;
    }
  }

  const caption = `💳 *Payment Proof Received*\n\n🆔 Order ID: \`${order.id}\`\n👤 Customer ID: \`${userId}\`\n📦 Product: ${productName}${voucherInfo}\n⏰ Time: ${new Date().toLocaleString('ms-MY')}${orderSummary}`;

  const buttons = Markup.inlineKeyboard([
    [Markup.button.callback(`✅ Verify ${order.id}`, `verify_order_${order.id}`)],
    [Markup.button.callback(`❌ Reject ${order.id}`, `reject_order_${order.id}`)]
  ]);

  for (const adminId of allAdmins) {
    try {
      if (photo) {
        await ctx.telegram.sendPhoto(adminId, photo.file_id, {
          caption,
          parse_mode: 'Markdown',
          ...buttons
        });
      } else if (document) {
        await ctx.telegram.sendDocument(adminId, document.file_id, {
          caption,
          parse_mode: 'Markdown',
          ...buttons
        });
      }
    } catch (error) {
      console.error(`Failed to notify admin ${adminId}:`, error.message);
    }
  }
}

async function handleViewPendingOrders(ctx) {
  const userId = ctx.from.id;
  const user = await db.getUser(userId);
  const lang = user?.language || 'ms';

  const transactions = await db.getTransactions();
  const pendingOrders = transactions.filter(t => t.userId === userId && t.status === 'pending');

  if (pendingOrders.length === 0) {
    const message = lang === 'ms'
      ? '✅ *Tiada Order Pending*\n\nAnda tidak mempunyai order yang menunggu pembayaran.'
      : '✅ *No Pending Orders*\n\nYou have no orders waiting for payment.';

    await ctx.reply(message, { parse_mode: 'Markdown' });
    return;
  }

  let message = lang === 'ms'
    ? `📋 *Order Pending Pembayaran*\n\nAnda mempunyai ${pendingOrders.length} order:\n\n`
    : `📋 *Orders Pending Payment*\n\nYou have ${pendingOrders.length} orders:\n\n`;

  pendingOrders.forEach((order, index) => {
    const productName = typeof order.productName === 'object'
      ? (order.productName.ms || order.productName.en)
      : order.productName;
    const proofIcon = order.paymentProof ? '✅ Bukti dihantar' : '❌ Belum bayar';

    message += `${index + 1}. 🆔 \`${order.id}\`\n`;
    message += `   📦 ${productName}\n`;
    message += `   💰 RM${order.price}\n`;
    message += `   📊 ${proofIcon}\n`;
    message += `   📅 ${new Date(order.createdAt).toLocaleString(lang === 'ms' ? 'ms-MY' : 'en-MY')}\n\n`;
  });

  message += lang === 'ms'
    ? '\n💡 *Hantar bukti pembayaran:*\n1. Ambil screenshot resit\n2. Hantar gambar dengan caption `/send`'
    : '\n💡 *Send payment proof:*\n1. Take screenshot of receipt\n2. Send photo with caption `/send`';

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

module.exports = {
  handleSendPayment,
  handlePaymentSelection,
  handleViewPendingOrders
};