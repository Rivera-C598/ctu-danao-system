/* ============================================
   CTU Room Management System - Notifications
   Real-time notifications for instructors & admin
   ============================================ */

// Notification storage
let notifications = [];
let notificationSound = null;

/**
 * Initialize notifications system
 */
function initNotifications() {
    // Create notification sound (simple beep using Web Audio API)
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800; // 800 Hz frequency
        oscillator.type = 'sine';

        // This is just setup; we'll use it later
    } catch (err) {
        console.warn('Could not initialize audio context for notifications');
    }

    // Listen for room update notifications from server
    if (typeof socket !== 'undefined' && socket) {
        socket.on('roomUpdateNotification', (data) => {
            console.log('📢 Room update notification received:', data);
            showNotification('Room Update', data.message, 'info', 5000);
            playNotificationSound();
        });

        socket.on('requestUpdate', (action) => {
            console.log('📢 Request update notification received:', action);
            if (currentRole === 'instructor') {
                const message = `Your room request for ${action.roomId} has been ${action.status || 'updated'}`;
                showNotification('Request Update', message, action.status === 'Approved' ? 'success' : 'warning', 5000);
                playNotificationSound();
            }
        });

        socket.on('notificationAlert', (data) => {
            console.log('📢 Alert notification received:', data);
            showNotification(data.title, data.message, data.type || 'info', 5000);
            if (data.type === 'error' || data.type === 'warning') {
                playNotificationSound();
            }
        });
    }

    console.log('✅ Notifications system initialized');
}

/**
 * Show notification toast/popup
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} type - 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (0 = permanent)
 */
function showNotification(title, message, type = 'info', duration = 5000) {
    // Create notification element
    const notifContainer = document.createElement('div');
    notifContainer.className = `notification notification-${type}`;
    notifContainer.innerHTML = `
        <div class="notification-header">
            <strong>${title}</strong>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="notification-body">
            ${message}
        </div>
    `;

    // Add to page
    const notificationArea = document.getElementById('notificationArea') || createNotificationArea();
    notificationArea.appendChild(notifContainer);

    // Add to notifications array
    const notifObj = {
        id: Date.now(),
        title: title,
        message: message,
        type: type,
        timestamp: new Date().toISOString(),
        read: false
    };
    notifications.unshift(notifObj);

    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            notifContainer.classList.add('removing');
            setTimeout(() => notifContainer.remove(), 300);
        }, duration);
    }

    // Also show browser notification if available
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
            body: message,
            icon: '/assets/ctu-logo.png'  // Adjust path as needed
        });
    }
}

/**
 * Play notification sound
 */
function playNotificationSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Play double beep
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';

        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);

        // Second beep
        setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();

            osc2.connect(gain2);
            gain2.connect(audioContext.destination);

            osc2.frequency.value = 1000;
            osc2.type = 'sine';

            gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

            osc2.start(audioContext.currentTime);
            osc2.stop(audioContext.currentTime + 0.2);
        }, 250);
    } catch (err) {
        console.warn('Could not play notification sound:', err.message);
    }
}

/**
 * Create notification area if it doesn't exist
 */
function createNotificationArea() {
    const area = document.createElement('div');
    area.id = 'notificationArea';
    area.className = 'notification-area';
    document.body.insertBefore(area, document.body.firstChild);
    return area;
}

/**
 * Request browser notification permission
 */
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

/**
 * Get all notifications
 */
function getNotifications() {
    return notifications;
}

/**
 * Mark notification as read
 */
function markNotificationAsRead(notifId) {
    const notif = notifications.find(n => n.id === notifId);
    if (notif) {
        notif.read = true;
    }
}

/**
 * Clear all notifications
 */
function clearAllNotifications() {
    notifications = [];
    const area = document.getElementById('notificationArea');
    if (area) {
        area.innerHTML = '';
    }
}

/**
 * Show notification center modal
 */
function showNotificationCenter() {
    const modal = document.getElementById('notificationModal');
    if (!modal) {
        createNotificationCenterModal();
    } else {
        modal.style.display = 'flex';
    }
    renderNotificationList();
}

/**
 * Create notification center modal
 */
function createNotificationCenterModal() {
    const modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.className = 'notification-modal';
    modal.innerHTML = `
        <div class="notification-modal-content">
            <div class="notification-modal-header">
                <h2>📬 Notifications</h2>
                <button class="modal-close-btn" onclick="document.getElementById('notificationModal').style.display='none'">×</button>
            </div>
            <div id="notificationList" class="notification-list">
                <!-- Notifications will be rendered here -->
            </div>
            <div class="notification-modal-footer">
                <button class="btn-secondary" onclick="clearAllNotifications(); renderNotificationList()">Clear All</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

/**
 * Render notification list
 */
function renderNotificationList() {
    const list = document.getElementById('notificationList');
    if (!list) return;

    if (notifications.length === 0) {
        list.innerHTML = '<div class="no-notifications">No notifications yet</div>';
        return;
    }

    list.innerHTML = notifications.map(notif => `
        <div class="notification-item notification-${notif.type}">
            <div class="notification-item-header">
                <strong>${notif.title}</strong>
                <span class="notification-time">${new Date(notif.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="notification-item-body">${notif.message}</div>
            ${!notif.read ? '<span class="badge-unread">New</span>' : ''}
        </div>
    `).join('');
}

/**
 * Send notification to server (for other clients to receive)
 */
function sendNotificationToUsers(title, message, targetRole = 'instructor') {
    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('sendNotification', {
            title: title,
            message: message,
            targetRole: targetRole,
            sender: currentUser,
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Notify instructor of room state change
 */
function notifyInstructorOfRoomChange(room, previousStatus) {
    const message = `Room ${room.id} (${room.category}) status changed from ${previousStatus} to ${room.status}`;

    if (typeof socket !== 'undefined' && socket && socket.connected) {
        socket.emit('roomUpdate', room);
    }

    // Show local notification if current user is an instructor
    if (currentRole === 'instructor') {
        showNotification('Room Status Updated', message, 'info', 5000);
    }
}

/**
 * Initialize on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    initNotifications();
});
