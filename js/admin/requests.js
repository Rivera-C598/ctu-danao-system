/* ============================================
   CTU Room Management System - Admin Requests
   API-backed version
   ============================================ */

function normalizeRequestFilter(filter) {
    if (filter === 'approved') return ['active', 'standby', 'completed'];
    if (filter === 'pending') return ['standby'];
    if (filter === 'rejected') return ['rejected'];
    return null;
}

function renderRequestsTable(filter = 'all') {
    const tbody = document.getElementById('requestsBody');
    const table = document.getElementById('requestsTable');
    const noMsg = document.getElementById('noRequestsMsg');
    if (!tbody) return;

    const today = new Date().toISOString().split('T')[0];
    let filteredRequests = [...pendingRequests];
    const statuses = normalizeRequestFilter(filter);

    if (statuses) filteredRequests = filteredRequests.filter(r => statuses.includes(r.status));
    if (filter === 'today') filteredRequests = filteredRequests.filter(r => r.date === today);
    if (filter === 'future') filteredRequests = filteredRequests.filter(r => r.date > today);

    filteredRequests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt));

    document.getElementById('totalRequestsCount').textContent = pendingRequests.length;
    document.getElementById('pendingRequestsCount').textContent = pendingRequests.filter(r => r.status === 'standby').length;
    document.getElementById('approvedRequestsCount').textContent = pendingRequests.filter(r => ['active', 'completed'].includes(r.status)).length;
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
            <td><strong>#${String(req.id).slice(-6)}</strong></td>
            <td>${req.instructorName || getInstructorFullName(req.instructor)}</td>
            <td><strong>Room ${req.roomId}</strong></td>
            <td>${req.roomCategory}</td>
            <td>
                <div>${formatDateShort(req.date)}</div>
                <div style="font-size: 0.85rem; color: #666;">${req.startTime} - ${req.endTime}</div>
            </td>
            <td>
                <div style="font-size: 0.85rem; margin-bottom: 4px;">
                    <strong>Requested:</strong> ${req.requestedStatus || 'N/A'}
                </div>
                <div>${req.purpose || 'N/A'}</div>
                ${req.queuePosition ? `<div style="font-size: 0.85rem;">Queue #${req.queuePosition}</div>` : ''}
            </td>
            <td><span class="request-status status-${req.status}">${req.status}</span></td>
            <td>
                <div class="request-actions">
                    ${['active', 'standby'].includes(req.status) ? `
                        <button class="btn-reject" onclick="rejectRequest('${req.id}')">Cancel/Reject</button>
                    ` : '<span style="color: #999; font-size: 0.85rem;">Closed</span>'}
                </div>
            </td>
        </tr>
    `).join('');
}

function filterRequests(status) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderRequestsTable(status);
}

function approveRequest(_requestId) {
    alert('Requests are automatically approved or queued by the backend.');
}

async function rejectRequest(requestId) {
    const request = pendingRequests.find(r => r.id === requestId);
    if (!request) return alert('Request not found');
    const reason = prompt(`Cancel/reject request for Room ${request.roomId} by ${request.instructorName || request.instructor}?\n\nEnter reason (optional):`);
    if (reason === null) return;

    try {
        await apiFetch(`/api/requests/${requestId}/reject`, {
            method: 'PATCH',
            body: JSON.stringify({ reason })
        });
        await refreshData({ render: true });
        alert('Request cancelled/rejected.');
    } catch (error) {
        alert(error.message);
    }
}

function updateRequestsSidebar() {
    const standby = pendingRequests.filter(r => r.status === 'standby').length;
    const approved = pendingRequests.filter(r => ['active', 'completed'].includes(r.status)).length;
    const rejected = pendingRequests.filter(r => r.status === 'rejected').length;

    const pendingEl = document.getElementById('pendingCountSidebar');
    const approvedEl = document.getElementById('approvedTodaySidebar');
    const rejectedEl = document.getElementById('rejectedTodaySidebar');

    if (pendingEl) pendingEl.textContent = standby;
    if (approvedEl) approvedEl.textContent = approved;
    if (rejectedEl) rejectedEl.textContent = rejected;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderRequestsTable,
        filterRequests,
        approveRequest,
        rejectRequest,
        updateRequestsSidebar
    };
}
