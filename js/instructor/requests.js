/* ============================================
   CTU Room Management System - Instructor Requests
   API-backed version
   ============================================ */

function todayLocalString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function openRequestModal(roomId) {
    selectedRoomForRequest = roomId;
    const room = allRooms.find(r => r.id === roomId);
    if (!room) return alert('Room not found');
    if (room.isRequestable === false) return alert('This room is currently not available for instructor requests.');

    document.getElementById('requestRoomNumber').textContent = `Room ${room.id}`;
    document.getElementById('requestRoomCategory').textContent = room.category;

    const today = todayLocalString();
    const dateInput = document.getElementById('requestDate');
    dateInput.min = today;
    dateInput.max = today;
    dateInput.value = today;

    document.getElementById('requestStartTime').value = '';
    document.getElementById('requestEndTime').value = '';
    document.getElementById('requestPurpose').value = '';
    document.getElementById('conflictWarning').style.display = 'none';
    document.getElementById('requestModal').style.display = 'flex';
}

function closeRequestModal() {
    document.getElementById('requestModal').style.display = 'none';
    selectedRoomForRequest = null;
}

async function submitRequest() {
    const session = getSession();
    if (!session) return alert('Please log in again');

    const requestedStatus = document.querySelector('input[name="requestStatus"]:checked').value;
    const date = document.getElementById('requestDate').value;
    const startTime = document.getElementById('requestStartTime').value;
    const endTime = document.getElementById('requestEndTime').value;
    const purpose = document.getElementById('requestPurpose').value.trim();
    const today = todayLocalString();

    if (!date || !startTime || !endTime) return alert('Please fill in all date and time fields');
    if (date !== today) return alert(`Schedules are only allowed for today (${today}).`);
    if (startTime >= endTime) return alert('End time must be after start time');

    try {
        const result = await apiFetch('/api/requests', {
            method: 'POST',
            body: JSON.stringify({
                roomId: selectedRoomForRequest,
                date,
                startTime,
                endTime,
                purpose,
                requestedStatus
            })
        });
        await refreshData({ render: true });
        alert(result.status === 'active'
            ? 'Schedule approved automatically. You are active for this room.'
            : 'Schedule added to standby queue.');
        closeRequestModal();
    } catch (error) {
        alert(error.message);
    }
}

function renderMySchedules() {
    const list = document.getElementById('mySchedulesList');
    const noData = document.getElementById('noMySchedules');
    const session = getSession();
    if (!session || !list) return;

    const myScheduledItems = [];
    allRooms.forEach(room => {
        if (room.type === 'register' && room.schedules) {
            room.schedules.forEach(schedule => {
                if (schedule.instructor === session.username && schedule.queueStatus !== 'completed') {
                    myScheduledItems.push({
                        roomId: room.id,
                        roomCategory: room.category,
                        roomStatus: room.status,
                        ...schedule
                    });
                }
            });
        }
    });

    myScheduledItems.sort((a, b) => `${b.date} ${b.startTime}`.localeCompare(`${a.date} ${a.startTime}`));

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
                    ${item.queueStatus === 'standby' ? 'Standby' : 'Active'}
                </span>
            </div>
            <div class="item-details">
                <strong>Date:</strong> ${formatDateShort(item.date)}<br>
                <strong>Time:</strong> ${item.startTime} - ${item.endTime}<br>
                <strong>Purpose:</strong> ${item.purpose || 'N/A'}<br>
                <strong>Room Status:</strong> ${item.roomStatus}<br>
                ${item.queueStatus === 'standby' ? '<strong style="color: #ff9800;">Status:</strong> Waiting for previous schedule to end<br>' : ''}
            </div>
            ${item.queueStatus === 'active' ? `<button class="btn-submit" onclick="markScheduleDone('${item.id}')">Done</button>` : ''}
        </div>
    `).join('');
}

async function markScheduleDone(scheduleId) {
    if (!confirm('Mark this room session as done?')) return;
    try {
        await apiFetch(`/api/schedules/${scheduleId}/done`, { method: 'POST', body: '{}' });
        await refreshData({ render: true });
        alert('Session marked done.');
    } catch (error) {
        alert(error.message);
    }
}

function renderMyRequests() {
    const list = document.getElementById('pendingRequestsList');
    const noData = document.getElementById('noPendingRequests');
    const session = getSession();
    if (!session || !list) return;

    const myRequests = pendingRequests
        .filter(r => r.instructor === session.username)
        .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    if (myRequests.length === 0) {
        list.innerHTML = '';
        noData.style.display = 'block';
        return;
    }

    noData.style.display = 'none';
    list.innerHTML = myRequests.map(request => `
        <div class="request-item">
            <div class="item-header">
                <span class="item-room">Room ${request.roomId} ${request.roomCategory}</span>
                <span class="item-status status-${request.status}">${request.status}</span>
            </div>
            <div class="item-details">
                <strong>Requested Status:</strong> ${request.requestedStatus || 'N/A'}<br>
                <strong>Date:</strong> ${formatDateShort(request.date)}<br>
                <strong>Time:</strong> ${request.startTime} - ${request.endTime}<br>
                <strong>Purpose:</strong> ${request.purpose || 'N/A'}<br>
                ${request.queuePosition ? `<strong>Queue:</strong> #${request.queuePosition}<br>` : ''}
            </div>
            ${['active', 'standby'].includes(request.status) ? `
                <div class="item-actions">
                    <button class="btn-remove" onclick="removeRequest('${request.id}')">Remove Request</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

async function removeRequest(requestId) {
    const request = pendingRequests.find(r => r.id === requestId);
    if (!request) return alert('Request not found');
    if (!confirm(`Remove request for Room ${request.roomId}?`)) return;

    try {
        await apiFetch(`/api/requests/${requestId}`, { method: 'DELETE' });
        await refreshData({ render: true });
        alert('Request removed successfully.');
    } catch (error) {
        alert(error.message);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        openRequestModal,
        closeRequestModal,
        submitRequest,
        renderMySchedules,
        renderMyRequests,
        removeRequest,
        markScheduleDone
    };
}
