/* ============================================
   CTU Room Management System - Admin Notifications
   ============================================ */

/**
 * Update schedule notifications in sidebar
 */
function getCurrentSchedule(room) {
    if (room.schedules && room.schedules.length > 0) {
        return room.schedules[0];
    }
    return {
        instructor: room.instructor || 'N/A',
        startTime: room.startTime || '--:--',
        endTime: room.endTime || '--:--',
        purpose: room.purpose || 'Schedule',
        requestedStatus: room.requestedStatus || 'Scheduled'
    };
}

function updateScheduleNotifications() {
    const notificationList = document.getElementById('notificationList');
    const notificationCount = document.getElementById('notificationCount');
    const notificationEmpty = document.getElementById('notificationEmpty');

    if (!notificationList) return;

    const scheduledRooms = allRooms.filter(r => r.type === 'schedule');

    if (notificationCount) notificationCount.innerText = scheduledRooms.length;

    if (scheduledRooms.length === 0) {
        notificationList.innerHTML = '';
        if (notificationEmpty) notificationEmpty.style.display = 'block';
        return;
    }

    if (notificationEmpty) notificationEmpty.style.display = 'none';

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const today = now.toISOString().split('T')[0];

    notificationList.innerHTML = scheduledRooms.map((room) => {
        const currentSchedule = getCurrentSchedule(room);
        const endTimeMinutes = timeToMinutes(currentSchedule.endTime);
        const isLate = today === room.date && currentTime > endTimeMinutes;
        const isToday = today === room.date;
        const key = `${room.id}-${room.date}-${currentSchedule.startTime}`;
        const currentStatus = scheduleStatus[key];

        let statusClass = '';
        let statusText = '';
        let statusIndicator = '';

        if (currentStatus === 'returned') {
            statusClass = 'returned';
            statusText = 'Returned';
            statusIndicator = '✅';
        } else if (currentStatus === 'late') {
            statusClass = 'late';
            statusText = 'Late Return';
            statusIndicator = '⚠️';
        } else if (isLate) {
            statusClass = 'late';
            statusText = 'Late Return';
            statusIndicator = '⚠️';
        } else {
            statusText = isToday ? 'Active Today' : 'Upcoming';
            statusIndicator = isToday ? '🟢' : '⏳';
        }

        return `
        <div class="notification-item ${statusClass}" id="notif-${key}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div>
                    <div class="notification-room">${statusIndicator} Room ${room.id}</div>
                    <div class="notification-info">${currentSchedule.instructor} • ${room.category}</div>
                    <div class="notification-time">${formatDateShort(room.date)} | ${currentSchedule.startTime} - ${currentSchedule.endTime}</div>
                    <div class="notification-status ${isLate || currentStatus === 'late' ? 'status-late' : 'status-ontime'}">${statusText}</div>
                </div>
                <button class="btn-remove-schedule" onclick="removeScheduleEntry(${room.id}, '${room.date}', '${currentSchedule.startTime}')" title="Remove schedule">✖</button>
            </div>
            ${currentStatus !== 'returned' ? `
            <div class="notification-actions">
                <button class="btn-return btn-late" onclick="markScheduleStatus('${key}', 'late', ${room.id}, '${currentSchedule.instructor.replace(/'/g, "\\'")}', '${room.category}')">
                    ⚠️ Late
                </button>
                <button class="btn-return btn-ontime" onclick="markScheduleStatus('${key}', 'returned', ${room.id}, '${currentSchedule.instructor.replace(/'/g, "\\'")}', '${room.category}')">
                    ✓ On Time
                </button>
            </div>
            ` : ''}
        </div>`;
    }).join('');
}

function openScheduleManagementView() {
    const existingModal = document.getElementById('scheduleManagementModal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'scheduleManagementModal';
    modal.style.display = 'flex';
    modal.onclick = function (event) {
        if (event.target === modal) {
            closeScheduleManagementView();
        }
    };
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 520px; width: 100%;">
            <div class="modal-header">
                <h3>📅 Schedule Management</h3>
                <button class="btn-close" onclick="closeScheduleManagementView()">&times;</button>
            </div>
            <div class="modal-body">
                <p style="margin: 0 0 12px 0; color: #555;">Manage all registered instructor schedules. Remove a schedule to promote the next instructor in queue.</p>
                <div class="schedule-management-list">
                    ${getScheduleManagementHtml()}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn-cancel" onclick="closeScheduleManagementView()">Close</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

function closeScheduleManagementView() {
    const modal = document.getElementById('scheduleManagementModal');
    if (modal) modal.remove();
}

function getScheduleManagementHtml() {
    const scheduledRooms = allRooms.filter(r => r.type === 'schedule');
    if (scheduledRooms.length === 0) {
        return '<p style="color: #666; text-align: center; padding: 20px;">No active schedules found.</p>';
    }

    return scheduledRooms.map(room => {
        const roomSchedules = room.schedules && room.schedules.length > 0 ? room.schedules : [{
            instructor: room.instructor || 'N/A',
            startTime: room.startTime || '--:--',
            endTime: room.endTime || '--:--',
            purpose: room.purpose || 'Schedule'
        }];

        return `
            <div class="schedule-management-room">
                <div class="schedule-management-room-header">
                    <strong>Room ${room.id}</strong> • ${room.category}
                    <span class="schedule-management-room-date">${formatDateShort(room.date)}</span>
                </div>
                ${roomSchedules.map((schedule, index) => `
                    <div class="schedule-management-item ${index === 0 ? 'current-schedule' : 'queued-schedule'}">
                        <div>
                            <div style="font-weight: 700;">${index === 0 ? 'Current Instructor' : `#${index + 1} in queue`}</div>
                            <div>${schedule.instructor}</div>
                            <div style="font-size: 0.88rem; color: #666;">${schedule.startTime} - ${schedule.endTime}</div>
                            <div style="font-size: 0.82rem; color: #666; margin-top: 4px;">${schedule.purpose || 'Schedule'}</div>
                        </div>
                        <button class="btn-remove-schedule" onclick="removeScheduleEntry(${room.id}, '${room.date}', '${schedule.startTime}')">✖</button>
                    </div>
                `).join('')}
            </div>
        `;
    }).join('');
}

function removeScheduleEntry(roomId, date, startTime) {
    const room = allRooms.find(r => r.type === 'schedule' && r.id === roomId && r.date === date);
    if (!room) return;

    if (!confirm('Are you sure you want to remove this schedule entry?\nThis will promote the next instructor in queue if one exists.')) {
        return;
    }

    let removed = null;
    if (room.schedules && room.schedules.length > 0) {
        const scheduleIndex = room.schedules.findIndex(s => s.startTime === startTime);
        if (scheduleIndex === -1) return;
        removed = room.schedules.splice(scheduleIndex, 1)[0];
    } else if (room.startTime === startTime) {
        removed = {
            instructor: room.instructor || 'N/A',
            startTime: room.startTime,
            endTime: room.endTime,
            purpose: room.purpose || 'Schedule'
        };
        room.startTime = '';
        room.endTime = '';
        room.instructor = '';
        room.type = 'register';
        room.status = 'Available';
        room.date = '';
    } else {
        return;
    }
    const time = new Date().toLocaleTimeString();
    room.history = room.history || [];
    room.history.push(`${time} - ❌ Removed schedule ${removed.instructor} ${removed.startTime}-${removed.endTime}`);
    addLog('remove_schedule', room.id, removed.instructor, room.category, `Removed schedule ${removed.startTime}-${removed.endTime}`, room.status);

    if (room.schedules.length === 0) {
        room.type = 'register';
        room.status = 'Available';
        room.date = '';
        room.history.push(`${time} - 🔄 Room reset after schedule removal`);
    } else {
        const promoted = room.schedules[0];
        room.history.push(`${time} - 🔁 Promoted ${promoted.instructor} to active schedule`);
        addLog('promote_schedule', room.id, promoted.instructor, room.category, `Promoted next schedule ${promoted.startTime}-${promoted.endTime}`, room.status);
    }

    saveToStorage();
    if (typeof renderTable === 'function') renderTable();
    if (typeof renderMonitoringTable === 'function') renderMonitoringTable();
    updateScheduleNotifications();
    closeScheduleManagementView();
}

/**
 * Mark schedule status (returned/late)
 * @param {string} key - Schedule key
 * @param {string} status - New status ('returned' or 'late')
 * @param {number} roomId - Room ID
 * @param {string} instructor - Instructor name
 * @param {string} category - Room category
 */
function markScheduleStatus(key, status, roomId, instructor, category) {
    scheduleStatus[key] = status;
    saveToStorage();

    const time = new Date().toLocaleTimeString();
    const details = status === 'late'
        ? `Late return - Key returned after scheduled time`
        : `On time return - Key returned as scheduled, room reset to default`;

    addLog(status === 'late' ? 'late_return' : 'ontime_return', roomId, instructor, category, details, 'Available');

    const [roomKey, scheduleDate, scheduleStartTime] = key.split('-');
    const parsedRoomId = Number(roomKey);
    const room = allRooms.find(r => r.id === parsedRoomId && r.type === 'schedule' && r.date === scheduleDate);

    if (room) {
        if (room.schedules && room.schedules.length > 0) {
            const scheduleIndex = room.schedules.findIndex(s => s.startTime === scheduleStartTime);
            if (scheduleIndex !== -1) {
                room.schedules.splice(scheduleIndex, 1);
            }

            if (status === 'returned') {
                delete scheduleStatus[key];
                if (!room.schedules.length) {
                    room.type = 'register';
                    room.status = 'Available';
                    room.date = '';
                    room.startTime = '';
                    room.endTime = '';
                    room.history = room.history || [];
                    room.history.push(`${time} - 🔄 Reset to default after on-time return`);
                }
            } else if (status === 'late') {
                room.status = 'Available';
            }
        } else {
            const roomIndex = allRooms.findIndex(r =>
                r.id === parsedRoomId &&
                r.type === 'schedule' &&
                `${r.id}-${r.date}-${r.startTime}` === key
            );
            if (roomIndex !== -1) {
                if (status === 'returned') {
                    allRooms.splice(roomIndex, 1);
                    delete scheduleStatus[key];

                    const existingRegister = allRooms.find(r => r.id === roomId && r.type === 'register');
                    if (!existingRegister) {
                        allRooms.push({
                            id: roomId,
                            instructor: "",
                            category: category,
                            date: "",
                            startTime: "",
                            endTime: "",
                            status: "Available",
                            history: [`${time} - 🔄 Reset to default after on-time return`],
                            type: "register"
                        });
                    }
                } else if (status === 'late') {
                    allRooms[roomIndex].status = 'Available';
                }
            }
        }

        saveToStorage();
    }

    const notifItem = document.getElementById(`notif-${key}`);
    if (notifItem) {
        if (status === 'returned') {
            notifItem.classList.add('returned');
            notifItem.innerHTML = `
                <div class="notification-room">✅ Room ${roomId}</div>
                <div class="notification-info">${instructor} • ${category}</div>
                <div class="notification-time">Returned on time - Room reset to default ✓</div>
                <div class="notification-status status-ontime">Completed & Reset</div>
            `;

            setTimeout(() => {
                notifItem.style.opacity = '0';
                setTimeout(() => {
                    notifItem.remove();
                    updateScheduleNotifications();
                }, 300);
            }, 3000);
        } else {
            notifItem.classList.add('late');
            notifItem.innerHTML = `
                <div class="notification-room">⚠️ Room ${roomId}</div>
                <div class="notification-info">${instructor} • ${category}</div>
                <div class="notification-time">Marked as late return</div>
                <div class="notification-status status-late">Late Return</div>
                <div class="notification-actions">
                    <button class="btn-return btn-ontime" onclick="markScheduleStatus('${key}', 'returned', ${roomId}, '${instructor}', '${category}')">
                        ✓ Now Returned
                    </button>
                </div>
            `;
        }
    }

    if (currentTab === 'dashboard') {
        renderTable();
    } else if (currentTab === 'monitoring') {
        renderMonitoringTable();
    } else {
        renderDatabaseTable();
    }

    updateScheduleNotifications();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateScheduleNotifications,
        markScheduleStatus
    };
}
