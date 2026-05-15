/* ============================================
   CTU Room Management System - API-backed state
   ============================================ */

const STORAGE_KEYS = {
    CURRENT_USER: 'ctu_current_user'
};

const CATEGORIES = ["Comlab Room", "Machine Room", "Library Room", "Office Room"];

let allRooms = [];
let systemLogs = [];
let scheduleStatus = {};
let pendingRequests = [];
let usersDatabase = [];
let registrationCodes = [];
let notifications = [];
let isConnected = false;
let syncInitialized = false;
let pollingTimer = null;

async function apiFetch(url, options = {}) {
    const response = await fetch(url, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        },
        ...options
    });

    let payload = null;
    try {
        payload = await response.json();
    } catch (_error) {
        payload = null;
    }

    if (!response.ok) {
        const error = new Error(payload?.error || `Request failed (${response.status})`);
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload;
}

function applyServerData(data) {
    allRooms = data.allRooms || [];
    systemLogs = data.systemLogs || [];
    scheduleStatus = data.scheduleStatus || {};
    pendingRequests = data.pendingRequests || [];
    usersDatabase = data.usersDatabase || [];
    registrationCodes = data.registrationCodes || [];
    notifications = data.notifications || [];
    isConnected = true;
}

async function refreshData({ render = true } = {}) {
    try {
        const data = await apiFetch('/api/data');
        applyServerData(data);
        if (render) refreshUI();
        return data;
    } catch (error) {
        isConnected = false;
        if (error.status === 401 && !location.pathname.endsWith('/Login.html')) {
            clearSession();
            window.location.href = '/html/Login.html';
        }
        throw error;
    }
}

function initSync() {
    if (syncInitialized) return;
    syncInitialized = true;

    refreshData({ render: true }).catch((error) => {
        console.warn('Initial API sync failed:', error.message);
    });

    pollingTimer = setInterval(() => {
        refreshData({ render: true }).catch((error) => {
            console.warn('Polling sync failed:', error.message);
        });
    }, 5000);
}

function stopSync() {
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = null;
    syncInitialized = false;
}

function refreshUI() {
    if (typeof renderTable === 'function') renderTable();
    if (typeof renderMonitoringTable === 'function') renderMonitoringTable();
    if (typeof renderRequestsTable === 'function') renderRequestsTable();
    if (typeof renderDatabaseTable === 'function') renderDatabaseTable();
    if (typeof updateStatusCounts === 'function') updateStatusCounts();
    if (typeof updateScheduleNotifications === 'function') updateScheduleNotifications();
    if (typeof renderRegistrationCodes === 'function') renderRegistrationCodes();

    if (typeof renderInstructorAvailableRooms === 'function') renderInstructorAvailableRooms();
    if (typeof renderMySchedules === 'function') renderMySchedules();
    if (typeof renderMyRequests === 'function') renderMyRequests();
    if (typeof updateInstructorStats === 'function') updateInstructorStats();
}

async function saveToStorage() {
    console.warn('saveToStorage is deprecated. Use explicit API endpoints for mutations.');
    await refreshData({ render: true });
}

async function saveUsersDatabase() {
    console.warn('saveUsersDatabase is deprecated. Use auth/admin API endpoints.');
    await refreshData({ render: true });
}

function saveSession(session) {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(session));
}

function getSession() {
    const session = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return session ? JSON.parse(session) : null;
}

function clearSession() {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
}

async function addLog(action, roomId, user, category, details, status) {
    systemLogs.unshift({
        timestamp: new Date().toISOString(),
        action,
        roomId,
        user: user || 'system',
        category: category || 'N/A',
        details: details || '',
        status: status || ''
    });
}

function clearAllLogsData() {
    systemLogs = [];
    refreshUI();
}

function exportData() {
    return {
        exportDate: new Date().toISOString(),
        rooms: allRooms,
        logs: systemLogs,
        scheduleStatus,
        requests: pendingRequests,
        users: usersDatabase,
        registrationCodes
    };
}

async function resetAllData() {
    throw new Error('Reset all data is disabled in API mode.');
}

function notifyRequestAction(_action) {
    // Notifications are created by backend mutations in API mode.
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STORAGE_KEYS,
        CATEGORIES,
        apiFetch,
        refreshData,
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
