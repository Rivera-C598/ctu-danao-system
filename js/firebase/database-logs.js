// js/firebase/database-logs.js
// Using local storage and Socket.io for synchronization
// No Firebase dependency

export const logService = {
    // Add log entry using local storage
    addLog: async (action, details, roomId = null, user = null) => {
        const log = {
            action: action,
            details: details,
            roomId: roomId,
            user: user || localStorage.getItem('currentUser') || 'system',
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString()
        };

        // Use global addLog function from storage.js
        if (typeof addLog === 'function') {
            addLog(action, roomId, user, 'System', details, 'Logged');
        } else {
            console.warn('Global addLog function not available');
        }
    },

    // Get all logs from memory
    getLogs: (callback, limit = 100) => {
        try {
            if (typeof systemLogs !== 'undefined' && Array.isArray(systemLogs)) {
                const logs = [...systemLogs];
                logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                callback(logs.slice(0, limit));
            } else {
                callback([]);
            }
        } catch (e) {
            console.error('Error getting logs:', e);
            callback([]);
        }
    },

    // Clear all logs
    clearLogs: async () => {
        if (typeof clearAllLogsData === 'function') {
            clearAllLogsData();
        } else {
            systemLogs = [];
            if (typeof saveToStorage === 'function') {
                saveToStorage();
            }
        }
    },

    // Get logs by date
    getLogsByDate: (date, callback) => {
        try {
            if (typeof systemLogs !== 'undefined' && Array.isArray(systemLogs)) {
                const logs = systemLogs.filter(log => log.date === date);
                callback(logs);
            } else {
                callback([]);
            }
        } catch (e) {
            console.error('Error getting logs by date:', e);
            callback([]);
        }
    }
};