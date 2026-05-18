/* ============================================
   CTU Room Management System - Admin Monitoring
   ============================================ */

/**
 * Render monitoring table
 */
function renderMonitoringTable() {
    const tbody = document.getElementById('monitoringBody');
    const table = document.getElementById('monitoringTable');
    const noMsg = document.getElementById('noScheduleMsg');

    if (!tbody) return;

    // Preserve active filters before re-render
    const savedSearch = document.getElementById('monitorSearch')?.value || '';
    const savedDate   = document.getElementById('monitorDateFilter')?.value || '';
    if (!window._scheduleFilter) window._scheduleFilter = 'now';

    // Get register type rooms with schedules (not schedule type duplicates)
    // Show all schedules (past, present, and future)
    const scheduledRooms = allRooms.filter(r =>
        r.type === 'register' &&
        r.schedules &&
        r.schedules.length > 0
    );

    scheduledRooms.sort((a, b) => {
        if (a.schedules[0].date !== b.schedules[0].date) {
            return new Date(a.schedules[0].date) - new Date(b.schedules[0].date);
        }
        return timeToMinutes(a.schedules[0].startTime) - timeToMinutes(b.schedules[0].startTime);
    });

    if (scheduledRooms.length === 0) {
        tbody.innerHTML = '';
        if (noMsg) noMsg.style.display = 'block';
        if (table) table.style.display = 'none';
        return;
    }

    if (noMsg) noMsg.style.display = 'none';
    if (table) table.style.display = 'table';

    // Expand rooms with multiple scheduled times
    let allRows = [];
    scheduledRooms.forEach(room => {
        if (room.schedules && room.schedules.length > 0) {
            // Add a row for each scheduled instructor (all schedules)
            room.schedules.forEach((schedule, index) => {
                allRows.push({
                    room: room,
                    schedule: schedule,
                    isFirst: index === 0,
                    isLast: index === room.schedules.length - 1,
                    queuePosition: index + 1,
                    totalInQueue: room.schedules.length
                });
            });
        }
    });

    // Apply filters pre-pagination
    const search      = (document.getElementById('monitorSearch')?.value || '').toLowerCase().trim();
    const dateFilter  = document.getElementById('monitorDateFilter')?.value || '';
    const activeFilter = window._scheduleFilter || 'now';

    const today = new Date().toISOString().split('T')[0];
    const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

    allRows = allRows.filter(row => {
        const s = row.schedule;
        const d = s.date || '';

        // Time filter
        let matchTime = true;
        if (activeFilter === 'now') {
            const [sh, sm] = (s.startTime || '00:00').split(':').map(Number);
            const [eh, em] = (s.endTime   || '23:59').split(':').map(Number);
            matchTime = d === today && (sh * 60 + sm) <= nowMinutes && nowMinutes <= (eh * 60 + em);
        } else if (activeFilter === 'today') {
            matchTime = d === today;
        } else if (activeFilter === 'upcoming') {
            const [sh, sm] = (s.startTime || '00:00').split(':').map(Number);
            matchTime = d > today || (d === today && (sh * 60 + sm) > nowMinutes);
        } else if (activeFilter === 'date') {
            matchTime = !dateFilter || d === dateFilter;
        }
        // 'all' = no time filter

        // Search filter
        let matchSearch = true;
        if (search) {
            if (/^\d+$/.test(search)) {
                matchSearch = row.room.id.toString() === search;
            } else {
                matchSearch = (s.instructor || '').toLowerCase().includes(search)
                    || row.room.category.toLowerCase().includes(search)
                    || getInstructorFullName(s.instructor).toLowerCase().includes(search);
            }
        }

        return matchTime && matchSearch;
    });

    const totalRows = allRows.length;
    const schedPage = (typeof pageState !== 'undefined' ? pageState.schedule : 1) || 1;
    const schedPageSize = typeof PAGE_SIZE !== 'undefined' ? PAGE_SIZE : 10;
    allRows = allRows.slice((schedPage - 1) * schedPageSize, schedPage * schedPageSize);

    tbody.innerHTML = allRows.map((row) => {
        const duration = calculateDuration(row.schedule.startTime, row.schedule.endTime);
        const isActive  = row.schedule.queueStatus === 'active';
        const isStandby = row.schedule.queueStatus === 'standby';
        const today = new Date().toISOString().split('T')[0];
        const isToday  = row.schedule.date === today;
        const isPast   = row.schedule.date < today;

        const queueBadge = isActive
            ? '<span style="background:#27ae60;color:white;padding:3px 10px;border-radius:12px;font-size:0.78rem;font-weight:700;">✓ Active</span>'
            : isStandby
            ? `<span style="background:#f39c12;color:white;padding:3px 10px;border-radius:12px;font-size:0.78rem;font-weight:700;">⏳ Queue #${row.queuePosition}</span>`
            : '';

        const dateLabel = isPast ? `<span style="color:#e74c3c;">${row.schedule.date} (past)</span>`
            : isToday ? `<span style="color:#27ae60;font-weight:600;">Today</span>`
            : `<span>${row.schedule.date}</span>`;

        const roomIndex = allRooms.findIndex(r => r.id === row.room.id);

        const actions = `
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${isActive && isToday ? `<button class="btn-complete" onclick="openCompleteSessionModal(${roomIndex})">✓ Done</button>` : ''}
                <button class="btn-danger-outline" onclick="removeFutureSchedule(${row.room.id}, '${row.schedule.date}', '${row.schedule.startTime}', '${row.schedule.endTime}', '${row.schedule.instructor}')">Remove</button>
            </div>`;

        return `
        <tr data-date="${row.schedule.date}" data-status="${row.room.status}" data-instructor="${(row.schedule.instructor || '').toLowerCase()}" data-category="${row.room.category.toLowerCase()}" data-room="${row.room.id}">
            <td>
                <strong style="color:var(--primary);">Room ${row.room.id}</strong>
                <div style="font-size:0.8rem;color:#888;">${row.room.category}</div>
            </td>
            <td>
                <span style="font-weight:600;">${getInstructorFullName(row.schedule.instructor)}</span>
                ${row.totalInQueue > 1 ? `<div style="font-size:0.78rem;color:#888;">${row.totalInQueue} in queue</div>` : ''}
            </td>
            <td>
                ${dateLabel}
                <div style="font-size:0.85rem;color:#555;">${row.schedule.startTime || '--:--'} – ${row.schedule.endTime || '--:--'}</div>
            </td>
            <td><span class="duration-badge">${duration}</span></td>
            <td>${queueBadge}</td>
            <td>${actions}</td>
        </tr>`;
    }).join('');

    if (typeof renderPagination === 'function') {
        renderPagination('schedulePagination', totalRows, schedPage, 'goSchedulePage');
    }

    // Restore search/date input values
    const srch = document.getElementById('monitorSearch');
    const dt   = document.getElementById('monitorDateFilter');
    if (srch && savedSearch) srch.value = savedSearch;
    if (dt   && savedDate)   dt.value   = savedDate;

    updateMonitoringStats();
}

/**
 * Filter monitoring table
 */
function setScheduleFilter(filter) {
    window._scheduleFilter = filter;
    // Update active button
    ['now','today','upcoming','all'].forEach(f => {
        const btn = document.getElementById('schedFilter' + f.charAt(0).toUpperCase() + f.slice(1));
        if (btn) btn.classList.toggle('active', f === filter);
    });
    // Clear date picker unless using date filter
    if (filter !== 'date') {
        const d = document.getElementById('monitorDateFilter');
        if (d) d.value = '';
    }
    pageState.schedule = 1;
    renderMonitoringTable();
}

function filterMonitoring() {
    pageState.schedule = 1;
    renderMonitoringTable();
}

function clearScheduleFilters() {
    const s = document.getElementById('monitorSearch');
    const d = document.getElementById('monitorDateFilter');
    if (s) s.value = '';
    if (d) d.value = '';
    setScheduleFilter('now');
}

function filterMonitoring_DOM_UNUSED() {
    const searchInput = document.getElementById('monitorSearch');
    const dateInput = document.getElementById('monitorDateFilter');
    const statusInput = document.getElementById('monitorStatusFilter');

    const search = searchInput ? searchInput.value.toLowerCase() : '';
    const dateFilter = dateInput ? dateInput.value : '';
    const statusFilter = statusInput ? statusInput.value : 'all';

    const rows = document.querySelectorAll('#monitoringBody tr');
    let visibleCount = 0;

    rows.forEach(row => {
        const rowDate = row.dataset.date || '';
        const rowStatus = row.dataset.status || '';
        const rowInstructor = row.dataset.instructor || '';
        const rowCategory = row.dataset.category || '';
        const rowRoom = row.dataset.room || '';

        // Smart search: if search is a number, use exact room match. If text, use contains match
        let matchSearch = false;
        if (/^\d+$/.test(search)) {
            // Numeric search - exact room number match only
            matchSearch = rowRoom === search;
        } else if (search) {
            // Text search - match instructor or category only
            matchSearch = rowInstructor.includes(search) || rowCategory.includes(search);
        } else {
            // Empty search - show all
            matchSearch = true;
        }

        const matchDate = !dateFilter || rowDate === dateFilter;
        const matchStatus = statusFilter === 'all' || rowStatus === statusFilter;

        if (matchSearch && matchDate && matchStatus) {
            row.style.display = '';
            visibleCount++;
        } else {
            row.style.display = 'none';
        }
    });

    const noMsg = document.getElementById('noScheduleMsg');
    const table = document.getElementById('monitoringTable');

    if (noMsg) noMsg.style.display = visibleCount === 0 ? 'block' : 'none';
    if (table) table.style.display = visibleCount === 0 ? 'none' : 'table';
}

/**
 * Update monitoring statistics
 */
function updateMonitoringStats() {
    const totalEl = document.getElementById('totalScheduled');
    const todayEl = document.getElementById('activeToday');

    const today = new Date().toISOString().split('T')[0];
    const scheduledRooms = allRooms.filter(r => r.type === 'register' && r.schedules && r.schedules.length > 0);
    const activeToday = allRooms.reduce((count, r) => {
        if (!r.schedules) return count;
        return count + r.schedules.filter(s => s.date === today && s.queueStatus === 'active').length;
    }, 0);

    if (totalEl) totalEl.innerText = scheduledRooms.length;
    if (todayEl) todayEl.innerText = activeToday;

    const badge = document.getElementById('navBadgeSchedule');
    if (badge) {
        badge.textContent = activeToday;
        badge.classList.toggle('show', activeToday > 0);
    }
}

/**
 * View room schedule queue modal
 * @param {number} roomId - Room ID
 * @param {string} date - Date in YYYY-MM-DD format
 */
function viewRoomQueue(roomId, date) {
    const room = allRooms.find(r => r.type === 'register' && r.id === roomId);
    if (!room) return;

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'roomQueueModal';
    modal.style.display = 'flex';
    modal.onclick = function (event) {
        if (event.target === modal) {
            closeRoomQueueModal();
        }
    };

    const schedules = (room.schedules || []).filter(s => s.date === date);
    const formattedDate = formatDate(date);

    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <div class="modal-header">
                <h3>📅 Room ${room.id} ${room.category} - Schedule Queue</h3>
                <button class="btn-close" onclick="closeRoomQueueModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="margin-bottom: 16px; padding: 12px; background: #f0f0f0; border-radius: 8px;">
                    <p style="margin: 0; font-weight: 600;">Date: ${formattedDate}</p>
                    <p style="margin: 8px 0 0 0; color: #666;">Total Scheduled: ${schedules.length}</p>
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    ${schedules.length === 0 ?
            '<p style="color: #999; text-align: center; padding: 20px;">No schedules found</p>' :
            schedules.map((schedule, idx) => `
                            <div style="padding: 12px; background: ${idx === 0 ? '#e8f5e9' : '#f5f5f5'}; border-radius: 8px; border-left: 4px solid ${idx === 0 ? '#27ae60' : '#bdc3c7'};">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <span style="font-weight: 600; font-size: 14px;">
                                        ${idx === 0 ? '🟢 CURRENT' : `#${idx}`} - ${getInstructorFullName(schedule.instructor)}
                                    </span>
                                    <span style="background: #c0392b; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">
                                        ${schedule.startTime} - ${schedule.endTime}
                                    </span>
                                </div>
                                <div style="font-size: 12px; color: #666;">
                                    <p style="margin: 4px 0;">Purpose: ${escapeHtml(schedule.purpose || 'Schedule')}</p>
                                    <p style="margin: 4px 0;">Status: ${escapeHtml(schedule.requestedStatus || 'Scheduled')}</p>
                                </div>
                            </div>
                        `).join('')
        }
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="closeRoomQueueModal()">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

/**
 * Close room queue modal
 */
function closeRoomQueueModal() {
    const modal = document.getElementById('roomQueueModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Remove a future schedule and mark corresponding request as rejected
 * @param {number} roomId - Room ID
 * @param {string} date - Schedule date
 * @param {string} startTime - Start time
 * @param {string} endTime - End time
 * @param {string} instructor - Instructor name
 */
async function removeFutureSchedule(roomId, date, startTime, endTime, instructor) {
    const instructorFullName = getInstructorFullName(instructor);
    if (!await showConfirm(`Remove schedule for Room ${roomId} on ${formatDate(date)} (${startTime} - ${endTime}) by ${instructorFullName}? The instructor's request will be rejected.`)) {
        return;
    }

    const room = allRooms.find(r => r.id === roomId);
    if (!room || !room.schedules) {
        showToast('Room or schedule not found.', 'error');
        return;
    }

    const schedule = room.schedules.find(s =>
        s.date === date &&
        s.startTime === startTime &&
        s.endTime === endTime &&
        s.instructor === instructor
    );

    if (!schedule) {
        showToast('Schedule not found.', 'error');
        return;
    }

    try {
        if (schedule.requestId) {
            await apiFetch(`/api/requests/${schedule.requestId}`, { method: 'DELETE' });
        } else {
            await apiFetch(`/api/schedules/${schedule.id}/cancel`, { method: 'POST', body: '{}' });
        }
        await refreshData({ render: true });
        showToast('Schedule removed. The instructor\'s request has been rejected.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderMonitoringTable,
        filterMonitoring,
        updateMonitoringStats,
        viewRoomQueue,
        closeRoomQueueModal,
        removeFutureSchedule
    };
}
