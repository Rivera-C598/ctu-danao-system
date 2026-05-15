/* ============================================
CTU Room Management System - Instructor Dashboard
============================================ */

// Current instructor tab
let currentInstructorTab = 'available';
let selectedRoomForRequest = null;

/**
 * Initialize instructor view
 */
function initInstructorView() {
    const session = getSession();
    if (session) {
        // Update desktop profile with full name
        document.getElementById('instructorName').textContent = session.fullName || session.username;
        // Update mobile profile with username
        document.getElementById('mobileInstructorUsername').textContent = session.username || 'Instructor';
    }

    renderInstructorAvailableRooms();
    updateInstructorStats();

    // Set default room filter to 'all'
    const filterSelect = document.getElementById('mobileRoomFilter');
    if (filterSelect) {
        filterSelect.value = 'all';
    }
}

/**
 * Switch instructor tab
 * @param {string} tab - Tab name ('available', 'myschedules', 'requests')
 */
function switchInstructorTab(tab) {
    currentInstructorTab = tab;

    // Update mobile bottom nav active state
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));

    // Find the correct button based on tab
    let activeBtn;
    if (tab === 'available') {
        activeBtn = document.querySelector('.nav-btn:first-child') || document.querySelector('.menu-btn:first-child');
    } else if (tab === 'myschedules') {
        activeBtn = document.querySelector('.nav-btn:nth-child(2)') || document.querySelector('.menu-btn:nth-child(2)');
    } else if (tab === 'requests') {
        activeBtn = document.querySelector('.nav-btn:nth-child(3)') || document.querySelector('.menu-btn:nth-child(3)');
    }

    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // Hide all tabs
    document.getElementById('availableTab').style.display = 'none';
    document.getElementById('mySchedulesTab').style.display = 'none';
    document.getElementById('requestsTab').style.display = 'none';

    // Show selected tab
    if (tab === 'available') {
        document.getElementById('availableTab').style.display = 'block';
        renderInstructorAvailableRooms();
    } else if (tab === 'myschedules') {
        document.getElementById('mySchedulesTab').style.display = 'block';
        renderMySchedules();
    } else if (tab === 'requests') {
        document.getElementById('requestsTab').style.display = 'block';
        renderMyRequests();
    }
}

/**
 * Render available rooms for instructor
 */
function renderInstructorAvailableRooms() {
    const grid = document.getElementById('availableRoomsGrid');
    const noData = document.getElementById('noAvailableRooms');

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

    grid.innerHTML = displayRooms.map(room => {
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
                        Request your Schedule
                    </button>
                    <button class="btn-view-schedule" onclick="viewRoomSchedule(${room.id})">
                        View Schedule
                    </button>
                </div>
            </div>`;
    }).join('');
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
        // Legacy format: check pendingRequests
        daySchedules = pendingRequests.filter(req =>
            req.roomId === roomId &&
            req.date === dateStr &&
            req.status === 'approved'
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
                <span class="schedule-instructor">👤 ${schedule.instructor}</span>
                <span class="schedule-purpose">${schedule.purpose || 'No description'}</span>
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
                        <input type="number" class="date-input" id="viewScheduleYear" min="2026" value="${today.getFullYear()}">
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

    // Get all schedules for this room on the selected date
    const daySchedules = pendingRequests.filter(req =>
        req.roomId === roomId &&
        req.date === dateStr &&
        req.status === 'approved'
    ).sort((a, b) => a.startTime.localeCompare(b.startTime));

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
                <span class="schedule-instructor">👤 ${schedule.instructor}</span>
                <span class="schedule-purpose">${schedule.purpose || 'No description'}</span>
            </div>
        </div>
    `).join('');
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
function saveProfile() {
    const name = document.getElementById('profileName').value;
    const email = document.getElementById('profileEmail').value;
    const department = document.getElementById('profileDepartment').value;

    // Update session storage
    const session = getSession();
    if (session) {
        session.fullName = name;
        session.email = email;
        session.department = department;
        saveSession(session);

        // Update UI
        document.getElementById('instructorName').textContent = name;
        document.getElementById('mobileInstructorName').textContent = name;

        showNotification('Profile Updated', 'Your profile has been updated successfully', 'success', 3000);
        closeProfileModal();
    }
}

/**
 * Toggle notifications panel
 */
function toggleNotifications() {
    const session = getSession();
    if (!session) return;

    // Get user's pending and approved requests
    const myRequests = pendingRequests.filter(r => r.instructor === session.username);
    const pending = myRequests.filter(r => r.status === 'pending');
    const approved = myRequests.filter(r => r.status === 'approved');

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

    const myRequests = pendingRequests.filter(r => r.instructor === session.username);
    const today = new Date().toISOString().split('T')[0];
    const pending = myRequests.filter(r => r.status === 'pending').length;

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

    document.getElementById('instTotalRequests').textContent = myRequests.length;
    document.getElementById('instApprovedCount').textContent = approved;
    document.getElementById('myScheduleCount').textContent = approved;
    document.getElementById('pendingRequestCount').textContent = pending;

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

    const pendingCount = pendingRequests.filter(r => r.instructor === session.username && r.status === 'pending').length;
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
