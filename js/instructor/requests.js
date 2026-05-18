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
    if (!room) { showToast('Room not found', 'error'); return; }
    if (room.isRequestable === false) { showToast('This room is currently not available for instructor requests.', 'error'); return; }

    document.getElementById('requestRoomNumber').textContent = `Room ${room.id}`;
    document.getElementById('requestRoomCategory').textContent = room.category;

    const today = todayLocalString();
    const dateInput = document.getElementById('requestDate');
    dateInput.min = today;
    dateInput.max = '';
    dateInput.value = today;

    // Default start time = now rounded up to next 5 min
    const now = new Date();
    now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('requestStartTime').value = `${hh}:${mm}`;
    document.getElementById('requestEndTime').value = '';
    document.getElementById('requestPurpose').value = '';
    document.getElementById('conflictWarning').style.display = 'none';
    document.getElementById('requestModal').classList.remove('modal-hidden');
}

function closeRequestModal() {
    document.getElementById('requestModal').classList.add('modal-hidden');
    selectedRoomForRequest = null;
}

async function submitRequest() {
    const session = getSession();
    if (!session) { showToast('Please log in again', 'error'); return; }

    const requestedStatus = document.querySelector('input[name="requestStatus"]:checked').value;
    const date = document.getElementById('requestDate').value;
    const startTime = document.getElementById('requestStartTime').value;
    const endTime = document.getElementById('requestEndTime').value;
    const purpose = document.getElementById('requestPurpose').value.trim();
    const today = todayLocalString();

    if (!date || !startTime || !endTime) { showToast('Please fill in all date and time fields.', 'error'); return; }
    if (date < today) { showToast('Cannot request a room for a past date.', 'error'); return; }

    if (date === today) {
        const nowTime = new Date();
        const [sh, sm] = startTime.split(':').map(Number);
        const startMinutes = sh * 60 + sm;
        const nowMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();
        if (startMinutes < nowMinutes) { showToast('Start time cannot be in the past.', 'error'); return; }
    }
    if (startTime >= endTime) { showToast('End time must be after start time.', 'error'); return; }

    // Check instructor already has overlapping request for same room
    const [newSh, newSm] = startTime.split(':').map(Number);
    const [newEh, newEm] = endTime.split(':').map(Number);
    const newStart = newSh * 60 + newSm;
    const newEnd   = newEh * 60 + newEm;
    const conflict = (roomRequests || []).find(r =>
        r.instructor === session?.username &&
        r.roomId === selectedRoomForRequest &&
        r.date === date &&
        ['pending','active','standby'].includes(r.status) &&
        (() => {
            const [es, em2] = (r.startTime || '').split(':').map(Number);
            const [ee, em3] = (r.endTime   || '').split(':').map(Number);
            return newStart < (ee * 60 + em3) && newEnd > (es * 60 + em2);
        })()
    );
    if (conflict) { showToast(`You already have a request for Room ${selectedRoomForRequest} on ${date} at ${conflict.startTime}–${conflict.endTime}. Cancel that request first.`, 'error'); return; }

    const [sh, sm2] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const durationMins = (eh * 60 + em) - (sh * 60 + sm2);
    if (durationMins < 15) { showToast('Minimum room usage is 15 minutes.', 'error'); return; }

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
        showToast('Request submitted. Waiting for admin approval.', 'success');
        closeRequestModal();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderMySchedules() {
    const list = document.getElementById('mySchedulesList');
    const noData = document.getElementById('noMySchedules');
    const session = getSession();
    if (!list) { console.warn('mySchedulesList not found in DOM'); return; }
    if (!session) { list.innerHTML = '<div style="text-align:center;padding:32px;opacity:0.5;">Loading...</div>'; return; }

    const myUsername = (session.username || '').toLowerCase().trim();

    // Primary: from roomRequests (approved bookings = active or standby)
    let mine = (roomRequests || [])
        .filter(r => (r.instructor || '').toLowerCase().trim() === myUsername && ['active', 'standby'].includes(r.status));

    // Fallback: scan allRooms.schedules if roomRequests missed it
    if (mine.length === 0 && allRooms?.length) {
        const fromRooms = [];
        allRooms.forEach(room => {
            (room.schedules || []).forEach(s => {
                if ((s.instructor || '').toLowerCase().trim() === myUsername && ['active', 'standby'].includes(s.queueStatus)) {
                    fromRooms.push({
                        id: s.requestId,
                        roomId: room.id,
                        roomCategory: room.category,
                        date: s.date,
                        startTime: s.startTime,
                        endTime: s.endTime,
                        purpose: s.purpose,
                        status: s.queueStatus,
                        queuePosition: s.queuePosition,
                        requestedStatus: s.requestedStatus
                    });
                }
            });
        });
        if (fromRooms.length > 0) mine = fromRooms;
    }

    mine.sort((a, b) => (a.date || '').localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime));

    // Update badge
    const badge = document.getElementById('scheduleBadge');
    if (badge) { badge.textContent = mine.length; badge.style.display = mine.length > 0 ? '' : 'none'; }
    const countEl = document.getElementById('myScheduleCount');
    if (countEl) countEl.textContent = mine.length;

    const emptyState = document.getElementById('emptyScheduleState');
    const pendingNoteEl = document.getElementById('pendingNote');
    const greetingEl = document.getElementById('greetingText');

    if (mine.length === 0) {
        list.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';

        // Update greeting
        const hour = new Date().getHours();
        const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        const firstName = (session.fullName || session.username || 'Instructor').split(' ')[0];
        if (greetingEl) greetingEl.textContent = `${greeting}, ${firstName}!`;

        // Show pending note if needed
        const pendingCount = (roomRequests || []).filter(r =>
            (r.instructor || '').toLowerCase().trim() === myUsername && r.status === 'pending'
        ).length;
        if (pendingNoteEl) {
            if (pendingCount > 0) {
                pendingNoteEl.textContent = `⏳ You have ${pendingCount} request${pendingCount > 1 ? 's' : ''} awaiting admin approval — check Requests tab`;
                pendingNoteEl.style.display = 'block';
            } else {
                pendingNoteEl.style.display = 'none';
            }
        }
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Show floating request button when schedules exist
    const fab = document.getElementById('floatingRequestBtn');
    if (fab) fab.style.display = currentInstructorTab === 'myschedules' ? 'block' : 'none';

    list.innerHTML = mine.map(r => {
        const isActive  = r.status === 'active';
        const isStandby = r.status === 'standby';
        const today = new Date().toISOString().split('T')[0];
        const isToday = r.date === today;
        const duration = (r.startTime && r.endTime) ? calculateDuration(r.startTime, r.endTime) : '';

        const statusBadge = isActive
            ? `<span style="background:#27ae60;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">✓ Active</span>`
            : `<span style="background:#f39c12;color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">⏳ Queue #${r.queuePosition || '?'}</span>`;

        return `
        <div class="schedule-item">
            <div class="item-header">
                <div>
                    <div style="font-weight:700;font-size:14px;">Room ${r.roomId}</div>
                    <div style="font-size:12px;color:#888;">${r.roomCategory || ''}</div>
                </div>
                ${statusBadge}
            </div>
            <div class="item-details">
                <strong>Date:</strong> ${r.date === today ? '📅 Today' : r.date}<br>
                <strong>Time:</strong> ${r.startTime} – ${r.endTime} ${duration ? `<span style="color:#888;">(${duration})</span>` : ''}<br>
                <strong>Purpose:</strong> ${escapeHtml(r.purpose || '—')}<br>
                ${isStandby ? '<span style="color:#f39c12;font-size:12px;">You are in the queue — your booking activates when the current session ends.</span>' : ''}
            </div>
            ${isActive && isToday ? `
            <div style="margin-top:10px;">
                <button class="btn-submit" onclick="markScheduleDone('${r.id}')">✓ Mark Done</button>
            </div>` : ''}
        </div>`;
    }).join('');
}

async function markScheduleDone(requestId) {
    if (!await showConfirm('Mark this session as done? This will release the room.')) return;
    // Find schedule id from allRooms
    let scheduleId = null;
    for (const room of allRooms) {
        const s = (room.schedules || []).find(sc => sc.requestId === requestId);
        if (s) { scheduleId = s.id; break; }
    }
    if (!scheduleId) { showToast('Schedule not found. Try refreshing.', 'error'); return; }
    try {
        await apiFetch(`/api/schedules/${scheduleId}/done`, { method: 'POST', body: '{}' });
        await refreshData({ render: true, force: true });
        if (typeof showNotification === 'function') showNotification('Done', 'Session marked complete.', 'success', 3000);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderMyRequests() {
    const list = document.getElementById('pendingRequestsList');
    const noData = document.getElementById('noPendingRequests');
    const session = getSession();
    if (!session || !list) return;

    const myRequests = roomRequests
        .filter(r => r.instructor === session.username && r.status === 'pending')
        .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    const emptyReq = document.getElementById('emptyRequestsState');
    if (myRequests.length === 0) {
        list.innerHTML = '';
        if (emptyReq) emptyReq.style.display = 'block';
        if (noData) noData.style.display = 'none';
        return;
    }
    if (emptyReq) emptyReq.style.display = 'none';

    // Update badge
    const pending = myRequests.filter(r => r.status === 'pending').length;
    const badge = document.getElementById('requestBadge');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? '' : 'none'; }
    const countEl = document.getElementById('pendingRequestCount');
    if (countEl) countEl.textContent = pending;

    if (noData) noData.style.display = 'none';
    const statusLabel = {
        pending:   '🕐 Pending Admin Approval',
        active:    '✓ Approved',
        standby:   '⏳ Approved — In Queue',
        rejected:  '✕ Rejected',
        cancelled: '✕ Cancelled',
        completed: '✓ Completed'
    };
    const statusClass = {
        pending:   'status-pending',
        active:    'status-approved',
        standby:   'status-pending',
        rejected:  'status-rejected',
        cancelled: 'status-rejected',
        completed: 'status-approved'
    };

    list.innerHTML = myRequests.map(request => `
        <div class="request-item ${['rejected','cancelled'].includes(request.status) ? 'rejected' : request.status === 'active' || request.status === 'completed' ? 'approved' : ''}">
            <div class="item-header">
                <span class="item-room">Room ${request.roomId} — ${request.roomCategory || ''}</span>
                <span class="item-status ${statusClass[request.status] || ''}">${statusLabel[request.status] || request.status}</span>
            </div>
            <div class="item-details">
                <strong>Date:</strong> ${request.date}<br>
                <strong>Time:</strong> ${request.startTime} – ${request.endTime}<br>
                <strong>Usage:</strong> ${request.requestedStatus || 'N/A'}<br>
                <strong>Purpose:</strong> ${request.purpose || '—'}<br>
                ${request.rejectionReason ? `<strong style="color:#e74c3c;">Reason:</strong> ${request.rejectionReason}<br>` : ''}
                ${request.queuePosition ? `<strong>Queue:</strong> #${request.queuePosition}<br>` : ''}
            </div>
            ${request.status === 'pending' ? `
                <div class="item-actions">
                    <button class="btn-remove" onclick="removeRequest('${request.id}')">Cancel Request</button>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function renderMyHistory() {
    const list = document.getElementById('historyList');
    const emptyState = document.getElementById('emptyHistoryState');
    const session = getSession();
    if (!list || !session) return;

    const myHistory = (roomRequests || [])
        .filter(r => (r.instructor || '').toLowerCase().trim() === (session.username || '').toLowerCase().trim()
            && ['completed','rejected','cancelled'].includes(r.status))
        .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    if (myHistory.length === 0) {
        list.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    if (emptyState) emptyState.style.display = 'none';

    const statusLabel = { completed: '✓ Completed', rejected: '✕ Rejected', cancelled: '✕ Cancelled' };
    const statusBg    = { completed: '#27ae60', rejected: '#e74c3c', cancelled: '#95a5a6' };

    list.innerHTML = myHistory.map(r => {
        const duration = (r.startTime && r.endTime) ? calculateDuration(r.startTime, r.endTime) : '';
        return `
        <div class="request-item ${r.status === 'completed' ? 'approved' : 'rejected'}">
            <div class="item-header">
                <div>
                    <div style="font-weight:700;font-size:14px;">Room ${r.roomId}</div>
                    <div style="font-size:12px;color:#888;">${r.roomCategory || ''}</div>
                </div>
                <span style="background:${statusBg[r.status]};color:white;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">${statusLabel[r.status]}</span>
            </div>
            <div class="item-details">
                <strong>Date:</strong> ${r.date}<br>
                <strong>Time:</strong> ${r.startTime} – ${r.endTime} ${duration ? `<span style="opacity:0.6;">(${duration})</span>` : ''}<br>
                <strong>Purpose:</strong> ${escapeHtml(r.purpose || '—')}<br>
                ${r.rejectionReason ? `<strong style="color:#e74c3c;">Rejection Reason:</strong> ${escapeHtml(r.rejectionReason)}<br>` : ''}
            </div>
            <div class="item-actions" style="padding-top:8px;border-top:1px solid var(--border,#eee);margin-top:8px;">
                <button class="btn-remove" style="font-size:12px;padding:6px 12px;" onclick="removeHistoryItem('${r.id}')">Remove from History</button>
            </div>
        </div>`;
    }).join('');
}

async function removeHistoryItem(requestId) {
    try {
        await apiFetch(`/api/requests/${requestId}`, { method: 'DELETE' });
        await refreshData({ render: true, force: true });
    } catch (error) {
        if (typeof showNotification === 'function') showNotification('Error', error.message, 'error', 3000);
        else showToast(error.message, 'error');
    }
}

async function removeRequest(requestId) {
    const request = roomRequests.find(r => r.id === requestId);
    if (!request) { showToast('Request not found', 'error'); return; }
    if (!await showConfirm(`Remove request for Room ${request.roomId}?`)) return;

    try {
        await apiFetch(`/api/requests/${requestId}`, { method: 'DELETE' });
        await refreshData({ render: true });
        showToast('Request removed successfully.', 'success');
    } catch (error) {
        showToast(error.message, 'error');
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
