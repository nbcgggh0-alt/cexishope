const axios = require('axios');

/**
 * Pterodactyl Panel API Wrapper
 * Handles all communication with Pterodactyl panels
 */

// Create axios instance for a panel
function createClient(panel, type = 'client') {
    const apiKey = type === 'app' ? panel.apiKeyApp : panel.apiKeyClient;
    return axios.create({
        baseURL: `${panel.domain.replace(/\/$/, '')}/api`,
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        timeout: 10000
    });
}

// Test connection to panel
async function testConnection(panel) {
    try {
        const client = createClient(panel, 'app');
        const res = await client.get('/application/servers?per_page=1');
        return { success: true, data: res.data };
    } catch (err) {
        return { success: false, error: err.response?.data?.errors?.[0]?.detail || err.message };
    }
}

// Get all servers on panel (Application API)
async function listServers(panel) {
    try {
        const client = createClient(panel, 'app');
        const res = await client.get('/application/servers?per_page=50');
        return { success: true, servers: res.data.data || [] };
    } catch (err) {
        return { success: false, error: err.message, servers: [] };
    }
}

// Get server resource usage (Client API)
async function getServerStatus(panel) {
    if (!panel.serverIdentifier) return { success: false, error: 'No server linked' };
    try {
        const client = createClient(panel, 'client');
        const res = await client.get(`/client/servers/${panel.serverIdentifier}/resources`);
        return { success: true, data: res.data.attributes };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Send power action (Client API)
async function sendPowerAction(panel, signal) {
    if (!panel.serverIdentifier) return { success: false, error: 'No server linked' };
    try {
        const client = createClient(panel, 'client');
        await client.post(`/client/servers/${panel.serverIdentifier}/power`, { signal });
        return { success: true };
    } catch (err) {
        return { success: false, error: err.response?.data?.errors?.[0]?.detail || err.message };
    }
}

// Create server on panel (Application API)
async function createServer(panel, config = {}) {
    try {
        const client = createClient(panel, 'app');

        // First get available nodes
        const nodesRes = await client.get('/application/nodes?per_page=1');
        const nodes = nodesRes.data.data || [];
        if (nodes.length === 0) return { success: false, error: 'No nodes available on this panel' };

        const nodeId = nodes[0].attributes.id;

        // Get allocations for the node
        const allocRes = await client.get(`/application/nodes/${nodeId}/allocations?per_page=50`);
        const allocs = allocRes.data.data || [];
        const freeAlloc = allocs.find(a => !a.attributes.assigned);
        if (!freeAlloc) return { success: false, error: 'No free allocations on node' };

        const serverName = config.name || `CexiBot-${Date.now()}`;

        const payload = {
            name: serverName,
            user: 1, // Default admin user
            egg: config.egg || 15,
            docker_image: config.dockerImage || 'ghcr.io/pterodactyl/yolks:nodejs_18',
            startup: config.startup || 'npm start',
            environment: {
                INST: 'npm',
                USER_UPLOAD: '0',
                AUTO_UPDATE: '0',
                CMD_RUN: 'npm start'
            },
            limits: {
                memory: 0,    // Unlimited
                swap: 0,
                disk: 0,      // Unlimited
                io: 500,
                cpu: 0         // Unlimited
            },
            feature_limits: {
                databases: 1,
                backups: 1,
                allocations: 1
            },
            allocation: {
                default: freeAlloc.attributes.id
            }
        };

        const res = await client.post('/application/servers', payload);
        const server = res.data.attributes;

        return {
            success: true,
            serverId: server.id,
            identifier: server.identifier,
            name: server.name
        };
    } catch (err) {
        const detail = err.response?.data?.errors?.[0]?.detail || err.message;
        return { success: false, error: detail };
    }
}

// Delete server from panel (Application API)
async function deleteServer(panel) {
    if (!panel.serverId) return { success: false, error: 'No server linked' };
    try {
        const client = createClient(panel, 'app');
        await client.delete(`/application/servers/${panel.serverId}`);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

// Health check across all panels — returns the first healthy one
async function checkAllPanels(panels) {
    const results = [];
    for (const panel of panels) {
        if (!panel.serverIdentifier) {
            results.push({ panel, healthy: false, reason: 'No server linked' });
            continue;
        }
        const status = await getServerStatus(panel);
        if (status.success) {
            const state = status.data.current_state;
            results.push({
                panel,
                healthy: state === 'running',
                state,
                resources: status.data
            });
        } else {
            results.push({ panel, healthy: false, reason: status.error });
        }
    }
    return results;
}

// Auto-failover: if primary is down, start the next available standby
async function autoFailover(panels, db) {
    const primary = panels.find(p => p.isPrimary);
    if (!primary || !primary.serverIdentifier) return null;

    const status = await getServerStatus(primary);
    const isDown = !status.success || status.data?.current_state !== 'running';

    if (!isDown) return null; // Primary is fine

    // Primary is down — find next panel and start it
    const backups = panels.filter(p => !p.isPrimary && p.serverIdentifier);
    for (const backup of backups) {
        const startResult = await sendPowerAction(backup, 'start');
        if (startResult.success) {
            // Switch primary
            await db.updatePteroPanel(primary.id, { isPrimary: false, status: 'offline' });
            await db.updatePteroPanel(backup.id, { isPrimary: true, status: 'active' });
            return backup;
        }
    }
    return null;
}

module.exports = {
    testConnection,
    listServers,
    getServerStatus,
    sendPowerAction,
    createServer,
    deleteServer,
    checkAllPanels,
    autoFailover
};
