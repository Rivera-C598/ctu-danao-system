/* ============================================
   CTU Room Management System - Admin Dashboard
   ============================================ */

// Current admin tab
let currentTab = 'dashboard';

// Pagination state
const PAGE_SIZE = 10;
const pageState = { rooms: 1, requests: 1, schedule: 1, users: 1 };

function renderPagination(containerId, total, currentPage, onPageFn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const totalPages = Math.ceil(total / PAGE_SIZE);
    if (totalPages <= 1) { el.innerHTML = ''; return; }
    const start = (currentPage - 1) * PAGE_SIZE + 1;
    const end = Math.min(currentPage * PAGE_SIZE, total);
    el.innerHTML = `
        <span>${start}–${end} of ${total}</span>
        <div class="pagination-controls">
            <button class="pagination-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="${onPageFn}(${currentPage - 1})">‹ Prev</button>
            <span>Page ${currentPage} of ${totalPages}</span>
            <button class="pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="${onPageFn}(${currentPage + 1})">Next ›</button>
        </div>`;
}

function paginateArray(arr, page) {
    const start = (page - 1) * PAGE_SIZE;
    return arr.slice(start, start + PAGE_SIZE);
}

function goRoomsPage(p)    { pageState.rooms    = p; renderTable(); }
function goRequestsPage(p) { pageState.requests  = p; renderRequestsTable(); }
function goSchedulePage(p) { pageState.schedule  = p; renderMonitoringTable(); }
function goUsersPage(p)    { pageState.users     = p; renderUsersTable(); }

/**
 * Initialize admin view
 */
function initAdminView() {
    renderTable();
    updateStatusCounts();
    updateDatabaseStats();
    updateRequestsSidebar();
    if (typeof startClock === 'function') startClock();
}

/**
 * Switch admin tab
 * @param {string} tab - Tab name ('dashboard', 'monitoring', 'requests', 'database')
 */
function switchTab(tab) {
    currentTab = tab;

    // Update active nav tab
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');

    // Get elements
    const sidebars = {
        dashboard: document.getElementById('dashboardSidebar'),
        monitoring: document.getElementById('monitoringSidebar'),
        requests: document.getElementById('requestsSidebar'),
        users: document.getElementById('usersSidebar'),
        database: document.getElementById('databaseSidebar')
    };

    const views = {
        dashboard: document.getElementById('dashboardView'),
        monitoring: document.getElementById('monitoringView'),
        requests: document.getElementById('requestsView'),
        users: document.getElementById('usersView'),
        database: document.getElementById('databaseView')
    };

    // Hide all sidebars and views
    Object.values(sidebars).forEach(el => {
        if (el) el.style.display = 'none';
    });
    Object.values(views).forEach(el => {
        if (el) el.style.display = 'none';
    });

    // Show selected
    if (views[tab]) {
        views[tab].style.display = 'block';
    }
    if (sidebars[tab]) {
        sidebars[tab].style.display = 'flex';
        sidebars[tab].style.flexDirection = 'column';
    }

    // Render appropriate content
    if (tab === 'dashboard') {
        renderTable();
    } else if (tab === 'monitoring') {
        renderMonitoringTable();
    } else if (tab === 'requests') {
        renderRequestsTable('pending');
    } else if (tab === 'users') {
        renderUsersView();
    } else if (tab === 'database') {
        renderDatabaseTable();
    }
}

/**
 * Update status counts in sidebar
 */
function updateStatusCounts() {
    const counts = { Available: 0, Locked: 0, Meeting: 0, Maintenance: 0 };

    allRooms.forEach(room => {
        if (counts.hasOwnProperty(room.status)) {
            counts[room.status]++;
        }
    });

    const countAll = document.getElementById('countAll');
    const countAvailable = document.getElementById('countAvailable');
    const countLocked = document.getElementById('countLocked');
    const countMeeting = document.getElementById('countMeeting');
    const countMaintenance = document.getElementById('countMaintenance');

    if (countAll) countAll.innerText = allRooms.length;
    if (countAvailable) countAvailable.innerText = counts.Available;
    if (countLocked) countLocked.innerText = counts.Locked;
    if (countMeeting) countMeeting.innerText = counts.Meeting;
    if (countMaintenance) countMaintenance.innerText = counts.Maintenance;
}

/**
 * Filter table by status
 * @param {string} status - Status to filter by
 */
function filterByStatus(status) {
    document.querySelectorAll('#tableBody tr').forEach(row => {
        const rowStatus = row.dataset.status;
        row.style.display = (status === 'all' || rowStatus === status) ? '' : 'none';
    });
    const dropdown = document.getElementById('statusFilter');
    if (dropdown) dropdown.value = status;
}

/**
 * Render main dashboard table
 */
function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    if (allRooms.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No rooms found. Add a room using the form above.</td></tr>';
        updateStatusCounts();
        return;
    }

    const allDisplayRooms = allRooms.filter(r => r.type !== 'schedule');
    const pagedRooms = paginateArray(allDisplayRooms, pageState.rooms);

    tbody.innerHTML = pagedRooms.map((room) => {
        const index = allRooms.indexOf(room);
        if (room.type === 'schedule') return '';

        const statusClass = room.status === 'Available' ? 'bg-available' :
            room.status === 'Meeting' ? 'bg-meeting' :
            room.status === 'Maintenance' ? 'bg-maintenance' : 'bg-locked';

        const isRestricted = room.isRequestable === false;
        const reqCount = (roomRequests || []).filter(r => r.roomId === room.id && ['pending','active','standby'].includes(r.status)).length;

        return `
        <tr data-status="${room.status}">
            <td><strong style="font-size:1.1rem;color:var(--primary);">${room.id}</strong></td>
            <td>
                <span style="font-weight:600;">${room.category}</span>
                ${isRestricted ? '<br><span style="display:inline-block;margin-top:4px;background:#fce4ec;color:#c0392b;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;">🚫 Requests Blocked</span>' : ''}
            </td>
            <td>
                <select class="status-selector ${statusClass}" onchange="changeStatus(${index}, this.value)">
                    <option value="Available" ${room.status === 'Available' ? 'selected' : ''}>🔓 Available</option>
                    <option value="Locked"    ${room.status === 'Locked'    ? 'selected' : ''}>🔒 Locked</option>
                    <option value="Meeting"   ${room.status === 'Meeting'   ? 'selected' : ''}>👥 Meeting</option>
                    <option value="Maintenance" ${room.status === 'Maintenance' ? 'selected' : ''}>⚙️ Maintenance</option>
                </select>
            </td>
            <td>
                ${reqCount > 0
                    ? `<button class="btn-outline-action" onclick="switchTab('requests')" title="View requests for Room ${room.id}">${reqCount} request${reqCount > 1 ? 's' : ''}</button>`
                    : '<span style="color:#bbb;font-size:0.85rem;">—</span>'}
            </td>
            <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                    <button class="${isRestricted ? 'btn-outline-action' : 'btn-danger-outline'}" onclick="toggleRoomRequestable(${room.id}, ${isRestricted ? 'true' : 'false'})">
                        ${isRestricted ? '✓ Allow Requests' : '🚫 Block Requests'}
                    </button>
                    <button class="btn-danger-outline" onclick="removeRoom(${index})">Remove</button>
                </div>
            </td>
        </tr>`;
    }).filter(row => row !== '').join('');

    renderPagination('roomsPagination', allDisplayRooms.length, pageState.rooms, 'goRoomsPage');
    updateStatusCounts();
    updateMonitoringStats();
    updateScheduleNotifications();

    // Re-apply active status filter after re-render
    const dropdown = document.getElementById('statusFilter');
    if (dropdown && dropdown.value !== 'all') filterByStatus(dropdown.value);
}

/**
 * Filter table by search
 */
function filterTable() {
    const query = document.getElementById('searchBar').value.toLowerCase().trim();
    const rows = document.querySelectorAll('#tableBody tr');

    rows.forEach((row, i) => {
        const room = allRooms[i];
        if (!room) { row.style.display = 'none'; return; }

        let match = false;
        if (!query) {
            match = true;
        } else if (/^\d+$/.test(query)) {
            match = room.id.toString() === query;
        } else {
            const fullName = (room.schedules?.[0]?.instructorName || getInstructorFullName(room.instructor) || '').toLowerCase();
            const username = (room.instructor || '').toLowerCase();
            match = fullName.includes(query) ||
                username.includes(query) ||
                room.status.toLowerCase().includes(query) ||
                room.category.toLowerCase().includes(query);
        }

        row.style.display = match ? '' : 'none';
    });
}

/**
 * Clear room history
 * @param {number} index - Room index
 */
async function clearHistory(index) {
    if (await showConfirm(`Clear all logs for Room ${allRooms[index].id}?`)) {
        allRooms[index].history = [];
        saveToStorage();
        renderTable();
    }
}

/**
 * Open modal to confirm session completion and show next schedule
 * @param {number} index - Room index
 */
function openCompleteSessionModal(index) {
    const room = allRooms[index];
    if (!room.schedules || room.schedules.length === 0) {
        showToast('No schedules found for this room', 'error');
        return;
    }

    const currentSchedule = room.schedules[0];
    const nextSchedule = room.schedules.length > 1 ? room.schedules[1] : null;

    // Build modal content
    let modalHTML = `
        <div class="modal" id="completeSessionModal" onclick="if (event.target === this) closeCompleteSessionModal()">
            <div class="modal-content complete-session-modal" style="max-width: 600px;">
                <div class="modal-header" style="border-bottom: 2px solid var(--success); background: rgba(39, 174, 96, 0.1);">
                    <h3>✓ Complete Session</h3>
                    <button class="btn-close" onclick="closeCompleteSessionModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="session-info-box" style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: var(--accent);">Current Session - Ending Now</h4>
                        <div style="font-size: 0.95rem;">
                            <p style="margin: 5px 0;"><strong>Room No:</strong> ${room.id}</p>
                            <p style="margin: 5px 0;"><strong>Instructor:</strong> ${getInstructorFullName(currentSchedule.instructor)}</p>
                            <p style="margin: 5px 0;"><strong>Category:</strong> ${room.category}</p>
                            <p style="margin: 5px 0;"><strong>Date:</strong> ${currentSchedule.date}</p>
                            <p style="margin: 5px 0;"><strong>Time:</strong> ${currentSchedule.startTime} - ${currentSchedule.endTime}</p>
                        </div>
                    </div>

                    ${nextSchedule ? `
                        <div class="session-info-box" style="background: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 4px solid var(--success); margin-bottom: 20px;">
                            <h4 style="margin: 0 0 10px 0; color: var(--success);">Next Schedule</h4>
                            <div style="font-size: 0.95rem;">
                                <p style="margin: 5px 0;"><strong>Instructor:</strong> ${getInstructorFullName(nextSchedule.instructor)}</p>
                                <p style="margin: 5px 0;"><strong>Date:</strong> ${nextSchedule.date}</p>
                                <p style="margin: 5px 0;"><strong>Time:</strong> ${nextSchedule.startTime} - ${nextSchedule.endTime}</p>
                                <p style="margin: 5px 0;"><strong>Category:</strong> ${room.category}</p>
                            </div>
                            <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                                <button class="btn-action" onclick="activateNextSchedule(${index})" style="background: #27ae60; color: white; flex: 1; min-width: 100px; font-weight: 700; border: none; padding: 12px 16px; border-radius: 6px; cursor: pointer; font-size: 0.95rem;">▶ Next</button>
                                <button class="btn-action" onclick="removeNextSchedule(${index})" style="background: #e74c3c; color: white; flex: 1; min-width: 100px; font-weight: 700; border: none; padding: 12px 16px; border-radius: 6px; cursor: pointer; font-size: 0.95rem;">🗑 Remove</button>
                            </div>
                        </div>

                        ${room.schedules.length > 2 ? `
                            <div style="background: #e8f5e9; padding: 15px; border-radius: 8px; border-left: 4px solid var(--success); margin-bottom: 20px;">
                                <h4 style="margin: 0 0 12px 0; color: var(--success); font-size: 0.95rem;">📋 Queue (${room.schedules.length - 1} total)</h4>
                                <div style="max-height: 250px; overflow-y: auto;">
                                    ${room.schedules.slice(1).map((sched, idx) => {
        let statusColor = '#27ae60';
        let statusIcon = '🔓';
        if (room.status === 'Locked') {
            statusColor = '#c0392b';
            statusIcon = '🔒';
        } else if (room.status === 'Meeting') {
            statusColor = '#8e44ad';
            statusIcon = '👥';
        } else if (room.status === 'Maintenance') {
            statusColor = '#f39c12';
            statusIcon = '⚙️';
        }
        return `
                                        <div style="background: white; padding: 12px; margin: 8px 0; border-radius: 6px; border-left: 4px solid var(--success); font-size: 0.9rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                            <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 6px;">
                                                <div style="flex: 1;">
                                                    <p style="margin: 0;"><strong style="color: var(--success);">#${idx + 2}</strong> <strong>${getInstructorFullName(sched.instructor)}</strong></p>
                                                </div>
                                                <span style="background: ${statusColor}; color: white; padding: 6px 10px; border-radius: 3px; font-size: 0.7rem; font-weight: 700; white-space: nowrap;">
                                                    ${statusIcon} ${room.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <div style="font-size: 0.85rem; color: #666;">
                                                <p style="margin: 0 0 2px 0;">📅 ${sched.date}</p>
                                                <p style="margin: 0;">🕐 ${sched.startTime} - ${sched.endTime}</p>
                                            </div>
                                        </div>
                                        `;
    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                    ` : `
                        <div class="session-info-box" style="background: #fce4ec; padding: 15px; border-radius: 8px; border-left: 4px solid var(--warning); margin-bottom: 20px;">
                            <h4 style="margin: 0 0 10px 0; color: var(--warning);">⚠️ No More Schedules</h4>
                            <p style="margin: 5px 0; font-size: 0.95rem;">This is the last instructor. Room will be marked as <strong>Available</strong> after completion.</p>
                            <div style="margin-top: 15px;">
                                <button class="btn-action" onclick="completeFinalSession(${index})" style="background: #27ae60; color: white; width: 100%; font-weight: 700; border: none; padding: 12px 16px; border-radius: 6px; cursor: pointer; font-size: 0.95rem;">✓ Complete Session</button>
                            </div>
                        </div>
                    `}

                    <p style="margin: 20px 0 10px 0; font-size: 0.9rem; color: #666; font-style: italic;">
                        ✓ Key received and session completed | Instructors will be notified
                    </p>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" onclick="closeCompleteSessionModal()">Cancel</button>
                    <button class="btn-confirm" onclick="completeCurrentSession(${index})" style="background: var(--success); color: white;">✓ Confirm Completion</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.getElementById('completeSessionModal').style.display = 'flex';
}

/**
 * Close the complete session modal
 */
function closeCompleteSessionModal() {
    const modal = document.getElementById('completeSessionModal');
    if (modal) {
        modal.remove();
    }
}


/**
 * Send notifications for session completion
 * @param {object} room - Room object
 * @param {string} currentInstructor - Current instructor name
 * @param {string|null} nextInstructor - Next instructor name (if any)
 */
function notifySessionCompletion(room, currentInstructor, nextInstructor) {
    // Show admin notification
    if (typeof showNotification === 'function') {
        showNotification(
            '✓ Session Completed',
            `${currentInstructor}'s session in Room ${room.id} has ended.`,
            'success',
            5000
        );

        // If there's a next instructor, notify them
        if (nextInstructor) {
            setTimeout(() => {
                showNotification(
                    '👥 Your Turn!',
                    `Room ${room.id} is ready! ${nextInstructor}, your schedule has started.`,
                    'info',
                    5000
                );
            }, 1000);
        }
    }

    // Also show toast for immediate feedback
    let alertMsg = `✓ Session completed for ${currentInstructor} in Room ${room.id}!`;
    if (nextInstructor) {
        alertMsg += ` 👥 ${nextInstructor}'s session is now active!`;
    } else {
        alertMsg += ' 🔓 Room is now available.';
    }
    showToast(alertMsg, 'success');
}

/**
 * Activate next schedule immediately without completing current
 * @param {number} index - Room index
 */
function activateNextSchedule(index) {
    const room = allRooms[index];
    if (!room.schedules || room.schedules.length < 2) {
        showToast('No next schedule available', 'error');
        return;
    }

    const time = new Date().toLocaleTimeString();
    const currentSchedule = room.schedules[0];
    const nextSchedule = room.schedules[1];
    const nextInstructor = nextSchedule.instructor;
    const previousInstructor = currentSchedule.instructor;

    // Remove the first schedule completely
    room.schedules.shift();

    // Now the next schedule is at index 0 and is the active one
    room.schedules[0].queueStatus = 'active';

    // Update room info - instructor name changes to next person
    room.instructor = nextInstructor;
    room.status = nextSchedule.requestedRoomStatus || room.status;  // Use the next schedule's requested status

    room.history.push(`${time} - ▶ ${previousInstructor} finished. Next schedule activated for ${nextInstructor}`);

    addLog('schedule_activated', room.id, nextInstructor, room.category,
        `Next schedule activated: ${nextSchedule.date} ${nextSchedule.startTime}-${nextSchedule.endTime}`, room.status);

    saveToStorage();
    renderTable();
    updateScheduleNotifications();
    closeCompleteSessionModal();

    // Show notifications
    if (typeof showNotification === 'function') {
        showNotification(
            '▶ Next Schedule Activated',
            `${nextInstructor}'s schedule is now active in Room ${room.id}!`,
            'success',
            5000
        );
    }

    showToast(`✓ Next schedule activated! ${nextInstructor} can now use Room ${room.id}.`, 'success');
}

/**
 * Remove next schedule and notify the instructor
 * @param {number} index - Room index
 */
async function removeNextSchedule(index) {
    const room = allRooms[index];
    if (!room.schedules || room.schedules.length < 2) {
        showToast('No next schedule available to remove', 'error');
        return;
    }

    if (!await showConfirm('Remove the next instructor\'s schedule? They will be notified.')) {
        return;
    }

    const time = new Date().toLocaleTimeString();
    const nextSchedule = room.schedules[1];
    const nextInstructor = nextSchedule.instructor;

    // Remove the next schedule from the queue
    const removedSchedule = room.schedules.splice(1, 1)[0];

    room.history.push(`${time} - 🗑 Removed schedule for ${nextInstructor}`);

    addLog('schedule_removed', room.id, nextInstructor, room.category,
        `Schedule removed by admin: ${nextSchedule.date} ${nextSchedule.startTime}-${nextSchedule.endTime}`, room.status);

    saveToStorage();
    renderTable();
    updateScheduleNotifications();
    closeCompleteSessionModal();

    // Send notification to instructor
    if (typeof showNotification === 'function') {
        showNotification(
            '⚠️ Schedule Removed',
            `${nextInstructor}'s schedule in Room ${room.id} has been removed by admin.`,
            'warning',
            5000
        );
    }

    showToast(`✓ Schedule removed! ${nextInstructor}'s schedule in Room ${room.id} has been cancelled.`, 'success');
}

/**
 * Complete the final (only) schedule and reset room to normal
 * @param {number} index - Room index
 */
function completeFinalSession(index) {
    const room = allRooms[index];
    if (!room.schedules || room.schedules.length === 0) {
        showToast('No schedule found', 'error');
        return;
    }

    const time = new Date().toLocaleTimeString();
    const lastSchedule = room.schedules[0];
    const instructorName = lastSchedule.instructor;

    // Mark as completed
    lastSchedule.queueStatus = 'completed';
    lastSchedule.completedAt = new Date().toLocaleString();

    // Clear all schedules
    room.schedules = [];

    // Reset room to normal state
    room.instructor = '';
    room.date = '';
    room.startTime = '';
    room.endTime = '';
    room.status = 'Available';

    // Log the completion
    room.history.push(`${time} - ✓ Final session completed by ${instructorName}. Room reset to Available.`);

    addLog('session_completed', room.id, instructorName, room.category,
        'Final session completed. Room reset to Available state.', 'Available');

    saveToStorage();
    renderTable();
    updateScheduleNotifications();
    closeCompleteSessionModal();

    // Show notifications
    if (typeof showNotification === 'function') {
        showNotification(
            '✓ Session Completed',
            `${instructorName}'s session in Room ${room.id} has ended. Room is now Available.`,
            'success',
            5000
        );
    }

    showToast(`✓ Session completed! ${instructorName}'s session in Room ${room.id} has finished. Room is now Available.`, 'success');
}

/**
 * Open create admin modal
 */
function openCreateAdminModal() {
    const modal = document.getElementById('createAdminModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
        document.getElementById('adminUsername').focus();
    }
}

/**
 * Close create admin modal
 */
function closeCreateAdminModal() {
    const modal = document.getElementById('createAdminModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
        clearCreateAdminForm();
    }
}

/**
 * Clear create admin form
 */
function clearCreateAdminForm() {
    document.getElementById('adminUsername').value = '';
    document.getElementById('adminFullName').value = '';
    document.getElementById('adminEmail').value = '';
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminConfirmPassword').value = '';
    document.getElementById('adminUsernameStatus').style.display = 'none';
    document.getElementById('adminPasswordMatch').style.display = 'none';
    document.getElementById('adminCreateMessage').style.display = 'none';
}

/**
 * Check if username is available
 */
function checkAdminUsernameAvailability() {
    const username = document.getElementById('adminUsername').value.trim().toLowerCase();
    const statusEl = document.getElementById('adminUsernameStatus');

    if (!username) {
        statusEl.style.display = 'none';
        return false;
    }

    if (username.length < 3) {
        statusEl.textContent = 'Username must be at least 3 characters';
        statusEl.style.color = '#d32f2f';
        statusEl.style.display = 'block';
        return false;
    }

    // Check if username exists
    const existingUser = usersDatabase.find(u => u.username.toLowerCase() === username);

    if (existingUser) {
        statusEl.textContent = `❌ Username "${username}" is already taken`;
        statusEl.style.color = '#d32f2f';
        statusEl.style.display = 'block';
        return false;
    } else {
        statusEl.textContent = '✓ Username is available';
        statusEl.style.color = '#4caf50';
        statusEl.style.display = 'block';
        return true;
    }
}

/**
 * Check if passwords match
 */
function checkAdminPasswordMatch() {
    const password = document.getElementById('adminPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    const matchEl = document.getElementById('adminPasswordMatch');

    if (!password || !confirmPassword) {
        matchEl.style.display = 'none';
        return false;
    }

    if (password.length < 6) {
        matchEl.textContent = 'Password must be at least 6 characters';
        matchEl.style.color = '#d32f2f';
        matchEl.style.display = 'block';
        return false;
    }

    if (password !== confirmPassword) {
        matchEl.textContent = '❌ Passwords do not match';
        matchEl.style.color = '#d32f2f';
        matchEl.style.display = 'block';
        return false;
    } else {
        matchEl.textContent = '✓ Passwords match';
        matchEl.style.color = '#4caf50';
        matchEl.style.display = 'block';
        return true;
    }
}

/**
 * Create new admin account
 */
// Legacy localStorage implementation kept temporarily for reference; UI calls the API-backed createAdminAccount below.
function legacyCreateAdminAccount() {
    const username = document.getElementById('adminUsername').value.trim().toLowerCase();
    const fullName = document.getElementById('adminFullName').value.trim();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    const messageEl = document.getElementById('adminCreateMessage');

    // Validation checks
    if (!username || username.length < 3) {
        messageEl.textContent = 'Please enter a valid username (at least 3 characters)';
        messageEl.style.color = '#d32f2f';
        messageEl.style.display = 'block';
        return;
    }

    if (!fullName) {
        messageEl.textContent = 'Please enter full name';
        messageEl.style.color = '#d32f2f';
        messageEl.style.display = 'block';
        return;
    }

    // Check username availability
    const existingUser = usersDatabase.find(u => u.username.toLowerCase() === username);
    if (existingUser) {
        messageEl.textContent = `Username "${username}" is already taken`;
        messageEl.style.color = '#d32f2f';
        messageEl.style.display = 'block';
        return;
    }

    // Check password
    if (password.length < 6) {
        messageEl.textContent = 'Password must be at least 6 characters';
        messageEl.style.color = '#d32f2f';
        messageEl.style.display = 'block';
        return;
    }

    if (password !== confirmPassword) {
        messageEl.textContent = 'Passwords do not match';
        messageEl.style.color = '#d32f2f';
        messageEl.style.display = 'block';
        return;
    }

    // Create new admin account
    const newAdmin = {
        username: username,
        password: password,
        fullName: fullName,
        email: email || null,
        role: 'admin',
        createdAt: new Date().toISOString(),
        createdBy: getSession().username,
        lastLogin: null,
        loginCount: 0
    };

    console.warn('legacyCreateAdminAccount is disabled; use the API-backed createAdminAccount implementation.');
    return;

    // Show success message
    messageEl.innerHTML = `<span style="color: #4caf50;">✓ Admin account created successfully!</span><br><strong>Username:</strong> ${username}<br><strong>Name:</strong> ${fullName}`;
    messageEl.style.display = 'block';

    // Log the action
    addLog('admin-create', 'N/A', username, 'Admin', `New admin account created: ${fullName} (${username})`, 'Admin');

    // Clear form and close after 2 seconds
    setTimeout(() => {
        clearCreateAdminForm();
        closeCreateAdminModal();
        showNotification(`✓ Admin account "${username}" created successfully!`, 'success');
    }, 2000);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        currentTab,
        initAdminView,
        switchTab,
        updateStatusCounts,
        filterByStatus,
        renderTable,
        filterTable,
        updateData,
        changeStatus,
        resetSchedule,
        clearRoomSchedules,
        clearHistory,
        removeRoom,
        openCompleteSessionModal,
        closeCompleteSessionModal,
        completeCurrentSession,
        activateNextSchedule,
        removeNextSchedule,
        completeFinalSession
    };
}

function renderUsersView() {
    renderRegistrationCodes();
    renderUsersTable();
    const instructors = usersDatabase.filter(u => u.role === 'instructor');
    const unused = registrationCodes.filter(c => !c.usedAt && !c.revokedAt);
    const totalEl = document.getElementById('totalUsersCount');
    const instrEl = document.getElementById('instructorCount');
    const unusedEl = document.getElementById('unusedCodesCount');
    if (totalEl) totalEl.textContent = usersDatabase.length;
    if (instrEl) instrEl.textContent = instructors.length;
    if (unusedEl) unusedEl.textContent = unused.length;
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    const noMsg = document.getElementById('noUsersMsg');
    if (!tbody) return;
    const instructors = usersDatabase.filter(u => u.role === 'instructor');
    if (instructors.length === 0) {
        tbody.innerHTML = '';
        if (noMsg) noMsg.style.display = 'block';
        return;
    }
    if (noMsg) noMsg.style.display = 'none';
    const totalUsers = instructors.length;
    const usrPage = pageState.users || 1;
    const pagedUsers = paginateArray(instructors, usrPage);

    tbody.innerHTML = pagedUsers.map(u => {
        const lastLogin = u.lastLogin ? new Date(u.lastLogin).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
        const uName = u.fullName || u.username || '?';
        const uBg = typeof avatarColor === 'function' ? avatarColor(uName) : 'var(--primary)';
        const uInitials = typeof avatarInitials === 'function' ? avatarInitials(uName) : uName[0].toUpperCase();
        return `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:10px;">
                    ${u.avatarUrl
                        ? `<img src="${u.avatarUrl}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`
                        : `<div style="width:34px;height:34px;border-radius:50%;background:${uBg};color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.85rem;flex-shrink:0;">${uInitials}</div>`}
                    <div>
                        <div style="font-weight:600;">${u.fullName || '—'}</div>
                        <div style="font-size:0.78rem;color:#888;">@${u.username}</div>
                    </div>
                </div>
            </td>
            <td>${u.email || '—'}</td>
            <td>${lastLogin}</td>
            <td><span style="font-weight:600;">${u.loginCount || 0}</span></td>
            <td style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn-outline-action" onclick="adminResetPassword('${u.id}', '${u.username}')">Reset Password</button>
                <button class="btn-danger-outline" style="font-size:0.78rem;padding:5px 10px;" onclick="adminDeleteUser('${u.id}', '${u.fullName||u.username}')">Delete</button>
            </td>
        </tr>`;
    }).join('');
    renderPagination('usersPagination', totalUsers, usrPage, 'goUsersPage');
}

async function adminDeleteUser(userId, name) {
    if (!await showConfirm(`Permanently delete account for "${name}"?\n\nThis removes their account and all associated data.`, {
        title: 'Delete Instructor Account',
        confirmText: 'Delete',
        confirmStyle: 'background:#e74c3c;color:white;'
    })) return;
    try {
        await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' });
        await refreshData({ render: true, force: true });
        showNotification('Deleted', `Account for "${name}" has been removed.`, 'success', 3000);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function adminResetPassword(userId, username) {
    const newPassword = await showPromptDialog('Set new password', { title: 'Reset Password for ' + username, placeholder: 'Min 6 characters' });
    if (!newPassword) return;
    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters.', 'error');
        return;
    }
    try {
        await apiFetch(`/api/admin/users/${userId}/reset-password`, {
            method: 'POST',
            body: JSON.stringify({ newPassword })
        });
        showToast(`Password for "${username}" has been reset.`, 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// API-mode overrides. These replace legacy full-state mutations declared above.
async function updateData(index, field, value) {
    const room = allRooms[index];
    if (!room) return;
    if (field === 'id' || field === 'instructor' || field === 'date' || field === 'startTime' || field === 'endTime') {
        showToast('Direct schedule/room-number edits are disabled in database mode. Use requests or recreate the room.', 'error');
        await refreshData({ render: true });
        return;
    }
    try {
        await apiFetch(`/api/rooms/${room.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ [field]: value })
        });
        await refreshData({ render: true });
    } catch (error) {
        showToast(error.message, 'error');
        await refreshData({ render: true });
    }
}

async function changeStatus(index, newStatus) {
    const room = allRooms[index];
    if (!room) return;
    if (!await showConfirm(`Change Room ${room.id} status to "${newStatus}"?`)) {
        await refreshData({ render: true });
        return;
    }
    try {
        await apiFetch(`/api/rooms/${room.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: newStatus })
        });
        await refreshData({ render: true });
    } catch (error) {
        showToast(error.message, 'error');
        await refreshData({ render: true });
    }
}

async function toggleRoomRequestable(roomNumber, isRequestable) {
    try {
        await apiFetch(`/api/rooms/${roomNumber}`, {
            method: 'PATCH',
            body: JSON.stringify({ isRequestable })
        });
        await refreshData({ render: true });
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function resetSchedule(index) {
    const room = allRooms[index];
    if (!room) return;
    if (!await showConfirm(`Cancel active/standby schedules for Room ${room.id}?`)) return;
    try {
        for (const schedule of room.schedules || []) {
            if (schedule.requestId) {
                await apiFetch(`/api/requests/${schedule.requestId}`, { method: 'DELETE' });
            }
        }
        await apiFetch(`/api/rooms/${room.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'Available' })
        });
        await refreshData({ render: true });
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function clearRoomSchedules(index) {
    resetSchedule(index);
}

async function removeRoom(index) {
    const room = allRooms[index];
    if (!room || !await showConfirm('Remove this room?')) return;
    try {
        await apiFetch(`/api/rooms/${room.id}`, { method: 'DELETE' });
        await refreshData({ render: true });
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function completeCurrentSession(index) {
    const room = allRooms[index];
    const active = room?.schedules?.find(schedule => schedule.queueStatus === 'active') || room?.schedules?.[0];
    if (!active) { showToast('No active schedule found', 'error'); return; }
    try {
        await apiFetch(`/api/schedules/${active.id}/done`, { method: 'POST', body: '{}' });
        await refreshData({ render: true });
        closeCompleteSessionModal();
        showToast('Session completed.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function activateNextSchedule(index) {
    completeCurrentSession(index);
}

async function removeNextSchedule(index) {
    const room = allRooms[index];
    const next = room?.schedules?.find(schedule => schedule.queueStatus === 'standby') || room?.schedules?.[1];
    if (!next || !next.requestId) { showToast('No next schedule available to remove', 'error'); return; }
    if (!await showConfirm('Remove the next instructor schedule?')) return;
    try {
        await apiFetch(`/api/requests/${next.requestId}`, { method: 'DELETE' });
        await refreshData({ render: true });
        closeCompleteSessionModal();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function completeFinalSession(index) {
    completeCurrentSession(index);
}

let _codesFilter = 'unused';

async function createRegistrationCode() {
    if (!await showConfirm('Generate a new registration code?', { confirmText: 'Generate', confirmStyle: 'background:#27ae60;color:white;' })) return;
    try {
        const result = await apiFetch('/api/registration-codes', { method: 'POST', body: '{}' });
        await refreshData({ render: true });
        // Show result with copy button
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
        overlay.innerHTML = `
            <div style="background:white;border-radius:14px;padding:28px;max-width:360px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.25);">
                <div style="font-size:2rem;margin-bottom:12px;">🎉</div>
                <div style="font-weight:700;font-size:1rem;margin-bottom:6px;">Code Generated!</div>
                <div style="font-size:0.85rem;color:#666;margin-bottom:16px;">Share this one-time code with the instructor.</div>
                <div style="background:#f5f5f5;border-radius:8px;padding:14px;font-family:monospace;font-size:1.2rem;font-weight:700;color:var(--primary,#c0392b);letter-spacing:0.05em;margin-bottom:16px;">${result.code}</div>
                <div style="display:flex;gap:10px;">
                    <button onclick="navigator.clipboard.writeText('${result.code}').then(()=>this.textContent='✓ Copied!')" style="flex:1;padding:10px;border:1.5px solid #ddd;background:white;border-radius:8px;cursor:pointer;font-weight:600;">📋 Copy</button>
                    <button onclick="this.closest('div[style*=fixed]').remove()" style="flex:1;padding:10px;border:none;background:var(--primary,#c0392b);color:white;border-radius:8px;cursor:pointer;font-weight:700;">Done</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function revokeRegistrationCode(id) {
    if (!await showConfirm('Revoke this code? The instructor will no longer be able to use it.', {
        confirmText: 'Revoke', confirmStyle: 'background:#e74c3c;color:white;', title: 'Revoke Code'
    })) return;
    try {
        await apiFetch(`/api/registration-codes/${id}`, { method: 'DELETE' });
        await refreshData({ render: true });
        showToast('Code revoked.', 'info');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteRevokedCode(id) {
    if (!await showConfirm('Permanently delete this revoked code? This cannot be undone.', {
        confirmText: 'Delete', confirmStyle: 'background:#e74c3c;color:white;'
    })) return;
    try {
        await apiFetch(`/api/registration-codes/${id}/permanent`, { method: 'DELETE' });
        await refreshData({ render: true });
        showToast('Code permanently deleted.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function setCodesFilter(f) {
    _codesFilter = f;
    document.querySelectorAll('.codes-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.f === f));
    renderRegistrationCodes(1);
}

let codesPage = 1;
const CODES_PER_PAGE = 8;

function renderRegistrationCodes(page) {
    if (page) codesPage = page;
    const container = document.getElementById('registrationCodesList');
    if (!container) return;

    const all = registrationCodes || [];
    const filtered = all.filter(c => {
        if (_codesFilter === 'unused')  return !c.usedAt && !c.revokedAt;
        if (_codesFilter === 'used')    return !!c.usedAt;
        if (_codesFilter === 'revoked') return !!c.revokedAt;
        return true;
    });

    if (all.length === 0) {
        container.innerHTML = '<p style="color:#999;font-size:0.9rem;">No codes yet.</p>';
        return;
    }

    const totalPages = Math.ceil(filtered.length / CODES_PER_PAGE);
    const pageCodes  = filtered.slice((codesPage - 1) * CODES_PER_PAGE, codesPage * CODES_PER_PAGE);

    const rows = pageCodes.length === 0
        ? '<p style="color:#999;font-size:0.85rem;padding:8px 0;">No codes in this category.</p>'
        : pageCodes.map(code => {
            const isUsed    = !!code.usedAt;
            const isRevoked = !!code.revokedAt;
            const badge = isUsed
                ? `<span class="badge-used">✓ Used by ${code.usedBy || 'unknown'}</span>`
                : isRevoked
                ? `<span class="badge-revoked">✕ Revoked</span>`
                : `<span class="badge-unused">● Unused</span>`;
            const meta = isUsed
                ? `Used ${new Date(code.usedAt).toLocaleDateString()}`
                : isRevoked
                ? `Revoked ${new Date(code.revokedAt).toLocaleDateString()}`
                : 'Ready to share';
            const actions = isRevoked
                ? `<button class="btn-danger-outline" style="padding:4px 10px;font-size:0.78rem;" onclick="deleteRevokedCode('${code.id}')">Delete</button>`
                : !isUsed
                ? `<button onclick="navigator.clipboard.writeText('${code.code}').then(()=>this.textContent='✓')" style="padding:4px 8px;font-size:0.78rem;border:1.5px solid #ddd;background:white;border-radius:6px;cursor:pointer;" title="Copy code">📋</button>
                   <button class="btn-danger-outline" style="padding:4px 10px;font-size:0.78rem;" onclick="revokeRegistrationCode('${code.id}')">Revoke</button>`
                : '';
            return `
                <div class="reg-code-item">
                    <div>
                        <div class="reg-code-text">${code.code}</div>
                        <div class="reg-code-meta">${meta}</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:8px;">${badge}${actions}</div>
                </div>`;
        }).join('');

    const pagination = totalPages > 1 ? `
        <div class="table-pagination" style="margin-top:10px;">
            <span>${filtered.length} code${filtered.length !== 1 ? 's' : ''}</span>
            <div class="pagination-controls">
                <button class="pagination-btn" ${codesPage === 1 ? 'disabled' : ''} onclick="renderRegistrationCodes(${codesPage - 1})">‹</button>
                <span>${codesPage} / ${totalPages}</span>
                <button class="pagination-btn" ${codesPage === totalPages ? 'disabled' : ''} onclick="renderRegistrationCodes(${codesPage + 1})">›</button>
            </div>
        </div>` : `<div style="font-size:0.78rem;color:#999;margin-top:6px;">${filtered.length} code${filtered.length !== 1 ? 's' : ''}</div>`;

    container.innerHTML = rows + pagination;
}

async function createAdminAccount() {
    const username = document.getElementById('adminUsername').value.trim().toLowerCase();
    const fullName = document.getElementById('adminFullName').value.trim();
    const email = document.getElementById('adminEmail').value.trim();
    const password = document.getElementById('adminPassword').value;
    const confirmPassword = document.getElementById('adminConfirmPassword').value;
    const messageEl = document.getElementById('adminCreateMessage');

    if (!username || username.length < 3 || !fullName || password.length < 6 || password !== confirmPassword) {
        messageEl.textContent = 'Please complete the form and make sure passwords match.';
        messageEl.style.color = '#d32f2f';
        messageEl.style.display = 'block';
        return;
    }

    try {
        await apiFetch('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify({ username, fullName, email: email || null, password, role: 'admin' })
        });
        await refreshData({ render: true });
        messageEl.textContent = 'Admin account created successfully.';
        messageEl.style.color = '#4caf50';
        messageEl.style.display = 'block';
        setTimeout(closeCreateAdminModal, 1000);
    } catch (error) {
        messageEl.textContent = error.message;
        messageEl.style.color = '#d32f2f';
        messageEl.style.display = 'block';
    }
}
