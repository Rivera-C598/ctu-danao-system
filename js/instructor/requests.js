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
    const prevErr = document.getElementById('submitErrorMsg');
    if (prevErr) prevErr.style.display = 'none';
    document.getElementById('requestModal').classList.remove('modal-hidden');
    autoFillEndTime();
    checkMyExistingBooking();
}

function checkMyExistingBooking() {
    const date = document.getElementById('requestDate')?.value;
    const startTime = document.getElementById('requestStartTime')?.value;
    const endTime   = document.getElementById('requestEndTime')?.value;
    const warn = document.getElementById('myBookingWarning');
    if (!warn || !date || !selectedRoomForRequest) return;
    const session = getSession();
    if (!session) return;
    const myUser = (session.username || '').toLowerCase().trim();
    const today  = new Date().toISOString().split('T')[0];
    const nowM   = new Date().getHours() * 60 + new Date().getMinutes();

    const existing = (roomRequests || []).filter(r =>
        (r.instructor || '').toLowerCase().trim() === myUser &&
        r.roomId === selectedRoomForRequest &&
        r.date === date &&
        ['pending','active','standby'].includes(r.status)
    );
    // Also check OTHER instructors' approved bookings for this room/date
    if (startTime && endTime) {
        const [ns, nm] = startTime.split(':').map(Number);
        const [ne, nem] = endTime.split(':').map(Number);
        const reqStart = ns * 60 + nm, reqEnd = ne * 60 + nem;
        const otherConflict = (roomRequests || []).find(r =>
            (r.instructor || '').toLowerCase().trim() !== myUser &&
            r.roomId === selectedRoomForRequest &&
            r.date === date &&
            ['pending','active','standby'].includes(r.status) &&
            (() => {
                const [es, em] = (r.startTime||'').split(':').map(Number);
                const [ee, eem] = (r.endTime||'').split(':').map(Number);
                return reqStart < (ee*60+eem) && reqEnd > (es*60+em);
            })()
        );
        if (otherConflict) {
            warn.innerHTML = `🚫 <strong>Time slot unavailable.</strong> This room is already booked from <strong>${fmt12Range(otherConflict.startTime, otherConflict.endTime)}</strong>. Please choose a non-overlapping time.`;
            warn.style.background = 'rgba(231,76,60,0.1)';
            warn.style.borderColor = 'rgba(231,76,60,0.3)';
            warn.style.color = '#c0392b';
            warn.style.display = 'block';
            return;
        }
    }

    if (existing.length === 0) { warn.style.display = 'none'; return; }

    // Check if any existing booking overlaps with requested times
    let overlapMsg = '';
    if (startTime && endTime) {
        const [ns, nm] = startTime.split(':').map(Number);
        const [ne, nem] = endTime.split(':').map(Number);
        const reqStart = ns * 60 + nm, reqEnd = ne * 60 + nem;

        const overlap = existing.find(r => {
            const [es, em] = (r.startTime || '').split(':').map(Number);
            const [ee, eem] = (r.endTime || '').split(':').map(Number);
            const rStart = es * 60 + em, rEnd = ee * 60 + eem;
            return reqStart < rEnd && reqEnd > rStart;
        });

        if (overlap) {
            const isActiveNow = overlap.status === 'active' && date === today &&
                nowM >= (overlap.startTime.split(':')[0]*60 + +overlap.startTime.split(':')[1]) &&
                nowM <  (overlap.endTime.split(':')[0]*60   + +overlap.endTime.split(':')[1]);
            overlapMsg = isActiveNow
                ? `🚫 <strong>You are currently using this room</strong> (${fmt12Range(overlap.startTime, overlap.endTime)}). You cannot request the same room while your session is active. Try a different room or a time after your session ends.`
                : `🚫 <strong>Time conflict</strong> with your existing booking (${fmt12Range(overlap.startTime, overlap.endTime)}). Choose a non-overlapping time slot.`;
        }
    }

    if (overlapMsg) {
        warn.innerHTML = overlapMsg;
        warn.style.background = 'rgba(231,76,60,0.1)';
        warn.style.borderColor = 'rgba(231,76,60,0.3)';
        warn.style.color = '#c0392b';
    } else {
        const slots = existing.map(r => fmt12Range(r.startTime, r.endTime)).join(', ');
        warn.innerHTML = `⚠️ You already have a booking here on this date: <strong>${slots}</strong>. You can still book a different time slot.`;
        warn.style.background = 'rgba(243,156,18,0.1)';
        warn.style.borderColor = 'rgba(243,156,18,0.3)';
        warn.style.color = '#d4680a';
    }
    warn.style.display = 'block';
}

function autoFillEndTime() {
    const startInput = document.getElementById('requestStartTime');
    const endInput   = document.getElementById('requestEndTime');
    if (!startInput?.value || endInput?.value) return; // don't overwrite if already set
    const [h, m] = startInput.value.split(':').map(Number);
    const endMins = h * 60 + m + 60; // default +1 hour
    const eh = String(Math.floor(endMins / 60) % 24).padStart(2, '0');
    const em = String(endMins % 60).padStart(2, '0');
    endInput.value = `${eh}:${em}`;
}

function closeRequestModal() {
    document.getElementById('requestModal').classList.add('modal-hidden');
    selectedRoomForRequest = null;
}

async function submitRequest() {
    try {
    const session = getSession();
    if (!session) { showToast('Please log in again', 'error'); return; }

    const checkedRadio = document.querySelector('input[name="requestStatus"]:checked');
    const requestedStatus = checkedRadio ? checkedRadio.value : 'locked';
    const date = document.getElementById('requestDate').value;
    const startTime = document.getElementById('requestStartTime').value;
    const endTime = document.getElementById('requestEndTime').value;
    const purpose = document.getElementById('requestPurpose').value.trim();
    const today = todayLocalString();

    const showFormError = (msg) => {
        let el = document.getElementById('submitErrorMsg');
        if (!el) {
            el = document.createElement('div');
            el.id = 'submitErrorMsg';
            el.style.cssText = 'background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.4);border-radius:8px;padding:10px 12px;font-size:12px;color:#c0392b;font-weight:600;margin-top:10px;';
            const footer = document.querySelector('#requestModal .modal-footer');
            if (footer) footer.parentNode.insertBefore(el, footer);
        }
        el.textContent = '⚠ ' + msg;
        el.style.display = 'block';
    };

    if (!date || !startTime || !endTime) { showFormError('Please fill in all date and time fields.'); return; }
    if (date < today) { showFormError('Cannot request a room for a past date.'); return; }

    if (date === today) {
        const nowTime = new Date();
        const [sh, sm] = startTime.split(':').map(Number);
        const startMinutes = sh * 60 + sm;
        const nowMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();
        if (startMinutes < nowMinutes) { showFormError('Start time cannot be in the past.'); return; }
    }
    if (startTime >= endTime) { showFormError('End time must be after start time — e.g. start 4:00 PM, end 5:00 PM.'); return; }

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
    if (conflict) {
        const nowM2 = new Date().getHours() * 60 + new Date().getMinutes();
        const [cs, cm] = (conflict.startTime || '').split(':').map(Number);
        const [ce, cem] = (conflict.endTime || '').split(':').map(Number);
        const isActiveNow = conflict.status === 'active' && date === today &&
            nowM2 >= cs * 60 + cm && nowM2 < ce * 60 + cem;
        const msg = isActiveNow
            ? `You are currently using Room ${selectedRoomForRequest} (${fmt12Range(conflict.startTime, conflict.endTime)}). Cannot book the same room during your active session. Try after ${fmt12(conflict.endTime)}.`
            : `Time conflict with your own booking (${fmt12Range(conflict.startTime, conflict.endTime)}). Choose a different time slot.`;
        showFormError(msg); return;
    }

    const [sh, sm2] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const durationMins = (eh * 60 + em) - (sh * 60 + sm2);
    if (durationMins < 15) { showFormError('Minimum room usage is 15 minutes.'); return; }

    // Block if overlaps with another instructor's approved booking
    const otherBlock = (roomRequests || []).find(r =>
        (r.instructor || '').toLowerCase().trim() !== (session.username || '').toLowerCase().trim() &&
        r.roomId === selectedRoomForRequest &&
        r.date === date &&
        ['pending','active','standby'].includes(r.status) &&
        (() => {
            const [es, em] = (r.startTime||'').split(':').map(Number);
            const [ee, eem] = (r.endTime||'').split(':').map(Number);
            return newStart < (ee*60+eem) && newEnd > (es*60+em);
        })()
    );
    if (otherBlock) {
        showFormError(`Room ${selectedRoomForRequest} already has a request from ${fmt12Range(otherBlock.startTime, otherBlock.endTime)}. Choose a non-overlapping time slot.`);
        return;
    }

    const submitBtn = document.querySelector('#requestModal .btn-submit');
    if (submitBtn) { submitBtn.textContent = 'Submitting...'; submitBtn.disabled = true; }

    try {
        await apiFetch('/api/requests', {
            method: 'POST',
            body: JSON.stringify({ roomId: selectedRoomForRequest, date, startTime, endTime, purpose, requestedStatus })
        });

        // Show success inside modal before closing
        const body = document.querySelector('#requestModal .modal-body');
        if (body) {
            body.innerHTML = `
                <div style="text-align:center;padding:32px 16px;">
                    <div style="font-size:2.5rem;margin-bottom:12px;">✅</div>
                    <div style="font-weight:700;font-size:1rem;margin-bottom:6px;">Request Submitted!</div>
                    <div style="font-size:0.85rem;opacity:0.65;">Waiting for admin approval. Check the Requests tab for updates.</div>
                </div>`;
        }
        const footer = document.querySelector('#requestModal .modal-footer');
        if (footer) footer.style.display = 'none';

        await refreshData({ render: true, force: true });
        setTimeout(() => { closeRequestModal(); if (footer) footer.style.display = ''; }, 1800);

    } catch (error) {
        if (submitBtn) { submitBtn.textContent = 'Submit Request'; submitBtn.disabled = false; }
        // Show error inside modal — visible regardless of z-index
        const errMsg = error.message || 'Failed to submit request.';
        let errEl = document.getElementById('submitErrorMsg');
        if (!errEl) {
            errEl = document.createElement('div');
            errEl.id = 'submitErrorMsg';
            errEl.style.cssText = 'background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.4);border-radius:8px;padding:10px 12px;font-size:12px;color:#c0392b;font-weight:600;margin-top:10px;';
            const footer = document.querySelector('#requestModal .modal-footer');
            if (footer) footer.parentNode.insertBefore(errEl, footer);
        }
        errEl.textContent = '⚠ ' + errMsg;
        errEl.style.display = 'block';
        setTimeout(() => { if (errEl) errEl.style.display = 'none'; }, 6000);
    }
    } catch (outerErr) {
        console.error('submitRequest crashed:', outerErr);
        showToast('Something went wrong: ' + outerErr.message, 'error');
        const btn = document.querySelector('#requestModal .btn-submit');
        if (btn) { btn.textContent = 'Submit Request'; btn.disabled = false; }
    }
}

function _getDismissed() {
    try { return JSON.parse(localStorage.getItem('ctu_dismissed_requests') || '{}'); } catch { return {}; }
}
function dismissRequest(id) {
    const d = _getDismissed();
    d[id] = true;
    localStorage.setItem('ctu_dismissed_requests', JSON.stringify(d));
    renderMyRequests();
    renderMyHistory();
}

// Track which request statuses instructor has "seen"
function _getSeenStatuses() {
    try { return JSON.parse(localStorage.getItem('ctu_seen_statuses') || '{}'); } catch { return {}; }
}
function _markSeen(requestId) {
    const s = _getSeenStatuses();
    s[requestId] = true;
    localStorage.setItem('ctu_seen_statuses', JSON.stringify(s));
}
function clearRequestsBadge() {
    const badge = document.getElementById('requestBadge');
    if (badge) badge.style.display = 'none';
    // Mark all current requests as seen
    const session = getSession();
    if (!session) return;
    const seen = _getSeenStatuses();
    const u = (session.username || '').toLowerCase().trim();
    (roomRequests || []).filter(r => (r.instructor || '').toLowerCase().trim() === u).forEach(r => { seen[r.id + '_' + r.status] = true; });
    localStorage.setItem('ctu_seen_statuses', JSON.stringify(seen));
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

    // Schedule badge: show count of active-RIGHT-NOW sessions
    const today = new Date().toISOString().split('T')[0];
    const nowM  = new Date().getHours() * 60 + new Date().getMinutes();
    const activeNow = mine.filter(r => {
        if (r.status !== 'active' || r.date !== today) return false;
        const [sh, sm] = (r.startTime || '').split(':').map(Number);
        const [eh, em] = (r.endTime   || '').split(':').map(Number);
        return nowM >= sh * 60 + sm && nowM < eh * 60 + em;
    }).length;
    const badge = document.getElementById('scheduleBadge');
    if (badge) {
        badge.textContent = activeNow || mine.length;
        badge.style.display = mine.length > 0 ? '' : 'none';
        badge.style.background = activeNow > 0 ? '#27ae60' : '';
    }
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
                <strong>Time:</strong> ${fmt12Range(r.startTime, r.endTime)} ${duration ? `<span style="color:#888;">(${duration})</span>` : ''}<br>
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

    const myUsername = (session.username || '').toLowerCase().trim();
    const dismissed = _getDismissed();
    const myRequests = (roomRequests || [])
        .filter(r =>
            (r.instructor || '').toLowerCase().trim() === myUsername &&
            (r.status === 'pending' || ((r.status === 'rejected' || r.status === 'cancelled') && !dismissed[r.id]))
        )
        .sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    const emptyReq = document.getElementById('emptyRequestsState');
    if (myRequests.length === 0) {
        list.innerHTML = '';
        if (emptyReq) emptyReq.style.display = 'block';
        if (noData) noData.style.display = 'none';
        return;
    }
    if (emptyReq) emptyReq.style.display = 'none';

    // Unseen: pending count + any status changed since last seen
    const seen = _getSeenStatuses();
    const pending = myRequests.filter(r => r.status === 'pending').length;
    const allMine = (roomRequests || []).filter(r => (r.instructor||'').toLowerCase().trim() === myUsername);
    const unseenChanges = allMine.filter(r => !seen[r.id + '_' + r.status] && ['rejected','cancelled','active','standby'].includes(r.status)).length;
    const totalUnseen = pending + unseenChanges;
    const badge = document.getElementById('requestBadge');
    if (badge) { badge.textContent = totalUnseen || ''; badge.style.display = totalUnseen > 0 ? '' : 'none'; }
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
                <strong>Time:</strong> ${fmt12Range(request.startTime, request.endTime)}<br>
                <strong>Usage:</strong> ${request.requestedStatus || 'N/A'}<br>
                <strong>Purpose:</strong> ${request.purpose || '—'}<br>
                ${request.rejectionReason ? `<strong style="color:#e74c3c;">Reason:</strong> ${request.rejectionReason}<br>` : ''}
                ${request.queuePosition ? `<strong>Queue:</strong> #${request.queuePosition}<br>` : ''}
            </div>
            ${request.status === 'pending' ? `
                <div class="item-actions">
                    <button class="btn-remove" onclick="removeRequest('${request.id}')">Cancel Request</button>
                </div>
            ` : ['rejected','cancelled'].includes(request.status) ? `
                <div class="item-actions" style="padding-top:8px;border-top:1px solid var(--border,#eee);margin-top:8px;">
                    <button class="btn-remove" style="font-size:12px;padding:6px 14px;" onclick="dismissRequest('${request.id}')">Dismiss → History</button>
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

    const dismissed = _getDismissed();
    const myHistUser = (session.username || '').toLowerCase().trim();
    const myHistory = (roomRequests || [])
        .filter(r => {
            const sameUser = (r.instructor || '').toLowerCase().trim() === myHistUser;
            if (!sameUser) return false;
            if (r.status === 'completed') return true;
            // rejected/cancelled: only show if dismissed
            if ((r.status === 'rejected' || r.status === 'cancelled') && dismissed[r.id]) return true;
            return false;
        })
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
                <strong>Time:</strong> ${fmt12Range(r.startTime, r.endTime)} ${duration ? `<span style="opacity:0.6;">(${duration})</span>` : ''}<br>
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
        await refreshData({ render: true, force: true });
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
