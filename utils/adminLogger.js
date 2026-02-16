const db = require('./database');

async function logAdminAction(adminId, action, details = '') {
  try {
    const log = {
      id: `LOG-${Date.now()}`,
      adminId,
      action,
      details,
      timestamp: new Date().toISOString()
    };

    await db.logAdminAction(log);
    return log;
  } catch (error) {
    console.error('Failed to log admin action:', error);
    return null;
  }
}

async function getAdminLogs(limit = 50) {
  try {
    const logs = await db.getAdminLogs() || [];
    return {
      logs: logs.slice(-limit).reverse(),
      total: logs.length
    };
  } catch (error) {
    console.error('Failed to get admin logs:', error);
    return { logs: [], total: 0 };
  }
}

async function clearAdminLogs() {
  try {
    // Save empty array to clear all logs
    const logs = await db.getAdminLogs() || [];
    if (logs.length > 0) {
      // Use syncTable to effectively clear by saving empty array
      await db.syncTable('cexi_admin_logs', []);
    }
    return true;
  } catch (error) {
    console.error('Failed to clear admin logs:', error);
    return false;
  }
}

module.exports = {
  logAdminAction,
  getAdminLogs,
  clearAdminLogs
};
