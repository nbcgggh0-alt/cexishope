const supabase = require('./supabase');

class QueueManager {
  constructor() {
    // No local files needed — everything is in Supabase
  }

  async getQueue() {
    try {
      const { data, error } = await supabase
        .from('cexi_queue')
        .select('*')
        .order('position', { ascending: true });
      if (error) throw error;
      return (data || []).map(row => this._fromDb(row));
    } catch (error) {
      console.error('Error reading queue:', error.message);
      return [];
    }
  }

  async saveQueue(queue) {
    try {
      // Full replace: delete all rows then insert
      const { error: delErr } = await supabase.from('cexi_queue').delete().gte('id', 0);
      if (delErr) throw delErr;

      if (queue.length > 0) {
        const rows = queue.map(item => this._toDb(item));
        const { error: insErr } = await supabase.from('cexi_queue').insert(rows);
        if (insErr) throw insErr;
      }
      return true;
    } catch (error) {
      console.error('Error saving queue:', error.message);
      return false;
    }
  }

  async getSettings() {
    try {
      const { data, error } = await supabase.from('cexi_queue_settings').select('*');
      if (error) throw error;

      const settings = {
        averageProcessingTime: 300,
        maxConcurrentOrders: 3,
        estimatedTimePerOrder: 300
      };

      (data || []).forEach(row => {
        switch (row.key) {
          case 'average_processing_time':
            settings.averageProcessingTime = parseInt(row.value) || 300;
            break;
          case 'max_concurrent_orders':
            settings.maxConcurrentOrders = parseInt(row.value) || 3;
            break;
          case 'estimated_time_per_order':
            settings.estimatedTimePerOrder = parseInt(row.value) || 300;
            break;
        }
      });

      return settings;
    } catch (error) {
      console.error('Error reading queue settings:', error.message);
      return {
        averageProcessingTime: 300,
        maxConcurrentOrders: 3,
        estimatedTimePerOrder: 300
      };
    }
  }

  async saveSettings(settings) {
    try {
      const rows = [
        { key: 'average_processing_time', value: String(settings.averageProcessingTime) },
        { key: 'max_concurrent_orders', value: String(settings.maxConcurrentOrders) },
        { key: 'estimated_time_per_order', value: String(settings.estimatedTimePerOrder) }
      ];

      for (const row of rows) {
        const { error } = await supabase
          .from('cexi_queue_settings')
          .upsert(row, { onConflict: 'key' });
        if (error) throw error;
      }
      return true;
    } catch (error) {
      console.error('Error saving queue settings:', error.message);
      return false;
    }
  }

  async addToQueue(orderId, userId, productName, priority = 'normal') {
    const queue = await this.getQueue();

    const existingIndex = queue.findIndex(item => item.orderId === orderId);
    if (existingIndex !== -1) {
      return {
        success: false,
        message: 'Order already in queue',
        position: existingIndex + 1
      };
    }

    const queueItem = {
      orderId,
      userId,
      productName,
      priority,
      status: 'waiting',
      queuedAt: new Date().toISOString(),
      startedAt: null,
      estimatedCompletion: null,
      position: queue.length + 1
    };

    queue.push(queueItem);
    await this.saveQueue(queue);
    await this.updateEstimatedTimes();

    return {
      success: true,
      position: queue.length,
      queueItem
    };
  }

  async removeFromQueue(orderId) {
    const queue = await this.getQueue();
    const index = queue.findIndex(item => item.orderId === orderId);

    if (index === -1) {
      return { success: false, message: 'Order not found in queue' };
    }

    const removedItem = queue.splice(index, 1)[0];

    queue.forEach((item, idx) => {
      item.position = idx + 1;
    });

    await this.saveQueue(queue);
    await this.updateEstimatedTimes();

    return { success: true, removedItem };
  }

  async startProcessing(orderId, adminId) {
    const queue = await this.getQueue();
    const item = queue.find(q => q.orderId === orderId);

    if (!item) {
      return { success: false, message: 'Order not found in queue' };
    }

    if (item.status === 'processing') {
      return { success: false, message: 'Order already being processed' };
    }

    const settings = await this.getSettings();
    const processingCount = queue.filter(q => q.status === 'processing').length;

    if (processingCount >= settings.maxConcurrentOrders) {
      return {
        success: false,
        message: `Maximum concurrent orders (${settings.maxConcurrentOrders}) reached`
      };
    }

    item.status = 'processing';
    item.startedAt = new Date().toISOString();
    item.adminId = adminId;
    item.estimatedCompletion = new Date(
      Date.now() + (settings.estimatedTimePerOrder * 1000)
    ).toISOString();

    await this.saveQueue(queue);
    await this.updateEstimatedTimes();

    return { success: true, item };
  }

  async completeProcessing(orderId) {
    const queue = await this.getQueue();
    const item = queue.find(q => q.orderId === orderId);

    if (!item) {
      return { success: false, message: 'Order not found in queue' };
    }

    const completedAt = new Date().toISOString();
    const processingTime = item.startedAt
      ? (new Date(completedAt) - new Date(item.startedAt)) / 1000
      : 0;

    await this.updateAverageProcessingTime(processingTime);
    await this.removeFromQueue(orderId);

    return {
      success: true,
      item,
      processingTime
    };
  }

  async updateAverageProcessingTime(newTime) {
    const settings = await this.getSettings();

    const oldAvg = settings.averageProcessingTime || 300;
    const newAvg = Math.round((oldAvg * 0.7) + (newTime * 0.3));

    settings.averageProcessingTime = newAvg;
    settings.estimatedTimePerOrder = newAvg;

    await this.saveSettings(settings);
  }

  async updateEstimatedTimes() {
    const queue = await this.getQueue();
    const settings = await this.getSettings();

    const processingOrders = queue.filter(q => q.status === 'processing');
    const waitingOrders = queue.filter(q => q.status === 'waiting');

    let baseTime = Date.now();

    if (processingOrders.length > 0) {
      const earliestCompletion = Math.min(
        ...processingOrders.map(o => new Date(o.estimatedCompletion).getTime())
      );
      baseTime = earliestCompletion;
    }

    const slotsAvailable = settings.maxConcurrentOrders - processingOrders.length;

    waitingOrders.forEach((item, index) => {
      const batchNumber = Math.floor(index / Math.max(1, slotsAvailable));
      const estimatedSeconds = (batchNumber + 1) * settings.estimatedTimePerOrder;

      item.estimatedCompletion = new Date(
        baseTime + (estimatedSeconds * 1000)
      ).toISOString();
    });

    await this.saveQueue(queue);
  }

  async getQueuePosition(orderId) {
    const queue = await this.getQueue();
    const item = queue.find(q => q.orderId === orderId);

    if (!item) {
      return null;
    }

    const waitingAhead = queue.filter(
      q => q.status === 'waiting' && q.position < item.position
    ).length;

    return {
      ...item,
      waitingAhead,
      totalInQueue: queue.length
    };
  }

  async getQueueStats() {
    const queue = await this.getQueue();
    const settings = await this.getSettings();

    const stats = {
      total: queue.length,
      waiting: queue.filter(q => q.status === 'waiting').length,
      processing: queue.filter(q => q.status === 'processing').length,
      highPriority: queue.filter(q => q.priority === 'high').length,
      averageProcessingTime: settings.averageProcessingTime,
      maxConcurrentOrders: settings.maxConcurrentOrders
    };

    return stats;
  }

  async setPriority(orderId, priority) {
    const queue = await this.getQueue();
    const item = queue.find(q => q.orderId === orderId);

    if (!item) {
      return { success: false, message: 'Order not found in queue' };
    }

    item.priority = priority;

    if (priority === 'high') {
      const currentIndex = queue.indexOf(item);
      queue.splice(currentIndex, 1);

      const firstNormalIndex = queue.findIndex(
        q => q.priority === 'normal' && q.status === 'waiting'
      );

      if (firstNormalIndex !== -1) {
        queue.splice(firstNormalIndex, 0, item);
      } else {
        queue.unshift(item);
      }
    }

    queue.forEach((item, idx) => {
      item.position = idx + 1;
    });

    await this.saveQueue(queue);
    await this.updateEstimatedTimes();

    return { success: true, item };
  }

  async getProcessingOrders() {
    const queue = await this.getQueue();
    return queue.filter(q => q.status === 'processing');
  }

  async getWaitingOrders() {
    const queue = await this.getQueue();
    return queue.filter(q => q.status === 'waiting');
  }

  formatEstimatedTime(isoDate) {
    if (!isoDate) return 'N/A';

    const now = new Date();
    const estimated = new Date(isoDate);
    const diffMs = estimated - now;

    if (diffMs < 0) return 'Segera / Soon';

    const diffMins = Math.ceil(diffMs / 60000);

    if (diffMins < 60) {
      return `~${diffMins} minit / minutes`;
    } else {
      const hours = Math.floor(diffMins / 60);
      const mins = diffMins % 60;
      return `~${hours} jam ${mins} minit / hours ${mins} mins`;
    }
  }

  formatTimeRemaining(isoDate) {
    if (!isoDate) return 'N/A';

    const now = new Date();
    const target = new Date(isoDate);
    const diffMs = target - now;

    if (diffMs < 0) return '0 minit';

    const diffMins = Math.ceil(diffMs / 60000);
    return `${diffMins} minit`;
  }

  // Convert DB snake_case row to camelCase object
  _fromDb(row) {
    return {
      orderId: row.order_id,
      userId: row.user_id,
      productName: row.product_name,
      priority: row.priority,
      status: row.status,
      queuedAt: row.queued_at,
      startedAt: row.started_at,
      estimatedCompletion: row.estimated_completion,
      position: row.position,
      adminId: row.admin_id
    };
  }

  // Convert camelCase object to DB snake_case row
  _toDb(item) {
    return {
      order_id: item.orderId,
      user_id: item.userId,
      product_name: item.productName,
      priority: item.priority,
      status: item.status,
      queued_at: item.queuedAt,
      started_at: item.startedAt,
      estimated_completion: item.estimatedCompletion,
      position: item.position,
      admin_id: item.adminId
    };
  }
}

module.exports = new QueueManager();
