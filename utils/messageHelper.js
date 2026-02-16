const { Markup } = require('telegraf');

/**
 * Safely edit a message - handles both text and media messages
 * If editing fails (e.g., trying to edit a photo message), sends a new message instead
 */
async function safeEditMessage(ctx, text, options = {}) {
  try {
    // Try to edit the message text
    await ctx.editMessageText(text, options);
    // Answer callback query on success to improve UX
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery().catch(() => {});
    }
  } catch (error) {
    const errorMsg = error.response?.description || error.message || '';
    
    // If message is not modified (same text), just answer callback and return
    if (errorMsg.includes('message is not modified')) {
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery().catch(() => {});
      }
      return;
    }
    
    // If editing fails (e.g., message is a photo/video), delete old message and send new one
    if (errorMsg.includes('no text in the message to edit') || 
        errorMsg.includes('message to edit not found') ||
        errorMsg.includes('message can\'t be edited')) {
      try {
        // Answer callback query first to remove loading state
        if (ctx.callbackQuery) {
          await ctx.answerCbQuery().catch(() => {});
        }
        
        // Delete the old message if possible
        if (ctx.callbackQuery?.message?.message_id) {
          try {
            await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
          } catch (deleteErr) {
            console.log('Could not delete old message:', deleteErr.message);
          }
        }
        
        // Send new message
        await ctx.reply(text, options);
      } catch (fallbackErr) {
        console.error('safeEditMessage fallback error:', fallbackErr.message);
        // Last resort: just send the message without options
        try {
          await ctx.reply(text);
        } catch (finalErr) {
          console.error('safeEditMessage final fallback failed:', finalErr.message);
        }
      }
    } else {
      // Log unexpected errors but don't crash
      console.error('safeEditMessage unexpected error:', errorMsg);
      // Try to at least answer the callback query
      if (ctx.callbackQuery) {
        await ctx.answerCbQuery('Error occurred').catch(() => {});
      }
      throw error;
    }
  }
}

module.exports = {
  safeEditMessage
};
