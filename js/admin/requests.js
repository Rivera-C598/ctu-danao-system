/* ============================================
   CTU Room Management System - Admin Requests
   ============================================ */

function _instructorAvatar(req, size = 30) {
    const name = req.instructorName || getInstructorFullName(req.instructor) || req.instructor || '?';
    const url  = req.instructorAvatar;
    const r    = size / 2;
    const fontSize = Math.round(size * 0.4);
    if (url) {
        return `<img src="${url}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`;
    }
    if (typeof avatarHtml === 'function') return avatarHtml(name, size, fontSize);
    return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#c0392b;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:${fontSize}px;flex-shrink:0;">${name[0]?.toUpperCase()||'?'}</div>`;
}

let _activeRequestFilter = 'pending';

function openRequestDetail(requestId) {
    const req = roomRequests.find(r => r.id === requestId);
    if (!req) return;
    const modal = document.getElementById('requestDetailModal');
    const body  = document.getElementById('requestDetailBody');
    const footer = document.getElementById('requestDetailFooter');
    if (!modal || !body || !footer) return;

    const usageLabel = { locked: '🔒 Class / Private Use', meeting: '👥 Group Meeting', maintenance: '🔧 Maintenance' }[req.requestedStatus] || req.requestedStatus;
    const isPending = req.status === 'pending';

    body.innerHTML = `
        <div style="display:grid;gap:12px;">
            <div style="display:flex;justify-content:space-between;align-items:start;">
                <div>
                    <div style="font-size:1.3rem;font-weight:800;color:var(--primary);">Room ${req.roomId}</div>
                    <div style="font-size:0.85rem;color:#888;">${req.roomCategory || ''}</div>
                </div>
                <span style="background:${isPending ? '#f39c12' : '#27ae60'};color:white;padding:4px 12px;border-radius:12px;font-size:0.78rem;font-weight:700;">${isPending ? '🕐 Pending' : '✓ ' + req.status}</span>
            </div>
            <hr style="border:none;border-top:1px solid #f0f0f0;margin:0;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:0.88rem;">
                <div><div style="color:#888;font-size:0.78rem;margin-bottom:2px;">INSTRUCTOR</div><div style="font-weight:600;">${req.instructorName || getInstructorFullName(req.instructor)}</div></div>
                <div><div style="color:#888;font-size:0.78rem;margin-bottom:2px;">DATE</div><div style="font-weight:600;">${req.date}</div></div>
                <div><div style="color:#888;font-size:0.78rem;margin-bottom:2px;">TIME</div><div style="font-weight:600;">${typeof fmt12Range === 'function' ? fmt12Range(req.startTime, req.endTime) : req.startTime + ' – ' + req.endTime}</div></div>
                <div><div style="color:#888;font-size:0.78rem;margin-bottom:2px;">DURATION</div><div style="font-weight:600;">${typeof calculateDuration === 'function' ? calculateDuration(req.startTime, req.endTime) : '—'}</div></div>
                <div><div style="color:#888;font-size:0.78rem;margin-bottom:2px;">USAGE TYPE</div><div style="font-weight:600;">${usageLabel}</div></div>
                <div><div style="color:#888;font-size:0.78rem;margin-bottom:2px;">SUBMITTED</div><div style="font-weight:600;">${req.requestedAt ? new Date(req.requestedAt).toLocaleString() : '—'}</div></div>
            </div>
            ${req.purpose ? `<div style="background:#f8f8f8;border-radius:8px;padding:12px;font-size:0.85rem;"><div style="color:#888;font-size:0.75rem;margin-bottom:4px;">PURPOSE / ACTIVITY</div><div>${req.purpose}</div></div>` : ''}
        </div>`;

    footer.innerHTML = isPending ? `
        <button onclick="approveRequest('${req.id}')" style="flex:1;padding:11px;border:none;background:#27ae60;color:white;border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit;">✓ Approve</button>
        <button onclick="closeRequestDetail();rejectRequest('${req.id}')"  style="flex:1;padding:11px;border:none;background:#e74c3c;color:white;border-radius:8px;cursor:pointer;font-weight:700;font-family:inherit;">✕ Reject</button>
    ` : `<button onclick="closeRequestDetail()" style="flex:1;padding:11px;border:1.5px solid #ddd;background:white;border-radius:8px;cursor:pointer;font-weight:600;font-family:inherit;">Close</button>`;

    modal.style.display = 'flex';
}

function closeRequestDetail() {
    const m = document.getElementById('requestDetailModal');
    if (m) m.style.display = 'none';
}

function _syncFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        const onclick = btn.getAttribute('onclick') || '';
        const match = onclick.match(/filterRequests\('(\w+)'\)/);
        if (match) btn.classList.toggle('active', match[1] === _activeRequestFilter);
    });
}

function renderRequestsTable(filter) {
    if (filter !== undefined) _activeRequestFilter = filter;
    filter = _activeRequestFilter;
    _syncFilterButtons();
    const tbody = document.getElementById('requestsBody');
    const table = document.getElementById('requestsTable');
    const noMsg = document.getElementById('noRequestsMsg');
    if (!tbody) return;

    const statusMap = {
        pending:   ['pending'],
        approved:  ['active', 'standby'],
        rejected:  ['rejected', 'cancelled'],
        completed: ['completed'],
        all:       null
    };

    const allowedStatuses = statusMap[filter] || null;
    let filtered = allowedStatuses
        ? roomRequests.filter(r => allowedStatuses.includes(r.status))
        : [...roomRequests];

    filtered.sort((a, b) => new Date(b.requestedAt || 0) - new Date(a.requestedAt || 0));
    const totalFiltered = filtered.length;
    const reqPage = (typeof pageState !== 'undefined' ? pageState.requests : 1) || 1;
    const reqPageSize = (typeof PAGE_SIZE !== 'undefined' ? PAGE_SIZE : 10);
    filtered = filtered.slice((reqPage - 1) * reqPageSize, reqPage * reqPageSize);

    const pending   = roomRequests.filter(r => r.status === 'pending').length;
    const approved  = roomRequests.filter(r => ['active','standby'].includes(r.status)).length;
    const rejected  = roomRequests.filter(r => ['rejected','cancelled'].includes(r.status)).length;
    const completed = roomRequests.filter(r => r.status === 'completed').length;

    document.getElementById('totalRequestsCount').textContent   = roomRequests.length;
    document.getElementById('pendingRequestsCount').textContent = pending;
    document.getElementById('approvedRequestsCount').textContent = approved;
    document.getElementById('rejectedRequestsCount').textContent = rejected + completed;

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        if (noMsg) { noMsg.style.display = 'block'; noMsg.innerHTML = `<p>No ${filter} requests.</p>`; }
        if (table) table.style.display = 'none';
        return;
    }

    if (noMsg) noMsg.style.display = 'none';
    if (table) table.style.display = 'table';

    tbody.innerHTML = filtered.map(req => {
        const isPending  = req.status === 'pending';
        const isApproved = ['active', 'standby'].includes(req.status);
        const statusLabel = {
            pending:   '🕐 Pending',
            active:    '✓ Approved',
            standby:   '⏳ Queued',
            rejected:  '✕ Rejected',
            cancelled: '✕ Cancelled',
            completed: '✓ Completed'
        }[req.status] || req.status;

        const statusColor = {
            pending:   '#f39c12',
            active:    '#27ae60',
            standby:   '#3498db',
            rejected:  '#e74c3c',
            cancelled: '#95a5a6',
            completed: '#7f8c8d'
        }[req.status] || '#999';

        const actions = isPending ? `
            <button class="btn-approve" onclick="approveRequest('${req.id}')">✓ Approve</button>
            <button class="btn-reject"  onclick="rejectRequest('${req.id}')">✕ Reject</button>
        ` : `<span style="color:#999;font-size:0.82rem;">—</span>`;

        const duration = (req.startTime && req.endTime) ? calculateDuration(req.startTime, req.endTime) : '—';
        const clickable = isPending ? `onclick="openRequestDetail('${req.id}')" style="cursor:pointer;" title="Click to review"` : '';
        const submittedAt = req.requestedAt
            ? new Date(req.requestedAt).toLocaleString('en-PH', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:true })
            : '—';
        return `
        <tr ${clickable} class="${isPending ? 'request-row-pending' : ''}">
            <td style="font-size:0.8rem;color:#888;white-space:nowrap;">${submittedAt}</td>
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    ${_instructorAvatar(req, 30)}
                    <span>${escapeHtml(req.instructorName || getInstructorFullName(req.instructor))}</span>
                </div>
            </td>
            <td><strong>Room ${escapeHtml(req.roomId)}</strong><br><small style="color:#888;">${escapeHtml(req.roomCategory)}</small></td>
            <td>
                <div style="font-weight:600;">${escapeHtml(req.date)}</div>
                <div style="font-size:0.85rem;color:#666;">${fmt12Range(req.startTime, req.endTime)}</div>
            </td>
            <td><span class="duration-badge">${escapeHtml(duration)}</span></td>
            <td>
                <span style="background:${statusColor};color:white;padding:3px 10px;border-radius:12px;font-size:0.78rem;font-weight:700;">${escapeHtml(statusLabel)}</span>
                ${req.queuePosition ? `<div style="font-size:0.78rem;color:#888;margin-top:4px;">Queue #${escapeHtml(String(req.queuePosition))}</div>` : ''}
            </td>
            <td style="font-size:0.85rem;">${escapeHtml(req.purpose || '—')}</td>
            ${isPending ? `<td style="color:#c0392b;font-size:0.78rem;font-weight:600;">Click to review →</td>` : '<td></td>'}
        </tr>`;
    }).join('');

    if (typeof renderPagination === 'function') {
        renderPagination('requestsPagination', totalFiltered, reqPage, 'goRequestsPage');
    }
}

function filterRequests(filter) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (event?.target) event.target.classList.add('active');
    renderRequestsTable(filter);
}

async function approveRequest(requestId) {
    const req = roomRequests.find(r => r.id === requestId);
    if (!req) return;
    if (!await showConfirm(`Approve Room ${req.roomId} for ${req.instructorName || req.instructor}?\n${req.date}  ${fmt12Range(req.startTime, req.endTime)}`)) return;
    closeRequestDetail();
    try {
        const result = await apiFetch(`/api/requests/${requestId}/approve`, { method: 'POST', body: '{}' });
        await refreshData({ render: true, force: true });
        showNotification('Approved', result.status === 'standby'
            ? 'Added to queue — sequential slot.'
            : 'Room booked for this slot.', 'success', 4000);
    } catch (error) {
        const msg = error.message || 'Failed to approve request.';
        if (typeof showNotification === 'function') showNotification('⚠ Conflict', msg, 'error', 8000);
        else if (typeof showToast === 'function') showToast(msg, 'error');
        else await showConfirm(msg, { title: '⚠ Cannot Approve', confirmText: 'OK', cancelText: '' });
        await refreshData({ render: true });
    }
}

let _rejectingId = null;

function openRejectModal(requestId) {
    const req = roomRequests.find(r => r.id === requestId);
    if (!req) return;
    _rejectingId = requestId;
    const desc = document.getElementById('rejectModalDesc');
    if (desc) desc.textContent = `Room ${req.roomId} · ${req.instructorName || req.instructor} · ${req.date} ${req.startTime}–${req.endTime}`;
    const input = document.getElementById('rejectReasonInput');
    if (input) input.value = '';
    const modal = document.getElementById('rejectModal');
    if (modal) modal.style.display = 'flex';
}

function closeRejectModal() {
    const modal = document.getElementById('rejectModal');
    if (modal) modal.style.display = 'none';
    _rejectingId = null;
}

async function confirmReject() {
    if (!_rejectingId) return;
    const reason = document.getElementById('rejectReasonInput')?.value.trim() || null;
    const id = _rejectingId;
    closeRejectModal();
    try {
        await apiFetch(`/api/requests/${id}/reject`, {
            method: 'PATCH',
            body: JSON.stringify({ reason })
        });
        await refreshData({ render: true });
        showNotification('Rejected', 'Request has been rejected.', 'info', 3000);
    } catch (error) {
        showNotification('Error', error.message, 'error', 4000);
    }
}

async function rejectRequest(requestId) {
    openRejectModal(requestId);
}


function updateRequestsSidebar() {
    const pending  = roomRequests.filter(r => r.status === 'pending').length;
    const approved = roomRequests.filter(r => ['active','standby'].includes(r.status)).length;
    const rejected = roomRequests.filter(r => ['rejected','cancelled'].includes(r.status)).length;

    const pendingEl  = document.getElementById('pendingCountSidebar');
    const approvedEl = document.getElementById('approvedTodaySidebar');
    const rejectedEl = document.getElementById('rejectedTodaySidebar');

    if (pendingEl)  pendingEl.textContent  = pending;
    if (approvedEl) approvedEl.textContent = approved;
    if (rejectedEl) rejectedEl.textContent = rejected;

    const badge = document.getElementById('navBadgeRequests');
    if (badge) {
        badge.textContent = pending;
        badge.classList.toggle('show', pending > 0);
    }
}

function toggleAutoApprove(enabled) {
    localStorage.setItem('ctu_auto_approve_queue', enabled ? '1' : '0');
    if (enabled) {
        showNotification('Auto-approve queue ON', 'Standby requests for rooms with existing approved bookings will be auto-approved.', 'info', 4000);
    }
}

function isAutoApproveEnabled() {
    return localStorage.getItem('ctu_auto_approve_queue') === '1';
}

async function checkAndAutoApproveQueue() {
    if (!isAutoApproveEnabled()) return;
    const pending = roomRequests.filter(r => r.status === 'pending');
    for (const req of pending) {
        const roomHasActive = roomRequests.some(r =>
            r.roomId === req.roomId &&
            r.date === req.date &&
            ['active', 'standby'].includes(r.status)
        );
        if (roomHasActive) {
            try {
                await apiFetch(`/api/requests/${req.id}/approve`, { method: 'POST', body: '{}' });
            } catch (_e) {}
        }
    }
    await refreshData({ render: true });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { renderRequestsTable, filterRequests, approveRequest, rejectRequest, updateRequestsSidebar, toggleAutoApprove, isAutoApproveEnabled };
}
