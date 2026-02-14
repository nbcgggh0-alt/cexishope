const supabase = require('./supabase');

// Helper to convert camelCase to snake_case
const toSnake = (str) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

// Helper to convert snake_case to camelCase
const toCamel = (str) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

const mapKeys = (obj, mapper) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.keys(obj).reduce((acc, key) => {
    acc[mapper(key)] = obj[key];
    return acc;
  }, {});
};

const toDb = (obj) => mapKeys(obj, toSnake);
const fromDb = (obj) => mapKeys(obj, toCamel);

// Retry wrapper for DB operations — retries on network/timeout, skips on constraint violations
async function withRetry(fn, retries = 2, delay = 500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const code = err?.code || '';
      // Don't retry constraint violations (23xxx) or permission errors (42xxx)
      if (code.startsWith('23') || code.startsWith('42')) throw err;
      if (attempt === retries) throw err;
      console.warn(`DB retry ${attempt + 1}/${retries}: ${err.message}`);
      await new Promise(r => setTimeout(r, delay * Math.pow(2, attempt)));
    }
  }
}

class Database {
  constructor() {
    this.cache = {};
  }

  // --- Generic Sync Helper ---
  async syncTable(tableName, items, idField = 'id') {
    if (!items || !Array.isArray(items)) return false;

    try {
      const dbItems = items.map(item => toDb(item));
      const snakeIdField = toSnake(idField);
      const currentIds = items.map(i => i[idField]).filter(id => id !== undefined && id !== null);

      // Upsert all items (updates existing, inserts new)
      if (dbItems.length > 0) {
        const { error: upsertError } = await supabase
          .from(tableName)
          .upsert(dbItems);

        if (upsertError) {
          console.error(`Error upserting to ${tableName}:`, upsertError.message);
          return false;
        }
      }

      // Delete items NOT in the current list (full sync)
      if (currentIds.length > 0) {
        const idTuple = `(${currentIds.map(id => typeof id === 'string' ? `"${id}"` : id).join(',')})`;
        const { error: deleteError } = await supabase
          .from(tableName)
          .delete()
          .not(snakeIdField, 'in', idTuple);

        if (deleteError) {
          console.error(`Error deleting from ${tableName}:`, deleteError.message);
        }
      } else if (items.length === 0) {
        // Empty list = clear the table
        await supabase.from(tableName).delete().not(snakeIdField, 'is', null);
      }

      return true;
    } catch (error) {
      console.error(`Error syncing ${tableName}:`, error.message);
      return false;
    }
  }

  async getAll(tableName) {
    const { data, error } = await supabase.from(tableName).select('*');
    if (error) {
      console.error(`Error fetching ${tableName}:`, error.message);
      return [];
    }
    return data.map(item => fromDb(item));
  }

  // --- Users ---
  async getUsers() { return await this.getAll('cexi_users'); }
  async saveUsers(users) { return await this.syncTable('cexi_users', users); }

  async getUser(userId) {
    // Optimization: query directly
    const { data, error } = await supabase.from('cexi_users').select('*').eq('id', userId).single();
    if (error || !data) return null;
    return fromDb(data);
  }

  async addUser(user) {
    // Direct insert optimization
    const dbUser = toDb(user);
    if (!dbUser.created_at) dbUser.created_at = new Date().toISOString();

    // Check if exists? Upsert handles it.
    const { data, error } = await supabase
      .from('cexi_users')
      .upsert(dbUser)
      .select()
      .single();

    if (error) {
      console.error('Error adding user:', error.message);
      return null; // or user
    }
    return fromDb(data);
  }

  async updateUser(userId, updates) {
    // Only update specific fields
    const dbUpdates = toDb(updates);
    const { data, error } = await supabase
      .from('cexi_users')
      .update(dbUpdates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error.message);
      return null;
    }
    return fromDb(data);
  }

  // --- Products ---
  async getProducts() { return await this.getAll('cexi_products'); }
  async saveProducts(products) { return await this.syncTable('cexi_products', products); }

  async updateProduct(id, updates) {
    return withRetry(async () => {
      const dbUpdates = toDb(updates);
      const { data, error } = await supabase
        .from('cexi_products')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`Error updating product ${id}:`, error.message);
        if (!error.code?.startsWith('23') && !error.code?.startsWith('42')) throw error;
        return null;
      }
      return fromDb(data);
    });
  }

  async addProduct(product) {
    return withRetry(async () => {
      const dbProduct = toDb(product);
      const { data, error } = await supabase
        .from('cexi_products')
        .upsert(dbProduct)
        .select()
        .single();

      if (error) {
        console.error('Error adding product:', error.message);
        if (!error.code?.startsWith('23') && !error.code?.startsWith('42')) throw error;
        return null;
      }
      return fromDb(data);
    });
  }

  async deleteProduct(id) {
    return withRetry(async () => {
      const { error } = await supabase
        .from('cexi_products')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`Error deleting product ${id}:`, error.message);
        if (!error.code?.startsWith('23') && !error.code?.startsWith('42')) throw error;
        return false;
      }
      return true;
    });
  }

  // --- Categories ---
  async getCategories() { return await this.getAll('cexi_categories'); }
  async saveCategories(categories) { return await this.syncTable('cexi_categories', categories); }

  // --- Transactions ---
  async getTransactions() { return await this.getAll('cexi_transactions'); }
  async saveTransactions(transactions) { return await this.syncTable('cexi_transactions', transactions); }

  async updateTransaction(id, updates) {
    return withRetry(async () => {
      const dbUpdates = toDb(updates);
      const { data, error } = await supabase
        .from('cexi_transactions')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error(`Error updating transaction ${id}:`, error.message);
        if (!error.code?.startsWith('23') && !error.code?.startsWith('42')) throw error;
        return null;
      }
      return fromDb(data);
    });
  }

  async getTransaction(id) {
    const { data, error } = await supabase
      .from('cexi_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return fromDb(data);
  }

  async addTransaction(transaction) {
    return withRetry(async () => {
      const dbTx = toDb(transaction);
      const { data, error } = await supabase
        .from('cexi_transactions')
        .upsert(dbTx)
        .select()
        .single();

      if (error) {
        console.error('Error adding transaction:', error.message);
        if (!error.code?.startsWith('23') && !error.code?.startsWith('42')) throw error;
        return null;
      }
      return fromDb(data);
    });
  }

  async deleteTransaction(id) {
    return withRetry(async () => {
      const { error } = await supabase
        .from('cexi_transactions')
        .delete()
        .eq('id', id);

      if (error) {
        console.error(`Error deleting transaction ${id}:`, error.message);
        if (!error.code?.startsWith('23') && !error.code?.startsWith('42')) throw error;
        return false;
      }
      return true;
    });
  }

  // --- Sessions ---
  // --- Sessions ---
  async getSessions() { return await this.getAll('cexi_sessions', 'token'); }
  async saveSessions(sessions) { return await this.syncTable('cexi_sessions', sessions, 'token'); }

  // Optimized Session Methods
  async getSession(token) {
    const { data, error } = await supabase
      .from('cexi_sessions')
      .select('*')
      .eq('token', token)
      .single();
    if (error || !data) return null;
    return fromDb(data);
  }

  async getActiveSessionByUserId(userId) {
    const { data, error } = await supabase
      .from('cexi_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();
    if (error) return null; // No active session or error
    return fromDb(data);
  }

  async getActiveSessionsByAdminId(adminId) {
    const { data, error } = await supabase
      .from('cexi_sessions')
      .select('*')
      .eq('admin_id', adminId)
      .eq('status', 'active');
    if (error) return [];
    return data.map(s => fromDb(s));
  }

  async saveSession(session) {
    // Save a SINGLE session
    const dbSession = toDb(session);
    const { error } = await supabase
      .from('cexi_sessions')
      .upsert(dbSession);

    if (error) {
      console.error('Error saving session:', error.message);
      return false;
    }
    return true;
  }

  async addSessionMessage(token, message) {
    // Atomic update for messages array would be best, but Supabase JS doesn't support easy array_append directly on update without RPC or raw SQL?
    // Actually we can fetching, pushing, and saving single is better than saving ALL sessions.

    // Better: use Postgres function if available, but here we will just fetch-update-save SINGLE row.
    const session = await this.getSession(token);
    if (!session) return false;

    // Initialize messages if null
    if (!session.messages) session.messages = [];

    session.messages.push(message);

    // Update only messages column
    const { error } = await supabase
      .from('cexi_sessions')
      .update({ messages: session.messages })
      .eq('token', token);

    if (error) {
      console.error('Error adding session message:', error.message);
      return false;
    }
    return true;
  }

  // --- Admins ---
  async getAdmins() {
    // Special case: admins.json structure was { owner: ..., admins: [] }
    // DB table: user_id, role.
    // We need to reconstruct the object.
    const { data, error } = await supabase.from('cexi_admins').select('*');
    if (error) return { owner: null, admins: [] };

    const owner = data.find(r => r.role === 'owner')?.user_id;
    const adminIds = data.filter(r => r.role === 'admin').map(r => r.user_id);

    return { owner, admins: adminIds };
  }

  async saveAdmins(adminsObj) {
    // Convert object { owner, admins: [] } to rows
    const rows = [];
    if (adminsObj.owner) rows.push({ user_id: adminsObj.owner, role: 'owner' });
    if (adminsObj.admins) {
      adminsObj.admins.forEach(id => rows.push({ user_id: id, role: 'admin' }));
    }
    return await this.syncTable('cexi_admins', rows, 'user_id');
  }

  // --- Settings ---
  async getSettings() {
    // Settings table: key, value (jsonb)
    // Return object { key: value, ... } to match JSON behavior
    const { data, error } = await supabase.from('cexi_settings').select('*');
    if (error) return {};
    return data.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  async saveSettings(settingsObj) {
    // settingsObj is { key: value }
    const rows = Object.entries(settingsObj).map(([key, value]) => ({ key, value }));
    return await this.syncTable('cexi_settings', rows, 'key');
  }

  // --- Vouchers ---
  async getVouchers() { return await this.getAll('cexi_vouchers'); }
  async saveVouchers(vouchers) { return await this.syncTable('cexi_vouchers', vouchers, 'code'); }

  async getVoucher(code) {
    const { data, error } = await supabase
      .from('cexi_vouchers')
      .select('*')
      .ilike('code', code) // Case insensitive match? JSON was case insensitive manual check
      .single();
    if (error) return null;
    return fromDb(data);
  }

  // --- Admin Permissions ---
  async getAdminPermissions(adminId) {
    const { data } = await supabase
      .from('cexi_admin_permissions')
      .select('permissions')
      .eq('admin_id', adminId)
      .single();
    return data?.permissions || [];
  }

  async saveAdminPermissions(adminId, permissions) {
    const { error } = await supabase
      .from('cexi_admin_permissions')
      .upsert({ admin_id: adminId, permissions });
    if (error) console.error('Error saving permissions:', error.message);
    return !error;
  }

  // --- Admin Logs ---
  async getAdminLogs() { return await this.getAll('cexi_admin_logs'); }
  async logAdminAction(log) {
    const dbLog = toDb(log);
    const { error } = await supabase.from('cexi_admin_logs').insert(dbLog);
    if (error) console.error('Error logging admin action:', error.message);
    return !error;
  }

  // --- Feedbacks ---
  async getFeedbacks() { return await this.getAll('cexi_feedbacks'); }
  async saveFeedbacks(feedbacks) { return await this.syncTable('cexi_feedbacks', feedbacks); }

  // --- Inventory Logs ---
  async getInventoryLogs() { return await this.getAll('cexi_inventory_logs'); }
  async saveInventoryLogs(logs) { return await this.syncTable('cexi_inventory_logs', logs); }

  // --- Templates (Quick Replies) ---
  async getTemplates() { return await this.getAll('cexi_templates'); }
  async saveTemplates(templates) { return await this.syncTable('cexi_templates', templates); }

  // --- FAQs ---
  async getFAQs() { return await this.getAll('cexi_faqs'); }
  async saveFAQs(faqs) { return await this.syncTable('cexi_faqs', faqs); }

  // --- Campaigns ---
  async getCampaigns() { return await this.getAll('cexi_campaigns'); }
  async saveCampaigns(campaigns) { return await this.syncTable('cexi_campaigns', campaigns); }

  // --- Scheduled Messages ---
  async getScheduledMessages() { return await this.getAll('cexi_scheduled_messages'); }
  async saveScheduledMessages(messages) { return await this.syncTable('cexi_scheduled_messages', messages); }

  // --- Promo Templates ---
  async getPromoTemplates() { return await this.getAll('cexi_promo_templates'); }
  async savePromoTemplates(templates) { return await this.syncTable('cexi_promo_templates', templates); }

  // --- Discount Codes ---
  async getDiscountCodes() { return await this.getAll('cexi_discount_codes'); }
  async saveDiscountCodes(codes) { return await this.syncTable('cexi_discount_codes', codes, 'code'); }

  // --- Flash Sales ---
  async getFlashSales() { return await this.getAll('cexi_flash_sales'); }
  async saveFlashSales(sales) { return await this.syncTable('cexi_flash_sales', sales); }

  // --- Repeat Campaigns ---
  async getRepeatCampaigns() { return await this.getAll('cexi_repeat_campaigns'); }
  async saveRepeatCampaigns(campaigns) { return await this.syncTable('cexi_repeat_campaigns', campaigns); }

  // --- AB Tests ---
  async getABTests() { return await this.getAll('cexi_ab_tests'); }
  async saveABTests(tests) { return await this.syncTable('cexi_ab_tests', tests); }

  // --- Pterodactyl Panels ---
  async getPteroPanels() { return await this.getAll('cexi_ptero_panels'); }

  async addPteroPanel(panel) {
    return withRetry(async () => {
      const dbPanel = toDb(panel);
      const { data, error } = await supabase
        .from('cexi_ptero_panels')
        .insert(dbPanel)
        .select()
        .single();
      if (error) { console.error('Error adding ptero panel:', error.message); return null; }
      return fromDb(data);
    });
  }

  async updatePteroPanel(id, updates) {
    return withRetry(async () => {
      const dbUpdates = toDb(updates);
      const { data, error } = await supabase
        .from('cexi_ptero_panels')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      if (error) { console.error('Error updating ptero panel:', error.message); return null; }
      return fromDb(data);
    });
  }

  async deletePteroPanel(id) {
    return withRetry(async () => {
      const { error } = await supabase
        .from('cexi_ptero_panels')
        .delete()
        .eq('id', id);
      if (error) { console.error('Error deleting ptero panel:', error.message); return false; }
      return true;
    });
  }

}

module.exports = new Database();
