/* ============================================
   CTU Room Management System - Instructor Requests
   ============================================ */

/**
 * Open request modal for a room
 * @param {number} roomId - Room ID
 */
function openRequestModal(roomId) {
    selectedRoomForRequest = roomId;
    const room = allRooms.find(r => r.id === roomId);

    document.getElementById('requestRoomNumber').textContent = `Room ${room.id}`;
    document.getElementById('requestRoomCategory').textContent = room.category;

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('requestDate').min = today;
    document.getElementById('requestDate').value = today;

    document.getElementById('requestStartTime').value = '';
    document.getElementById('requestEndTime').value = '';
    document.getElementById('requestPurpose').value = '';
    document.getElementById('conflictWarning').style.display = 'none';

    document.getElementById('requestModal').style.display = 'flex';
}

/**
 * Close request modal
 */
function closeRequestModal() {
    document.getElementById('requestModal').style.display = 'none';
    selectedRoomForRequest = null;
}

/**
 * Submit room request
 */
function submitRequest() {
    const session = getSession();
    if (!session) {
        alert('Please log in again');
        return;
    }

    const requestStatus = document.querySelector('input[name="requestStatus"]:checked').value;
    console.log('📋 Request Status Selected:', requestStatus);  // DEBUG

    const date = document.getElementById('requestDate').value;
    const startTime = document.getElementById('requestStartTime').value;
    const endTime = document.getElementById('requestEndTime').value;
    const purpose = document.getElementById('requestPurpose').value.trim();

    console.log('📅 Request Date:', date);  // DEBUG
    console.log('⏰ Start Time:', startTime);  // DEBUG
    console.log('⏰ End Time:', endTime);  // DEBUG

    if (!date || !startTime || !endTime) {
        alert('Please fill in all date and time fields');
        return;
    }

    // Check if selected date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);  // Reset to midnight
    const todayString = today.toISOString().split('T')[0];

    console.log('📆 Today:', todayString);  // DEBUG
    console.log('🔍 Date comparison:', date, 'vs', todayString, '| Past?', date < todayString);  // DEBUG

    if (date < todayString) {
        alert('❌ Cannot schedule for past dates.\n\nToday: ' + todayString + '\nYour date: ' + date + '\n\nPlease select today or a future date.');
        return;
    }

    if (startTime >= endTime) {
        alert('End time must be after start time');
        return;
    }

    const room = allRooms.find(r => r.id === selectedRoomForRequest);

    if (checkTimeConflict(room, date, startTime, endTime)) {
        document.getElementById('conflictWarning').style.display = 'flex';
        return;
    }

    const request = {
        id: Date.now(),
        roomId: selectedRoomForRequest,
        roomCategory: room.category,
        instructor: session.username,
        date: date,
        startTime: startTime,
        endTime: endTime,
        purpose: purpose,
        requestedStatus: requestStatus,
        status: 'pending',
        requestedAt: new Date().toISOString()
    };

    console.log('📋 Full Request Object:', request);  // DEBUG
    pendingRequests.push(request);
    saveToStorage();

    if (typeof notifyRequestAction === 'function') {
        notifyRequestAction({
            type: 'new_request',
            action: 'submitted',
            user: session.username,
            roomId: selectedRoomForRequest,
            instructor: session.username,
            title: 'New Room Request',
            message: `${session.username} has submitted a request for Room ${selectedRoomForRequest}`,
            timestamp: new Date().toISOString()
        });
    }

    addLog(
        'request',
        selectedRoomForRequest,
        session.username,
        room.category,
        `Request: ${requestStatus} status for ${date} ${startTime}-${endTime} - ${purpose}`,
        'Pending'
    );

    alert('Request submitted successfully! Please wait for admin approval.');
    closeRequestModal();
    updateInstructorStats();
}

/**
 * Render my schedules
 */
function renderMySchedules() {
    const list = document.getElementById('mySchedulesList');
    const noData = document.getElementById('noMySchedules');

    const session = getSession();
    if (!session) return;

    // Get all scheduled entries from allRooms where this instructor is scheduled
    const myScheduledItems = [];
    allRooms.forEach(room => {
        if (room.type === 'register' && room.schedules) {
            room.schedules.forEach(schedule => {
                if (schedule.instructor === session.username && schedule.queueStatus !== 'completed') {
                    myScheduledItems.push({
                        roomId: room.id,
                        roomCategory: room.category,
                        roomStatus: room.status,  // Include the room status
                        ...schedule
                    });
                }
            });
        }
    });

    // Sort by newest first (descending date, then descending start time)
    myScheduledItems.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
            return dateB - dateA; // newer dates first
        }
        // same date, compare start time descending
        return b.startTime.localeCompare(a.startTime);
    });

    if (myScheduledItems.length === 0) {
        list.innerHTML = '';
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';

    list.innerHTML = myScheduledItems.map(item => `
        <div class="schedule-item">
            <div class="item-header">
                <span class="item-room">Room ${item.roomId} ${item.roomCategory}</span>
                <span class="item-status status-${item.queueStatus || 'active'}">
                    ${item.queueStatus === 'standby' ? '⏳ Standby' : '✓ Active'}
                </span>
            </div>
            <div class="item-details">
                <strong>Date:</strong> ${formatDateShort(item.date)}<br>
                <strong>Time:</strong> ${item.startTime} - ${item.endTime}<br>
                <strong>Purpose:</strong> ${item.purpose || 'N/A'}<br>
                <strong style="color: ${item.roomStatus === 'Locked' ? '#e74c3c' : item.roomStatus === 'Meeting' ? '#9b59b6' : '#f39c12'};">
                    🔍 Room Status: ${item.roomStatus}
                </strong><br>
                ${item.queueStatus === 'standby' ? '<strong style="color: #ff9800;">⏳ Status:</strong> Waiting for previous schedule to end<br>' : ''}
            </div>
        </div>
    `).join('');
}

/**
 * Render my pending requests
 */
function renderMyRequests() {
    const list = document.getElementById('pendingRequestsList');
    const noData = document.getElementById('noPendingRequests');

    const session = getSession();
    if (!session) return;

    const myRequests = pendingRequests.filter(r => r.instructor === session.username);

    // Sort by newest first (descending order by requestedAt)
    myRequests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    if (myRequests.length === 0) {
        list.innerHTML = '';
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';

    list.innerHTML = myRequests.map(request => {
        const statusClass = request.status === 'approved' ? 'approved' :
            request.status === 'rejected' ? 'rejected' : 'pending';
        const statusText = request.status.charAt(0).toUpperCase() + request.status.slice(1);

        return `
            <div class="request-item">
                <div class="item-header">
                    <span class="item-room">Room ${request.roomId} ${request.roomCategory}</span>
                    <span class="item-status status-${statusClass}">${statusText}</span>
                </div>
                <div class="item-details">
                    <strong>Requested Status:</strong> ${request.requestedStatus || 'N/A'}<br>
                    <strong>Date:</strong> ${formatDateShort(request.date)}<br>
                    <strong>Time:</strong> ${request.startTime} - ${request.endTime}<br>
                    <strong>Purpose:</strong> ${request.purpose || 'N/A'}<br>
                    <strong>Requested:</strong> ${new Date(request.requestedAt).toLocaleDateString()}
                </div>
                <div class="item-actions">
                    <button class="btn-remove" onclick="removeRequest(${request.id})">
                        🗑️ Remove Request
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Remove a pending request
 * @param {number} requestId - Request ID to remove
 */
function removeRequest(requestId) {
    const request = pendingRequests.find(r => r.id === requestId);
    if (!request) {
        alert('Request not found');
        return;
    }

    if (!confirm(`Remove request for Room ${request.roomId}?\n\nThis will make the schedule available for others.`)) {
        return;
    }

    // If request was approved, remove from room schedules
    if (request.status === 'approved') {
        const baseRoom = allRooms.find(r => r.type === 'register' && r.id === request.roomId);
        if (baseRoom && baseRoom.schedules) {
            // Find and remove the schedule with this request ID
            const scheduleIndex = baseRoom.schedules.findIndex(s => s.requestId === request.id);
            if (scheduleIndex !== -1) {
                baseRoom.schedules.splice(scheduleIndex, 1);

                // If there are remaining schedules, update the room with the next schedule
                if (baseRoom.schedules.length > 0) {
                    baseRoom.date = baseRoom.schedules[0].date;
                    baseRoom.startTime = baseRoom.schedules[0].startTime;
                    baseRoom.endTime = baseRoom.schedules[0].endTime;
                    baseRoom.instructor = baseRoom.schedules[0].instructor;
                    baseRoom.status = baseRoom.schedules[0].requestedRoomStatus || 'Available';

                    // Update all standby schedules to check if they can move to active
                    if (baseRoom.schedules[0].queueStatus === 'standby') {
                        baseRoom.schedules[0].queueStatus = 'active';
                    }

                    console.log('📅 Room updated with next schedule:', {
                        roomId: baseRoom.id,
                        date: baseRoom.date,
                        instructor: baseRoom.instructor
                    });
                } else {
                    // No more schedules, reset room to available
                    baseRoom.status = 'Available';
                    baseRoom.date = null;
                    baseRoom.startTime = null;
                    baseRoom.endTime = null;
                    baseRoom.instructor = null;

                    console.log('🏠 Room reset to available:', { roomId: baseRoom.id });
                }

                // Update history
                baseRoom.history = baseRoom.history || [];
                baseRoom.history.push(
                    `${new Date().toLocaleTimeString()} - ${request.instructor} removed schedule (${request.date} ${request.startTime}-${request.endTime})`
                );
            }
        }
    }

    // Remove from pending requests
    const requestIndex = pendingRequests.findIndex(r => r.id === requestId);
    if (requestIndex !== -1) {
        pendingRequests.splice(requestIndex, 1);
    }

    // Save changes
    saveToStorage();

    console.log('🗑️ Request removed:', {
        requestId: requestId,
        roomId: request.roomId,
        instructor: request.instructor
    });

    alert('Request removed successfully. The schedule is now available for others.');

    // Re-render the requests
    renderMyRequests();
    updateInstructorStats();

    // Notify about the removal
    if (typeof notifyRequestAction === 'function') {
        notifyRequestAction({
            type: 'request_removed',
            action: 'removed',
            user: request.instructor,
            roomId: request.roomId,
            title: 'Schedule Removed',
            message: `${request.instructor} has removed their schedule for Room ${request.roomId}`,
            timestamp: new Date().toISOString()
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        openRequestModal,
        closeRequestModal,
        submitRequest,
        renderMySchedules,
        renderMyRequests,
        removeRequest
    };
}