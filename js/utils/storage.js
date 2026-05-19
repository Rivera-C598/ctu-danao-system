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
let roomRequests = [];
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

let _lastDataHash = null;

function _dataHash(data) {
    // Fast fingerprint — lengths + last item ids + statuses
    const rooms = (data.allRooms || []);
    const reqs  = (data.roomRequests || data.pendingRequests || []);
    const logs  = (data.systemLogs || []);
    return [
        rooms.length,
        rooms.map(r => r.status).join(','),
        reqs.length,
        reqs.filter(r => r.status === 'pending').length,
        reqs.filter(r => r.status === 'active').length,
        logs.length,
        (data.registrationCodes || []).length
    ].join('|');
}

function applyServerData(data) {
    const prevRequests = roomRequests || [];
    allRooms = data.allRooms || [];
    systemLogs = data.systemLogs || [];
    scheduleStatus = data.scheduleStatus || {};
    roomRequests = data.roomRequests || data.pendingRequests || [];
    pendingRequests = roomRequests;
    usersDatabase = data.usersDatabase || [];
    registrationCodes = data.registrationCodes || [];
    notifications = data.notifications || [];
    isConnected = true;

    // Notify admin of new pending requests
    if (typeof showNotification === 'function' && prevRequests.length > 0) {
        const session = typeof getSession === 'function' ? getSession() : null;
        if (session?.role === 'admin') {
            const prevPendingIds = new Set(prevRequests.filter(r => r.status === 'pending').map(r => r.id));
            const newPending = (roomRequests || []).filter(r => r.status === 'pending' && !prevPendingIds.has(r.id));
            if (newPending.length > 0) {
                const r = newPending[0];
                showNotification(
                    `New Request${newPending.length > 1 ? ` (+${newPending.length})` : ''}`,
                    `${r.instructorName || r.instructor} requested Room ${r.roomId} on ${r.date}`,
                    'info', 6000
                );
                // Pulse the nav badge
                const badge = document.getElementById('navBadgeRequests');
                if (badge) {
                    badge.style.animation = 'none';
                    setTimeout(() => badge.style.animation = '', 10);
                }
            }
        }
    }

    // Instructor red-dot notifications on status changes
    // (badge logic lives in renderMyRequests / renderMySchedules which run after this)
    if (typeof showNotification === 'function' && prevRequests.length > 0) {
        const session = typeof getSession === 'function' ? getSession() : null;
        if (session?.role === 'instructor') {
            roomRequests.forEach(r => {
                const prev = prevRequests.find(p => p.id === r.id);
                if (!prev || prev.status === r.status) return;
                if (r.instructor !== session.username) return;
                if (r.status === 'active') {
                    showNotification('Room Approved!', `Room ${r.roomId} on ${r.date} has been approved.`, 'success', 6000);
                } else if (r.status === 'standby') {
                    showNotification('Added to Queue', `Room ${r.roomId} request is queued — waiting for current session to end.`, 'info', 5000);
                } else if (r.status === 'rejected') {
                    showNotification('Request Rejected', `Room ${r.roomId} on ${r.date} was rejected.${r.rejectionReason ? ' Reason: ' + r.rejectionReason : ''}`, 'warning', 7000);
                }
            });
        }
    }
}

async function refreshData({ render = true, force = false } = {}) {
    try {
        const data = await apiFetch('/api/data');
        const hash = _dataHash(data);
        const changed = force || hash !== _lastDataHash;
        _lastDataHash = hash;
        applyServerData(data);
        if (render && changed) refreshUI();
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
    if (typeof checkAndAutoApproveQueue === 'function') checkAndAutoApproveQueue();
    if (typeof updateRequestsSidebar === 'function') updateRequestsSidebar();

    if (typeof renderInstructorAvailableRooms === 'function') renderInstructorAvailableRooms();
    if (typeof renderMySchedules === 'function') renderMySchedules();
    if (typeof renderMyRequests === 'function') renderMyRequests();
    if (typeof renderMyHistory === 'function') renderMyHistory();
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
        roomRequests,
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
        roomRequests,
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
