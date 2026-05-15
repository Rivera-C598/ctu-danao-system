/* ============================================
   CTU Room Management System - Storage Module
   SYNC ENABLED VERSION - Real-time across devices
   ============================================ */

// Data Keys (kept for localStorage fallback)
const STORAGE_KEYS = {
    ROOMS: 'ctu_rooms',
    LOGS: 'ctu_logs',
    SCHEDULE_STATUS: 'ctu_schedule_status',
    REQUESTS: 'ctu_requests',
    USERS: 'ctu_users',
    CURRENT_USER: 'ctu_current_user'
};

// Categories
const CATEGORIES = ["Comlab Room", "Machine Room", "Library Room", "Office Room"];

// Default Data
const DEFAULT_ROOMS = [
    { id: 101, instructor: "", category: "Comlab Room", date: "", startTime: "", endTime: "", status: "Available", history: [], type: "register" },
    { id: 102, instructor: "", category: "Comlab Room", date: "", startTime: "", endTime: "", status: "Available", history: [], type: "register" },
    { id: 201, instructor: "", category: "Machine Room", date: "", startTime: "", endTime: "", status: "Available", history: [], type: "register" },
    { id: 202, instructor: "", category: "Machine Room", date: "", startTime: "", endTime: "", status: "Available", history: [], type: "register" },
    { id: 301, instructor: "", category: "Library Room", date: "", startTime: "", endTime: "", status: "Available", history: [], type: "register" },
    { id: 401, instructor: "", category: "Office Room", date: "", startTime: "", endTime: "", status: "Available", history: [], type: "register" }
];

const DEFAULT_ADMIN = {
    username: 'admin',
    password: 'ctudanao@admin',
    fullName: 'System Administrator',
    email: 'admin@ctu.edu.ph',
    role: 'admin',
    createdAt: new Date().toISOString(),
    lastLogin: null,
    loginCount: 0,
    isNewAccount: false
};

// ============================================
// SYNC CONFIGURATION
// ============================================

// Socket.io instance
let socket = null;
let isConnected = false;
let pendingSync = false;

// Server URL - auto-detect the current host and port
// Use the current page origin for HTTP(S) pages, otherwise fall back to localhost:3000.
const SERVER_URL = window.location.protocol.startsWith('http')
    ? window.location.origin
    : 'http://localhost:3000';

// ============================================
// DATA VARIABLES (synced with server)
// ============================================

let allRooms = [...DEFAULT_ROOMS];
let systemLogs = [];
let scheduleStatus = {};
let pendingRequests = [];
let usersDatabase = [DEFAULT_ADMIN];

// ============================================
// SOCKET.IO SYNC FUNCTIONS
// ============================================

/**
 * Initialize Socket.io connection
 */
function initSync() {
    // Load Socket.io library dynamically
    const script = document.createElement('script');
    script.src = 'https://cdn.socket.io/4.7.2/socket.io.min.js';
    script.onload = () => {
        connectToServer();
    };
    script.onerror = () => {
        console.warn('⚠️ Could not load Socket.io, using localStorage only');
        loadFromLocalStorage();
    };
    document.head.appendChild(script);
}

/**
 * Connect to sync server
 */
function connectToServer() {
    try {
        socket = io(SERVER_URL, {
            transports: ['websocket', 'polling'],
            timeout: 5000
        });

        socket.on('connect', () => {
            console.log('✅ Connected to sync server');
            isConnected = true;

            // If we have local data, send it to server (for first sync)
            if (pendingSync) {
                pushToServer();
                pendingSync = false;
            }
        });

        socket.on('init', (serverData) => {
            console.log('📥 Received initial data from server');
            // Replace local data with server data
            allRooms = serverData.allRooms || DEFAULT_ROOMS;
            systemLogs = serverData.systemLogs || [];
            scheduleStatus = serverData.scheduleStatus || {};
            pendingRequests = serverData.pendingRequests || [];
            usersDatabase = serverData.usersDatabase || [DEFAULT_ADMIN];

            // Save to localStorage as backup
            saveToLocalStorage();

            // Refresh UI if functions exist
            refreshUI();
        });

        socket.on('sync', (serverData) => {
            console.log('🔄 Received sync update from server');
            // Update data
            allRooms = serverData.allRooms || allRooms;
            systemLogs = serverData.systemLogs || systemLogs;
            scheduleStatus = serverData.scheduleStatus || scheduleStatus;
            pendingRequests = serverData.pendingRequests || pendingRequests;
            usersDatabase = serverData.usersDatabase || usersDatabase;

            // Save backup
            saveToLocalStorage();

            // Refresh UI
            refreshUI();

            // Show notification if on admin page
            if (typeof updateScheduleNotifications === 'function') {
                updateScheduleNotifications();
            }
        });

        socket.on('requestUpdate', (action) => {
            console.log('📨 Received request update:', action);
            // Play notification sound or show toast
            if (action.type === 'new_request' && typeof renderRequestsTable === 'function') {
                renderRequestsTable();
                alert(`📋 New room request from ${action.instructor} for Room ${action.roomId}`);
            }
        });

        socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            isConnected = false;
        });

        socket.on('connect_error', (err) => {
            console.warn('⚠️ Connection error:', err.message);
            isConnected = false;
            // Fall back to localStorage
            loadFromLocalStorage();
        });

    } catch (e) {
        console.error('❌ Failed to initialize sync:', e);
        loadFromLocalStorage();
    }
}

/**
 * Push current data to server
 */
function pushToServer() {
    if (socket && isConnected) {
        socket.emit('update', {
            allRooms: allRooms,
            systemLogs: systemLogs,
            scheduleStatus: scheduleStatus,
            pendingRequests: pendingRequests,
            usersDatabase: usersDatabase
        });
        console.log('📤 Pushed data to server');
    } else {
        pendingSync = true;
        console.log('⏳ Queued sync for when server connects');
    }
}

/**
 * Notify other clients of request action
 */
function notifyRequestAction(action) {
    if (socket && isConnected) {
        socket.emit('requestAction', action);
    }
}

/**
 * Refresh UI after sync
 */
function refreshUI() {
    // Call render functions if they exist (admin pages)
    if (typeof renderTable === 'function') renderTable();
    if (typeof renderMonitoringTable === 'function') renderMonitoringTable();
    if (typeof renderRequestsTable === 'function') renderRequestsTable();
    if (typeof renderDatabaseTable === 'function') renderDatabaseTable();
    if (typeof updateStatusCounts === 'function') updateStatusCounts();
    if (typeof updateScheduleNotifications === 'function') updateScheduleNotifications();

    // Call render functions if they exist (instructor pages)
    if (typeof renderInstructorAvailableRooms === 'function') renderInstructorAvailableRooms();
    if (typeof renderMySchedules === 'function') renderMySchedules();
    if (typeof renderMyRequests === 'function') renderMyRequests();
    if (typeof updateInstructorStats === 'function') updateInstructorStats();
}

// ============================================
// LOCALSTORAGE FALLBACK FUNCTIONS
// ============================================

/**
 * Save to localStorage (backup)
 */
function saveToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(allRooms));
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(systemLogs));
        localStorage.setItem(STORAGE_KEYS.SCHEDULE_STATUS, JSON.stringify(scheduleStatus));
        localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(pendingRequests));
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(usersDatabase));
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }
}

/**
 * Load from localStorage (fallback)
 */
function loadFromLocalStorage() {
    try {
        allRooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOMS)) || DEFAULT_ROOMS;
        systemLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGS)) || [];
        scheduleStatus = JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULE_STATUS)) || {};
        pendingRequests = JSON.parse(localStorage.getItem(STORAGE_KEYS.REQUESTS)) || [];
        usersDatabase = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [DEFAULT_ADMIN];
        console.log('📦 Loaded from localStorage');
    } catch (e) {
        console.error('Error loading from localStorage:', e);
    }
}

// ============================================
// MAIN FUNCTIONS (Modified for Sync)
// ============================================

/**
 * Save all data - NOW SYNCS TO SERVER!
 */
function saveToStorage() {
    // Always save locally as backup
    saveToLocalStorage();

    // Push to server for sync
    pushToServer();
}

/**
 * Save users database
 */
function saveUsersDatabase() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(usersDatabase));
    pushToServer(); // Also sync users
}

/**
 * Save current session
 */
function saveSession(session) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(session));
}

/**
 * Get current session
 */
function getSession() {
    const session = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return session ? JSON.parse(session) : null;
}

/**
 * Clear current session
 */
function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}

/**
 * Add a system log entry
 */
function addLog(action, roomId, user, category, details, status) {
    const log = {
        timestamp: new Date().toISOString(),
        roomId: roomId,
        action: action,
        user: user || 'Anonymous',
        category: category || 'N/A',
        details: details || '',
        status: status || 'N/A'
    };
    systemLogs.unshift(log);
    saveToStorage();
}

/**
 * Clear all system logs
 */
function clearAllLogsData() {
    systemLogs = [];
    scheduleStatus = {};
    allRooms.forEach(room => {
        room.history = [];
    });
    saveToStorage();
}

/**
 * Export all data as JSON
 */
function exportData() {
    return {
        exportDate: new Date().toISOString(),
        rooms: allRooms,
        logs: systemLogs,
        scheduleStatus: scheduleStatus,
        requests: pendingRequests,
        users: usersDatabase
    };
}

/**
 * Reset all data to defaults
 */
function resetAllData() {
    allRooms = [...DEFAULT_ROOMS];
    systemLogs = [];
    scheduleStatus = {};
    pendingRequests = [];
    saveToStorage();
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize sync when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSync);
} else {
    initSync();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORAGE_KEYS,
        CATEGORIES,
        DEFAULT_ROOMS,
        allRooms,
        systemLogs,
        scheduleStatus,
        pendingRequests,
        usersDatabase,
        saveToStorage,
        saveUsersDatabase,
        saveSession,
        getSession,
        clearSession,
        addLog,
        clearAllLogsData,
        exportData,
        resetAllData,
        notifyRequestAction,
        isConnected: () => isConnected
    };
}