/* ============================================
   CTU Room Management System - Admin Room Manager
   API-backed version
   ============================================ */

async function addNewRoom(_type) {
    const id = document.getElementById('newRoomId').value;
    const cat = document.getElementById('newRoomCat').value;
    const status = document.getElementById('newRoomStatus').value;
    if (!id) return alert('Please enter a Room Number.');

    try {
        await apiFetch('/api/rooms', {
            method: 'POST',
            body: JSON.stringify({
                roomNumber: parseInt(id, 10),
                category: cat,
                status,
                isRequestable: true
            })
        });
        await refreshData({ render: true });
        clearForm();
    } catch (error) {
        alert(error.message);
    }
}

function clearForm() {
    document.getElementById('newRoomId').value = '';
    document.getElementById('newRoomCat').selectedIndex = 0;
    document.getElementById('newRoomStatus').selectedIndex = 0;
    const dropdown = document.getElementById('addDropdown');
    if (dropdown) dropdown.classList.remove('show');
}

function openQuickRegisterModal() {
    const modal = document.getElementById('quickRegisterModal');
    if (modal) modal.style.display = 'flex';
}

function closeQuickRegisterModal() {
    const modal = document.getElementById('quickRegisterModal');
    if (modal) modal.style.display = 'none';
}

function resetAllRooms() {
    alert('Bulk room reset is disabled after the database migration.');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        addNewRoom,
        clearForm,
        resetAllRooms
    };
}
