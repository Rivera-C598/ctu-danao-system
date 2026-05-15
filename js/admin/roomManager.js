/* ============================================
   CTU Room Management System - Admin Room Manager
   ============================================ */

/**
 * Add a new room or schedule
 * @param {string} type - 'register' or 'schedule'
 */
function addNewRoom(type) {
    const id = document.getElementById('newRoomId').value;
    const cat = document.getElementById('newRoomCat').value;
    const status = document.getElementById('newRoomStatus').value;

    if (!id) return alert("Please enter a Room Number.");

    const roomId = parseInt(id);
    const existingRoom = allRooms.find(r => r.id === roomId && r.type === 'register');

    if (existingRoom) {
        alert(`Room ${id} is already registered!`);
        return;
    }

    const time = new Date().toLocaleTimeString();
    const historyEntry = `${time} - 📋 Quick Registered`;

    // Create new room
    const newRoom = {
        id: roomId,
        instructor: '',
        category: cat,
        date: '',
        startTime: '',
        endTime: '',
        status: status,
        history: [historyEntry],
        type: 'register',
        schedules: [],
        scheduleId: null
    };
    allRooms.push(newRoom);

    addLog('register', id, 'Admin', cat, `Room registered with status: ${status}`, status);

    saveToStorage();

    if (currentTab === 'dashboard') {
        renderTable();
    } else if (currentTab === 'monitoring') {
        renderMonitoringTable();
    } else {
        renderDatabaseTable();
    }

    updateScheduleNotifications();
    clearForm();
}

/**
 * Clear the add room form
 */
function clearForm() {
    document.getElementById('newRoomId').value = '';
    document.getElementById('newRoomCat').selectedIndex = 0;
    document.getElementById('newRoomStatus').selectedIndex = 0;

    const dropdown = document.getElementById('addDropdown');
    if (dropdown) dropdown.classList.remove('show');
}

function openQuickRegisterModal() {
    const modal = document.getElementById('quickRegisterModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeQuickRegisterModal() {
    const modal = document.getElementById('quickRegisterModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Reset all rooms to default state
 * ADMIN ONLY - Clears all registrations and schedules
 */
function resetAllRooms() {
    if (!confirm('⚠️ WARNING: This will reset ALL rooms to empty state!\n\nAre you absolutely sure?')) {
        return;
    }
    if (!confirm('🔴 FINAL CONFIRMATION: This action cannot be undone. Reset all rooms?')) {
        return;
    }

    // Reset each room to default state
    allRooms.forEach(room => {
        room.instructor = '';
        room.category = 'Comlab Room';
        room.date = '';
        room.startTime = '';
        room.endTime = '';
        room.status = 'Available';
        room.history = [];
        room.type = 'register';
        room.scheduleId = null;
    });

    // Clear all logs
    systemLogs = [];
    scheduleStatus = {};

    console.log('✅ All rooms have been reset to default state');
    alert('✅ All rooms have been reset successfully!\n\nYou can now re-register them.');

    saveToStorage();
    renderTable();
    updateStatusCounts();
    updateScheduleNotifications();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        addNewRoom,
        clearForm,
        resetAllRooms
    };
}
