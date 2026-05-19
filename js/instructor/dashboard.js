/* ============================================
CTU Room Management System - Instructor Dashboard
============================================ */

let currentInstructorTab = 'myschedules';
let selectedRoomForRequest = null;

function initInstructorView() {
    const session = getSession();
    if (session) {
        const name = session.fullName || session.username;
        const el = document.getElementById('instructorName');
        const mobileEl = document.getElementById('mobileInstructorUsername');
        const avatarEl = document.getElementById('instructorAvatar');
        const mobileAvatar = document.getElementById('mobileInstructorAvatar');
        if (el) el.textContent = name;
        if (mobileEl) mobileEl.textContent = name;
        if (avatarEl) avatarEl.textContent = name[0]?.toUpperCase() || 'I';
        if (mobileAvatar) mobileAvatar.textContent = name[0]?.toUpperCase() || '👤';
    }
    switchInstructorTab('myschedules');
    updateInstructorStats();
    if (typeof startClock === 'function') startClock();
}

function switchInstructorTab(tab) {
    currentInstructorTab = tab;

    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('active'));

    ['mySchedulesTab','requestsTab','historyTab'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
    const fab = document.getElementById('floatingRequestBtn');
    if (fab) fab.style.display = 'none';

    if (tab === 'myschedules') {
        document.getElementById('mySchedulesTab').style.display = 'block';
        document.getElementById('navBtnSchedule')?.classList.add('active');
        document.getElementById('menuBtnSchedule')?.classList.add('active');
        renderMySchedules();
    } else if (tab === 'requests') {
        document.getElementById('requestsTab').style.display = 'block';
        document.getElementById('navBtnRequests')?.classList.add('active');
        document.getElementById('menuBtnRequests')?.classList.add('active');
        if (typeof clearRequestsBadge === 'function') clearRequestsBadge();
        renderMyRequests();
    } else if (tab === 'history') {
        document.getElementById('historyTab').style.display = 'block';
        document.getElementById('navBtnHistory')?.classList.add('active');
        document.getElementById('menuBtnHistory')?.classList.add('active');
        renderMyHistory();
    }
}

/* ── Room Picker Sheet ── */
function openRoomPicker() {
    const sheet = document.getElementById('roomPickerSheet');
    if (sheet) {
        sheet.style.display = 'flex';
        renderRoomPickerList('');
        const input = document.getElementById('roomPickerSearch');
        if (input) { input.value = ''; setTimeout(() => input.focus(), 100); }
    }
}

function closeRoomPicker() {
    const sheet = document.getElementById('roomPickerSheet');
    if (sheet) sheet.style.display = 'none';
}

function filterRoomPicker(query) {
    renderRoomPickerList(query);
}

function renderRoomPickerList(query) {
    const list = document.getElementById('roomPickerList');
    if (!list) return;
    const q = (query || '').toLowerCase().trim();

    const rooms = allRooms.filter(r => r.type !== 'schedule');
    const filtered = rooms.filter(r => {
        if (!q) return true;
        return r.id.toString() === q || r.category.toLowerCase().includes(q);
    });

    if (filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center;color:#999;padding:20px;">No rooms found.</p>';
        return;
    }

    const today = new Date().toISOString().split('T')[0];

    list.innerHTML = filtered.map(room => {
        const statusColor = {
            Available:   'var(--green,#27ae60)',
            Locked:      'var(--red,#c0392b)',
            Meeting:     'var(--purple,#7b3fa0)',
            Maintenance: 'var(--orange,#d4680a)'
        }[room.status] || '#999';

        // Booked slots today from room_schedules (active/standby)
        const todaySlots = (room.schedules || [])
            .filter(s => s.date === today)
            .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        // Also check pending requests for this room today (not yet approved but claimed)
        const pendingSlots = (roomRequests || [])
            .filter(r => r.roomId === room.id && r.date === today && r.status === 'pending')
            .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));

        const slotHTML = todaySlots.length === 0 && pendingSlots.length === 0
            ? `<div style="font-size:11px;color:var(--green,#27ae60);margin-top:3px;">✓ No bookings today</div>`
            : [
                ...todaySlots.map(s => `<span style="display:inline-block;background:rgba(192,57,43,0.1);color:#c0392b;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600;margin:2px 2px 0 0;">${s.startTime}–${s.endTime}</span>`),
                ...pendingSlots.map(s => `<span style="display:inline-block;background:rgba(243,156,18,0.1);color:#d4680a;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:600;margin:2px 2px 0 0;">${s.startTime}–${s.endTime} ⏳</span>`)
              ].join('');

        const isBlocked = room.isRequestable === false;
        const session = getSession();
        const myUser = (session?.username || '').toLowerCase().trim();
        const myTodaySlots = (roomRequests || []).filter(r =>
            (r.instructor || '').toLowerCase().trim() === myUser &&
            r.roomId === room.id && r.date === today &&
            ['pending','active','standby'].includes(r.status)
        );
        const iMineAlready = myTodaySlots.length > 0;

        return `
        <div onclick="${isBlocked ? '' : `event.stopPropagation();selectRoomFromPicker(${room.id})`}" style="padding:14px 4px;border-bottom:1px solid var(--border,#f0f0f0);cursor:${isBlocked ? 'default' : 'pointer'};opacity:${isBlocked ? '0.6' : '1'};${iMineAlready ? 'background:rgba(243,156,18,0.05);' : ''}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px;">
                <div>
                    <span style="font-weight:700;font-size:14px;">Room ${room.id}</span>
                    <span style="font-size:12px;color:#888;margin-left:6px;">${room.category}</span>
                    ${iMineAlready ? '<span style="margin-left:6px;background:rgba(243,156,18,0.15);color:#d4680a;border-radius:4px;padding:1px 6px;font-size:10px;font-weight:700;">⚠ Your booking</span>' : ''}
                </div>
                ${isBlocked
                    ? '<span style="background:#e74c3c;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;flex-shrink:0;">🚫 Blocked</span>'
                    : `<span style="background:${statusColor};color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;flex-shrink:0;">${room.status}</span>`}
            </div>
            <div style="font-size:11px;color:#888;line-height:1.8;">${slotHTML}</div>
        </div>`;
    }).join('');
}

function selectRoomFromPicker(roomId) {
    event.stopPropagation();
    closeRoomPicker();
    setTimeout(() => {
        try {
            openRequestModal(roomId);
        } catch (err) {
            console.error('openRequestModal failed:', err);
            showToast('Error: ' + err.message, 'error');
        }
    }, 50);
}

/**
 * Render available rooms for instructor
 */
function renderInstructorAvailableRooms() {
    const grid = document.getElementById('availableRoomsGrid');
    const noData = document.getElementById('noAvailableRooms');
    if (!grid) return; // element removed in new layout

    // Get all 'register' type rooms (skip 'schedule' duplicates)
    const displayRooms = allRooms.filter(room =>
        room.type === 'register' &&
        (room.status !== 'maintenance' || currentInstructorTab === 'available')
    );

    if (displayRooms.length === 0) {
        grid.innerHTML = '';
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';

    const newHTML = displayRooms.map(room => {
        const hasSchedules = room.schedules && room.schedules.length > 0;
        const isScheduled = hasSchedules;
        const hasConflict = isScheduled && checkTimeConflict(room);

        // Capitalize instructor name
        const instructorName = hasSchedules ? room.schedules[0].instructor : '';
        const capitalizedInstructor = instructorName ? instructorName.charAt(0).toUpperCase() + instructorName.slice(1) : '';

        // Get status display (normalize to lowercase)
        const normalizedStatus = (room.status || 'available').toLowerCase();
        let statusText = 'Available';
        let statusClass = 'available';

        switch (normalizedStatus) {
            case 'locked':
                statusText = 'Locked';
                statusClass = 'locked';
                break;
            case 'meeting':
                statusText = 'Meeting';
                statusClass = 'meeting';
                break;
            case 'maintenance':
                statusText = 'Maintenance';
                statusClass = 'maintenance';
                break;
            default:
                statusText = 'Available';
                statusClass = 'available';
        }

        return `
            <div class="room-card" data-category="${room.category}" data-status="${normalizedStatus}">
                <div class="room-header">
                    <span class="room-number">Room ${room.id} ${room.category}</span>
                    <span class="room-status status-${statusClass}">
                        <span class="status-dot"></span> ${statusText}
                    </span>
                </div>
                
                ${isScheduled ? `
                <div class="room-schedule">
                    <div>📅 ${formatDateShort(room.schedules[0].date)}</div>
                    <div>
                        ${room.schedules[0].queueStatus === 'standby' ? '⏳ ' : '✓ '}
                        ${room.schedules[0].startTime} - ${room.schedules[0].endTime}
                    </div>
                    <div>👤 ${capitalizedInstructor}</div>
                    <div style="color: ${room.status === 'Locked' ? '#e74c3c' : room.status === 'Meeting' ? '#9b59b6' : '#f39c12'}; font-weight: 600; font-size: 12px;">
                        🔍 ${room.status}
                    </div>
                    ${room.schedules.length > 1 ? `
                        <div style="color: #c0392b; font-size: 12px; font-weight: 600;">
                            +${room.schedules.length - 1} more in queue
                            ${room.schedules.some(s => s.queueStatus === 'standby') ? '(⏳ Standby)' : ''}
                        </div>
                    ` : ''}
                </div>
                ` : '<div class="room-schedule">No schedule</div>'}

                
                <div class="room-actions">
                    <button class="btn-request" onclick="openRequestModal(${room.id})" ${hasConflict ? 'disabled' : ''}>
                        ${isScheduled ? '⏳ Join Queue' : 'Request Schedule'}
                    </button>
                    <button class="btn-view-schedule" onclick="viewRoomSchedule(${room.id})">
                        View Schedule
                    </button>
                </div>
            </div>`;
    }).join('');

    // Only update DOM if content actually changed — prevents flicker on poll
    if (grid.innerHTML !== newHTML) grid.innerHTML = newHTML;
}

/**
 * Filter rooms by status from mobile dropdown
 * @param {string} status - Status to filter by ('all', 'available', 'locked', 'meeting', 'maintenance')
 */
function filterRoomsByStatus(status) {
    const cards = document.querySelectorAll('.room-card');

    cards.forEach(card => {
        // Get the room status from data attribute (lowercase for comparison)
        const roomStatus = (card.dataset.status || '').toLowerCase();

        if (status === 'all' || roomStatus === status) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

/**
 * Filter rooms by search input (room number or category)
 * @param {string} searchValue - Search value
 */
function filterRoomsBySearch(searchValue) {
    const cards = document.querySelectorAll('.room-card');
    const lowerSearch = searchValue.toLowerCase().trim();

    if (!lowerSearch) {
        // If search is empty, show all rooms
        cards.forEach(card => {
            card.style.display = '';
        });
        return;
    }

    cards.forEach(card => {
        const roomText = card.querySelector('.room-number').textContent.toLowerCase();
        const roomCategory = (card.dataset.category || '').toLowerCase();

        // Extract room number from text like "Room 101 Comlab Room"
        const roomNumberMatch = roomText.match(/room\s+(\d+)/);
        const roomNumber = roomNumberMatch ? roomNumberMatch[1] : '';

        // Match exact room number or category substring
        // For room number "1", this will only match room "1", not "101", "102", etc.
        const numberMatch = roomNumber === lowerSearch;
        const categoryMatch = roomCategory.includes(lowerSearch);

        if (numberMatch || categoryMatch) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

/**
 * Render schedule timeline for selected date
 * @param {number} roomId - Room ID
 */
function renderScheduleTimeline(roomId) {
    const day = document.getElementById('viewScheduleDay').value;
    const month = String(document.getElementById('viewScheduleMonth').value).padStart(2, '0');
    const year = document.getElementById('viewScheduleYear').value;
    const dateStr = `${year}-${month}-${String(day).padStart(2, '0')}`;

    const timeline = document.getElementById('scheduleTimeline');
    const noData = document.getElementById('noScheduleMessage');

    // Find room with schedules array (new format)
    const room = allRooms.find(r =>
        r.type === 'schedule' &&
        r.id === roomId &&
        r.date === dateStr
    );

    let daySchedules = [];

    if (room && room.schedules && room.schedules.length > 0) {
        // New format: schedules array
        daySchedules = room.schedules;
    } else {
        // API request rows include active/standby schedule records.
        daySchedules = roomRequests.filter(req =>
            req.roomId === roomId &&
            req.date === dateStr &&
            ['active', 'standby'].includes(req.status)
        ).map(req => ({
            instructor: req.instructor,
            startTime: req.startTime,
            endTime: req.endTime,
            purpose: req.purpose || req.requestedStatus,
            requestedStatus: req.requestedStatus
        }));
    }

    if (daySchedules.length === 0) {
        timeline.innerHTML = '';
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';

    timeline.innerHTML = daySchedules.map((schedule, index) => `
        <div class="schedule-timeline-item">
            <div class="schedule-time">
                <span class="time-block">${schedule.startTime}</span>
                <span class="time-separator">→</span>
                <span class="time-block">${schedule.endTime}</span>
            </div>
            <div class="schedule-details">
                ${index === 0 ? '<span style="color: #27ae60; font-weight: 600; font-size: 11px;">🟢 CURRENT</span>' : ''}
                <span class="schedule-instructor">👤 ${escapeHtml(schedule.instructor)}</span>
                <span class="schedule-purpose">${escapeHtml(schedule.purpose || 'No description')}</span>
            </div>
        </div>
    `).join('');
}

/** * View room schedule
 * @param {number} roomId - Room ID to view schedule for
 */
function viewRoomSchedule(roomId) {
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return;

    // Create a schedule modal with date picker
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'viewScheduleModal';

    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Room ${room.id} ${room.category} Schedule</h3>
                <button class="btn-close" onclick="closeViewScheduleModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="date-picker-group">
                    <div class="date-picker">
                        <label>Day</label>
                        <input type="number" class="date-input" id="viewScheduleDay" min="1" max="31" value="${today.getDate()}">
                    </div>
                    <div class="date-picker">
                        <label>Month</label>
                        <input type="number" class="date-input" id="viewScheduleMonth" min="1" max="12" value="${today.getMonth() + 1}">
                    </div>
                    <div class="date-picker">
                        <label>Year</label>
                        <input type="number" class="date-input" id="viewScheduleYear" min="${today.getFullYear()}" value="${today.getFullYear()}">
                    </div>
                    <button class="btn-search-schedule" onclick="renderScheduleTimeline(${roomId})">Show Schedule</button>
                </div>
                
                <div id="scheduleTimeline" class="schedule-timeline">
                    <!-- Schedule list will be populated here -->
                </div>
                
                <div id="noScheduleMessage" class="no-data-message" style="display: none;">
                    <p>No schedules found for this date.</p>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';
}

/**
 * Close view schedule modal
 */
function closeViewScheduleModal() {
    const modal = document.getElementById('viewScheduleModal');
    if (modal) {
        modal.remove();
    }
}


/**
 * Open profile modal for editing user information
 */
function openProfileModal() {
    // Create a simple profile modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'profileModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>👤 Edit Profile</h3>
                <button class="btn-close" onclick="closeProfileModal()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="profileName" placeholder="Enter your full name">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="profileEmail" placeholder="Enter your email">
                </div>
                <div class="form-group">
                    <label>Department</label>
                    <input type="text" id="profileDepartment" placeholder="Enter your department">
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="closeProfileModal()">Cancel</button>
                <button class="btn-submit" onclick="saveProfile()">Save Changes</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.style.display = 'flex';

    // Load current user data
    const session = getSession();
    if (session) {
        document.getElementById('profileName').value = session.fullName || '';
        document.getElementById('profileEmail').value = session.email || '';
        document.getElementById('profileDepartment').value = session.department || '';
    }
}

/**
 * Close profile modal
 */
function closeProfileModal() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Save profile changes
 */
async function saveProfile() {
    const name = document.getElementById('profileName').value.trim();
    const email = document.getElementById('profileEmail').value.trim();
    if (!name) return;
    try {
        const result = await apiFetch('/api/users/me', {
            method: 'PATCH',
            body: JSON.stringify({ fullName: name, email: email || null })
        });
        const session = getSession();
        if (session) {
            session.fullName = result.user.fullName;
            session.email = result.user.email;
            saveSession(session);
        }
        document.getElementById('instructorName').textContent = result.user.fullName;
        const mobileNameEl = document.getElementById('mobileInstructorName');
        if (mobileNameEl) mobileNameEl.textContent = result.user.fullName;
        showNotification('Profile Updated', 'Your profile has been updated successfully', 'success', 3000);
        closeProfileModal();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

/**
 * Toggle notifications panel
 */
function toggleNotifications() {
    const session = getSession();
    if (!session) return;

    // Get user's standby and active requests.
    const myRequests = roomRequests.filter(r => r.instructor === session.username);
    const pending = myRequests.filter(r => r.status === 'standby');
    const approved = myRequests.filter(r => r.status === 'active');

    let message = '';

    if (pending.length === 0 && approved.length === 0) {
        message = 'No new notifications at this time';
    } else {
        const notificationLines = [];

        // Add pending requests
        if (pending.length > 0) {
            pending.forEach(req => {
                notificationLines.push(`⏳ Pending - Room ${req.roomId} (${req.roomCategory})`);
            });
        }

        // Add approved requests
        if (approved.length > 0) {
            approved.forEach(req => {
                notificationLines.push(`✅ Approved - Room ${req.roomId} (${req.roomCategory}) on ${req.date}`);
            });
        }

        message = notificationLines.join('\n');
    }

    showNotification('Notifications', message, pending.length > 0 ? 'warning' : 'success', 4000);
}

/**
 * Update instructor statistics
 */
function updateInstructorStats() {
    const session = getSession();
    if (!session) return;

    const myRequests = roomRequests.filter(r => r.instructor === session.username);
    const today = new Date().toISOString().split('T')[0];
    const pending = myRequests.filter(r => r.status === 'standby').length;

    const activeSchedules = [];
    allRooms.forEach(room => {
        if (room.type === 'register' && room.schedules) {
            room.schedules.forEach(schedule => {
                if (schedule.instructor === session.username && schedule.queueStatus !== 'completed') {
                    activeSchedules.push(schedule);
                }
            });
        }
    });

    const approved = activeSchedules.length;

    const safe = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    safe('instTotalRequests', myRequests.length);
    safe('instApprovedCount', approved);
    safe('myScheduleCount', approved);
    safe('pendingRequestCount', pending);

    // Update mobile badges
    const pendingBadge = document.getElementById('pendingBadge');
    if (pendingBadge) {
        pendingBadge.textContent = approved > 0 ? approved : '';
        pendingBadge.style.display = approved > 0 ? 'block' : 'none';
    }

    const requestBadge = document.getElementById('requestBadge');
    if (requestBadge) {
        requestBadge.textContent = pending > 0 ? pending : '';
        requestBadge.style.display = pending > 0 ? 'block' : 'none';
    }
}

/**
 * Update notification badge
 */
function updateNotificationBadge() {
    // For now, just check for pending requests as notifications
    const session = getSession();
    if (!session) return;

    const pendingCount = roomRequests.filter(r => r.instructor === session.username && r.status === 'standby').length;
    const notificationBadge = document.getElementById('notificationBadge');

    if (notificationBadge) {
        notificationBadge.textContent = pendingCount;
        notificationBadge.style.display = pendingCount > 0 ? 'block' : 'none';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        currentInstructorTab,
        selectedRoomForRequest,
        initInstructorView,
        switchInstructorTab,
        renderInstructorAvailableRooms,
        filterRoomsByStatus,
        filterRoomsBySearch,
        viewRoomSchedule,
        closeViewScheduleModal,
        renderScheduleTimeline,
        openProfileModal,
        closeProfileModal,
        saveProfile,
        toggleNotifications,
        updateInstructorStats,
        updateNotificationBadge
    };
}
