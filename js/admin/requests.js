/* ============================================
   CTU Room Management System - Admin Requests
   ============================================ */

/**
 * Render requests table
 * @param {string} filter - Filter by status ('all', 'pending', 'approved', 'rejected', 'today', 'future')
 */
function renderRequestsTable(filter = 'all') {
    const tbody = document.getElementById('requestsBody');
    const table = document.getElementById('requestsTable');
    const noMsg = document.getElementById('noRequestsMsg');

    if (!tbody) return;

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    let filteredRequests = pendingRequests;

    // Apply status filter first
    if (filter !== 'all' && filter !== 'today' && filter !== 'future') {
        filteredRequests = filteredRequests.filter(r => r.status === filter);
    }

    // Apply date filter
    if (filter === 'today') {
        filteredRequests = filteredRequests.filter(r => r.date === today);
    } else if (filter === 'future') {
        filteredRequests = filteredRequests.filter(r => r.date > today);
    }

    // Sort by date (most recent first)
    filteredRequests.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Update summary counts (all requests)
    document.getElementById('totalRequestsCount').textContent = pendingRequests.length;
    document.getElementById('pendingRequestsCount').textContent = pendingRequests.filter(r => r.status === 'pending').length;
    document.getElementById('approvedRequestsCount').textContent = pendingRequests.filter(r => r.status === 'approved').length;
    document.getElementById('rejectedRequestsCount').textContent = pendingRequests.filter(r => r.status === 'rejected').length;

    if (filteredRequests.length === 0) {
        tbody.innerHTML = '';
        if (noMsg) noMsg.style.display = 'block';
        if (table) table.style.display = 'none';
        return;
    }

    if (noMsg) noMsg.style.display = 'none';
    if (table) table.style.display = 'table';

    tbody.innerHTML = filteredRequests.map(req => `
        <tr>
            <td><strong>#${req.id.toString().slice(-6)}</strong></td>
            <td>${getInstructorFullName(req.instructor)}</td>
            <td><strong>Room ${req.roomId}</strong></td>
            <td>${req.roomCategory}</td>
            <td>
                <div>${formatDateShort(req.date)}</div>
                <div style="font-size: 0.85rem; color: #666;">${req.startTime} - ${req.endTime}</div>
            </td>
            <td>
                <div style="font-size: 0.85rem; margin-bottom: 4px;">
                    <strong>Requested:</strong> ${req.requestedStatus ? req.requestedStatus.charAt(0).toUpperCase() + req.requestedStatus.slice(1) : 'N/A'}
                </div>
                <div style="font-size: 0.85rem; margin-bottom: 4px;">${req.requestType === 'meeting' ? '📞 Schedule Meeting' : '🔑 Using a Room'}</div>
                <div>${req.purpose || 'N/A'}</div>
            </td>
            <td><span class="request-status status-${req.status}">${req.status}</span></td>
            <td>
                <div class="request-actions">
                    ${req.status === 'pending' ? `
                        <button class="btn-approve" onclick="approveRequest(${req.id})">✓ Approve</button>
                        <button class="btn-reject" onclick="rejectRequest(${req.id})">✗ Reject</button>
                    ` : '<span style="color: #999; font-size: 0.85rem;">Processed</span>'}
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Filter requests by status
 * @param {string} status - Status to filter by
 */
function filterRequests(status) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderRequestsTable(status);
}

/**
 * Approve a request
 * @param {number} requestId - Request ID
 */
function approveRequest(requestId) {
    const session = getSession();
    if (!session) return;

    const request = pendingRequests.find(r => r.id === requestId);
    if (!request) return;

    if (!confirm(`Approve request for Room ${request.roomId} by ${getInstructorFullName(request.instructor)}?`)) return;

    // Find the base room (type 'register')
    const baseRoom = allRooms.find(r => r.type === 'register' && r.id === request.roomId);
    if (!baseRoom) {
        alert('Room not found!');
        return;
    }

    // Initialize schedules array if it doesn't exist
    if (!baseRoom.schedules) {
        baseRoom.schedules = [];
    }

    // Check if this request has already been approved (prevents duplicates across devices)
    const alreadyApproved = baseRoom.schedules.some(s => s.requestId === request.id);
    if (alreadyApproved) {
        alert('This request has already been approved!');
        return;
    }

    request.status = 'approved';
    request.approvedAt = new Date().toISOString();
    request.approvedBy = session.username;

    console.log('✅ Approving Request:', {
        id: request.id,
        instructor: request.instructor,
        requestedStatus: request.requestedStatus,
        roomId: request.roomId
    });

    // Determine queue status: if room already has schedules, new approval is standby
    // Only set to 'active' if there are NO existing schedules in the room
    let queueStatus = baseRoom.schedules.length > 0 ? 'standby' : 'active';

    // Update room status based on instructor's requested status
    const statusMap = {
        'locked': 'Locked',
        'meeting': 'Meeting',
        'maintenance': 'Maintenance'
    };
    const newStatus = statusMap[request.requestedStatus] || 'Available';

    console.log('🔧 Status Mapping:', {
        requestedStatus: request.requestedStatus,
        statusMapValue: statusMap[request.requestedStatus],
        finalStatus: newStatus,
        queueStatus: queueStatus
    });

    // Only update room status if this is the active schedule (first in queue)
    // If it's standby, just store the requestedRoomStatus and the actual status will update when "Next" is clicked
    if (queueStatus === 'active') {
        baseRoom.status = newStatus;
        console.log('🏠 Room Status Updated (Active):', { roomId: baseRoom.id, newStatus: baseRoom.status });
    } else {
        console.log('⏳ Status Stored for Later (Standby):', { roomId: baseRoom.id, pendingStatus: newStatus, currentStatus: baseRoom.status });
    }

    // Add this instructor to the schedule queue
    baseRoom.schedules.push({
        requestId: request.id,  // CRITICAL: Store request ID to prevent duplicates
        date: request.date,
        instructor: request.instructor,
        startTime: request.startTime,
        endTime: request.endTime,
        purpose: request.purpose || request.requestedStatus,
        requestedStatus: request.requestedStatus,
        requestedRoomStatus: newStatus,  // Store the requested room status
        queueStatus: queueStatus,  // active or standby
        approvedAt: request.approvedAt,
        approvedBy: session.username
    });

    // Sort schedules by date and start time
    baseRoom.schedules.sort((a, b) => {
        const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

    // Update room info to reflect current schedule
    baseRoom.date = request.date;
    baseRoom.startTime = baseRoom.schedules[0].startTime;
    baseRoom.endTime = baseRoom.schedules[0].endTime;
    baseRoom.instructor = baseRoom.schedules[0].instructor;

    // Update history
    baseRoom.history = baseRoom.history || [];
    baseRoom.history.push(
        `${new Date().toLocaleTimeString()} - ${request.instructor} scheduled (${request.date} ${request.startTime}-${request.endTime}, ${queueStatus}) - Status: ${newStatus}`
    );

    // CRITICAL: Remove all duplicate 'schedule' type rooms for this room ID to prevent duplicates
    const duplicateScheduleRooms = allRooms.filter(r =>
        r.type === 'schedule' &&
        r.id === request.roomId
    );
    duplicateScheduleRooms.forEach(dup => {
        const idx = allRooms.indexOf(dup);
        if (idx !== -1) allRooms.splice(idx, 1);
    });

    addLog('approve', request.roomId, request.instructor, request.roomCategory,
        `Approved: ${request.date} ${request.startTime}-${request.endTime} (${queueStatus})`, newStatus);

    saveToStorage();
    renderRequestsTable();
    updateRequestsSidebar();
    updateStatusCounts();

    alert('Request approved successfully! Room has been scheduled.');
}

/**
 * Reject a request
 * @param {number} requestId - Request ID
 */
function rejectRequest(requestId) {
    const session = getSession();
    if (!session) return;

    const request = pendingRequests.find(r => r.id === requestId);
    if (!request) return;

    const reason = prompt(`Reject request for Room ${request.roomId} by ${getInstructorFullName(request.instructor)}?\n\nEnter reason (optional):`);
    if (reason === null) return;

    request.status = 'rejected';
    request.rejectedAt = new Date().toISOString();
    request.rejectedBy = session.username;
    request.rejectionReason = reason;

    addLog('reject', request.roomId, request.instructor, request.roomCategory,
        `Rejected${reason ? ': ' + reason : ''}`, 'Rejected');

    saveToStorage();
    renderRequestsTable();
    updateRequestsSidebar();

    alert('Request rejected.');
}

/**
 * Update requests sidebar statistics
 */
function updateRequestsSidebar() {
    const pending = pendingRequests.filter(r => r.status === 'pending').length;
    const approved = pendingRequests.filter(r => r.status === 'approved').length;
    const rejected = pendingRequests.filter(r => r.status === 'rejected').length;

    const pendingEl = document.getElementById('pendingCountSidebar');
    const approvedEl = document.getElementById('approvedTodaySidebar');
    const rejectedEl = document.getElementById('rejectedTodaySidebar');

    if (pendingEl) pendingEl.textContent = pending;
    if (approvedEl) {
        approvedEl.textContent = approved;
        // Update label to reflect all-time instead of today
        const labelEl = approvedEl.previousElementSibling;
        if (labelEl && labelEl.textContent.includes('Today')) {
            labelEl.textContent = 'Approved:';
        }
    }
    if (rejectedEl) {
        rejectedEl.textContent = rejected;
        // Update label to reflect all-time instead of today
        const labelEl = rejectedEl.previousElementSibling;
        if (labelEl && labelEl.textContent.includes('Today')) {
            labelEl.textContent = 'Rejected:';
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderRequestsTable,
        filterRequests,
        approveRequest,
        rejectRequest,
        updateRequestsSidebar
    };
}
