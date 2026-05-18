/* ============================================
   CTU Room Management System - Admin Requests
   ============================================ */

let _activeRequestFilter = 'pending';

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
        ` : isApproved ? `
            <button class="btn-reject" onclick="rejectRequest('${req.id}')">Cancel</button>
        ` : `<span style="color:#999;font-size:0.82rem;">Closed</span>`;

        const duration = (req.startTime && req.endTime) ? calculateDuration(req.startTime, req.endTime) : '—';
        return `
        <tr>
            <td>${escapeHtml(req.instructorName || getInstructorFullName(req.instructor))}</td>
            <td><strong>Room ${escapeHtml(req.roomId)}</strong><br><small style="color:#888;">${escapeHtml(req.roomCategory)}</small></td>
            <td>
                <div style="font-weight:600;">${escapeHtml(req.date)}</div>
                <div style="font-size:0.85rem;color:#666;">${escapeHtml(req.startTime)} – ${escapeHtml(req.endTime)}</div>
            </td>
            <td><span class="duration-badge">${escapeHtml(duration)}</span></td>
            <td>
                <span style="background:${statusColor};color:white;padding:3px 10px;border-radius:12px;font-size:0.78rem;font-weight:700;">${escapeHtml(statusLabel)}</span>
                ${req.queuePosition ? `<div style="font-size:0.78rem;color:#888;margin-top:4px;">Queue #${escapeHtml(String(req.queuePosition))}</div>` : ''}
            </td>
            <td style="font-size:0.85rem;">
                <div><strong>${escapeHtml(req.requestedStatus || 'locked')}</strong></div>
                <div style="color:#666;">${escapeHtml(req.purpose || '—')}</div>
            </td>
            <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${actions}
                </div>
            </td>
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
    if (!await showConfirm(`Approve Room ${req.roomId} for ${req.instructorName || req.instructor}?\n${req.date}  ${req.startTime}–${req.endTime}`)) return;
    try {
        const result = await apiFetch(`/api/requests/${requestId}/approve`, { method: 'POST', body: '{}' });
        await refreshData({ render: true });
        showNotification('Approved', result.status === 'standby'
            ? 'Added to queue — time slot already has an active booking.'
            : 'Room booked for this slot.', 'success', 4000);
    } catch (error) {
        showNotification('Error', error.message, 'error', 4000);
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
