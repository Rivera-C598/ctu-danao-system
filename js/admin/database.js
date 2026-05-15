/* ============================================
   CTU Room Management System - Admin Database
   ============================================ */

/**
 * Render database/logs table
 */
function renderDatabaseTable() {
    const tbody = document.getElementById('databaseBody');
    const table = document.getElementById('databaseTable');
    const noMsg = document.getElementById('noLogsMsg');

    if (!tbody) return;

    const allLogs = buildCompleteLogs();

    if (allLogs.length === 0) {
        tbody.innerHTML = '';
        if (noMsg) noMsg.style.display = 'block';
        if (table) table.style.display = 'none';
        return;
    }

    if (noMsg) noMsg.style.display = 'none';
    if (table) table.style.display = 'table';

    tbody.innerHTML = allLogs.map(log => {
        const date = new Date(log.timestamp);
        const timeStr = date.toLocaleTimeString();
        const dateStr = date.toLocaleDateString();

        return `
        <tr>
            <td><span class="log-timestamp">${dateStr}<br>${timeStr}</span></td>
            <td><strong>#${log.roomId}</strong></td>
            <td><span class="log-action ${log.action}">${log.action.toUpperCase()}</span></td>
            <td>${getInstructorFullName(log.user)}</td>
            <td>${log.category}</td>
            <td>${log.details}</td>
            <td><span class="log-status" style="background: ${getStatusColor(log.status)}; color: white; padding: 4px 10px; border-radius: 12px;">${log.status}</span></td>
        </tr>`;
    }).join('');

    updateDatabaseStats();
}

/**
 * Build complete logs from all sources
 * @returns {Array} Sorted array of all logs
 */
function buildCompleteLogs() {
    let completeLogs = [...systemLogs];

    allRooms.forEach(room => {
        const existingLog = completeLogs.find(l => l.roomId === room.id && l.action === room.type);
        if (!existingLog && room.history.length > 0) {
            completeLogs.push({
                timestamp: new Date().toISOString(),
                roomId: room.id,
                action: room.type,
                user: room.instructor || 'Anonymous',
                category: room.category,
                details: room.type === 'schedule' ? `Scheduled: ${room.date} ${room.startTime}-${room.endTime}` : 'Room registered',
                status: room.status
            });
        }
    });

    return completeLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * Filter database table
 */
function filterDatabase() {
    const searchInput = document.getElementById('databaseSearch');
    const dateInput = document.getElementById('databaseDateFilter');
    const actionInput = document.getElementById('databaseActionFilter');

    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const dateFilter = dateInput ? dateInput.value : '';
    const actionFilter = actionInput ? actionInput.value : 'all';

    const rows = document.querySelectorAll('#databaseBody tr');
    const allLogs = buildCompleteLogs();

    let visibleCount = 0;

    rows.forEach((row, i) => {
        const log = allLogs[i];
        if (!log) return;

        const logDate = new Date(log.timestamp).toISOString().split('T')[0];

        const matchSearch = log.roomId.toString().includes(search) ||
            log.user.toLowerCase().includes(search) ||
            log.details.toLowerCase().includes(search);
        const matchDate = !dateFilter || logDate === dateFilter;
        const matchAction = actionFilter === 'all' || log.action === actionFilter;

        if (matchSearch && matchDate && matchAction) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const noMsg = document.getElementById('noLogsMsg');
    const table = document.getElementById('databaseTable');

    if (noMsg) noMsg.style.display = visibleCount === 0 ? 'block' : 'none';
    if (table) table.style.display = visibleCount === 0 ? 'none' : 'table';
}

/**
 * Update database statistics
 */
function updateDatabaseStats() {
    const registeredEl = document.getElementById('dbRegisteredCount');
    const scheduledEl = document.getElementById('dbScheduledCount');
    const pendingEl = document.getElementById('dbPendingCount');
    const statusEl = document.getElementById('dbStatusChanges');
    const totalLogsEl = document.getElementById('totalLogs');
    const todayActivityEl = document.getElementById('todayActivity');

    const registered = allRooms.filter(r => r.type === 'register' || !r.type).length;
    const scheduled = allRooms.filter(r => r.type === 'schedule').length;
    const pending = pendingRequests.filter(r => r.status === 'pending').length;
    const statusChanges = systemLogs.filter(l => l.action === 'status').length;

    if (registeredEl) registeredEl.innerText = registered;
    if (scheduledEl) scheduledEl.innerText = scheduled;
    if (pendingEl) pendingEl.innerText = pending;
    if (statusEl) statusEl.innerText = statusChanges;

    const totalLogs = systemLogs.length;
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = systemLogs.filter(l => l.timestamp.startsWith(today)).length;

    if (totalLogsEl) totalLogsEl.innerText = totalLogs;
    if (todayActivityEl) todayActivityEl.innerText = todayLogs;
}

/**
 * Export database as JSON file
 */
function exportDatabase() {
    const data = exportData();

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ctu_room_database_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Clear all logs with confirmation
 */
function clearAllLogs() {
    if (!confirm('WARNING: This will delete ALL system logs permanently!\n\nAre you sure you want to continue?')) {
        return;
    }

    if (!confirm('FINAL WARNING: This action cannot be undone!\n\nDelete all logs?')) {
        return;
    }

    clearAllLogsData();
    renderDatabaseTable();
    updateScheduleNotifications();
    alert('All logs have been cleared.');
}

/**
 * Clear all logs data (internal)
 */
function clearAllLogsData() {
    systemLogs = [];
    scheduleStatus = {};
    allRooms.forEach(room => {
        room.history = [];
    });
    saveToStorage();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderDatabaseTable,
        buildCompleteLogs,
        filterDatabase,
        updateDatabaseStats,
        exportDatabase,
        clearAllLogs,
        clearAllLogsData
    };
}
