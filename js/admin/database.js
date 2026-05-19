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

        const room = allRooms.find(r => r.id === log.roomId);
        const category = room?.category || (log.roomId ? `Room ${log.roomId}` : '—');

        const details = typeof log.details === 'object' && log.details !== null
            ? Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(', ')
            : (log.details || '—');

        const statusText = log.status || '';
        const statusHtml = statusText
            ? `<span class="log-status" style="background:${getStatusColor(statusText)};color:white;padding:4px 10px;border-radius:12px;">${statusText}</span>`
            : '—';

        return `
        <tr>
            <td><span class="log-timestamp">${dateStr}<br>${timeStr}</span></td>
            <td><strong>${log.roomId ? '#' + escapeHtml(String(log.roomId)) : '—'}</strong></td>
            <td><span class="log-action ${escapeHtml(log.action)}">${escapeHtml(log.action.toUpperCase().replace(/_/g, ' '))}</span></td>
            <td>${log.user === 'system' ? '<em style="color:#999">system</em>' : escapeHtml(getInstructorFullName(log.user) || log.user)}</td>
            <td>${escapeHtml(category)}</td>
            <td style="font-size:0.82rem;color:#555;">${details}</td>
            <td>${statusHtml}</td>
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
    const pending = roomRequests.filter(r => r.status === 'standby').length;
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
    const headers = ['Timestamp', 'Room No.', 'Action', 'User', 'Details'];
    const rows = systemLogs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.roomId ?? '',
        log.action ?? '',
        log.user ?? '',
        typeof log.details === 'object' ? Object.entries(log.details || {}).map(([k,v]) => `${k}:${v}`).join('; ') : (log.details ?? '')
    ]);

    const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\r\n');

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ctu_logs_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Clear all logs with confirmation
 */
async function clearAllLogs() {
    if (!await showConfirm('Delete ALL system logs permanently? This cannot be undone.')) return;
    try {
        await apiFetch('/api/logs', { method: 'DELETE' });
        await refreshData({ render: true, force: true });
        showNotification('Logs Cleared', 'All system logs have been deleted.', 'success', 3000);
    } catch (error) {
        showToast(error.message, 'error');
    }
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
