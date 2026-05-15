// ============================================
// CTU Room Management System - Node.js Server
// Real-time synchronization with Socket.io
// ============================================

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const fs = require('fs');

// ============================================
// CONFIGURATION
// ============================================

const PORT = process.env.PORT || 5501;
const DATA_FILE = path.join(__dirname, 'data.json');

// ============================================
// APP SETUP
// ============================================

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket', 'polling']
});

// Serve static files
app.use(express.static(path.join(__dirname), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        res.setHeader('Cache-Control', 'no-cache');
    }
}));

// ============================================
// DATA STORAGE
// ============================================

// Default Data Structure
const DEFAULT_ROOMS = [
    { id: 101, instructor: "", category: "Comlab Room", date: "", startTime: "", endTime: "", status: "Available", history: [], type: "register" },
    { id: 102, instructor: "", category: "Comlab Room", date: "", startTime: "", endTime: "", status: "Available", history: [], type: "register" },
    { id: 201, instructor: "", category: "Machine Room", date: "", startTime: "", endTime: "", status: "Available", history: [], type: "register" },
    { id: 202, instructor: "", category: "Machine Room", date: "", startTime: "", endTime: "", status: "Available", history: [], type: "register" },
    { id: 301, instructor: "", category: "Library Room", date: "", startTime: "", endTime: "", status: "Available", history: [], type: "register" },
    { id: 401, instructor: "", category: "Office Room", date: "", startTime: "", endTime: "", status: "Available", history: [], type: "register" }
];

const DEFAULT_ADMIN = {
    username: 'admin',
    password: 'admin123',
    fullName: 'System Administrator',
    email: 'admin@ctu.edu.ph',
    role: 'admin',
    createdAt: new Date().toISOString(),
    lastLogin: null,
    loginCount: 0,
    isNewAccount: false
};

// Server-side data storage
const serverData = {
    allRooms: [...DEFAULT_ROOMS],
    systemLogs: [],
    scheduleStatus: {},
    pendingRequests: [],
    usersDatabase: [{ ...DEFAULT_ADMIN }],
    notifications: {}  // Store notifications per user
};

// ============================================
// DATA PERSISTENCE
// ============================================

/**
 * Load data from file
 */
function loadDataFromFile() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf-8');
            const loadedData = JSON.parse(data);
            Object.assign(serverData, loadedData);
            console.log('✅ Data loaded from file');
        } else {
            console.log('📝 No data file found, using defaults');
            saveDataToFile();
        }
    } catch (err) {
        console.error('❌ Error loading data:', err.message);
        console.log('⚠️ Using default data');
    }
}

/**
 * Save data to file
 */
function saveDataToFile() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(serverData, null, 2));
        console.log('💾 Data saved to file');
    } catch (err) {
        console.error('❌ Error saving data:', err.message);
    }
}

// Load data on startup
loadDataFromFile();

// ============================================
// SOCKET.IO EVENTS
// ============================================

io.on('connection', (socket) => {
    console.log(`✅ Client connected: ${socket.id}`);

    // Send initial data to client
    socket.emit('init', serverData);

    // Handle data updates from clients
    socket.on('update', (newData) => {
        console.log(`🔄 Update from ${socket.id}:`);

        // Update server data
        if (newData.allRooms) {
            serverData.allRooms = newData.allRooms;
            console.log('  - Rooms updated');
        }
        if (newData.systemLogs) {
            serverData.systemLogs = newData.systemLogs;
            console.log('  - Logs updated');
        }
        if (newData.scheduleStatus) {
            serverData.scheduleStatus = newData.scheduleStatus;
            console.log('  - Schedule status updated');
        }
        if (newData.pendingRequests) {
            serverData.pendingRequests = newData.pendingRequests;
            console.log('  - Requests updated');
        }
        if (newData.usersDatabase) {
            serverData.usersDatabase = newData.usersDatabase;
            console.log('  - Users database updated');
        }

        // Save to file
        saveDataToFile();

        // Broadcast update to all OTHER clients
        socket.broadcast.emit('sync', serverData);
    });

    // Handle request actions with notifications
    socket.on('requestAction', (action) => {
        console.log(`📨 Request action from ${socket.id}:`, action.type);

        // Add log entry
        const log = {
            timestamp: new Date().toISOString(),
            action: action.action || 'REQUEST_UPDATE',
            roomId: action.roomId,
            user: action.user || 'Unknown',
            category: action.category || 'N/A',
            details: action.details || '',
            status: action.status || 'Pending'
        };

        serverData.systemLogs.unshift(log);

        // Send notification to admin
        if (!serverData.notifications['admin']) {
            serverData.notifications['admin'] = [];
        }
        serverData.notifications['admin'].push({
            type: 'request_update',
            title: action.title || 'Room Request Update',
            message: action.message || `${action.user || 'Unknown'} has ${action.action ? action.action.toLowerCase() : 'updated'} a request for Room ${action.roomId}`,
            roomId: action.roomId,
            timestamp: new Date().toISOString(),
            read: false
        });

        // Broadcast to all clients
        io.emit('sync', serverData);
        io.emit('requestUpdate', action);

        saveDataToFile();
    });

    // Handle room updates with instructor notifications
    socket.on('roomUpdate', (roomData) => {
        console.log(`🏠 Room update from ${socket.id}:`, roomData);

        // Update room in database
        const roomIndex = serverData.allRooms.findIndex(r => r.id === roomData.id);
        if (roomIndex >= 0) {
            serverData.allRooms[roomIndex] = roomData;

            // Notify all instructors about the change
            if (!serverData.notifications['instructors']) {
                serverData.notifications['instructors'] = [];
            }

            serverData.notifications['instructors'].push({
                type: 'room_update',
                title: 'Room Update Notification',
                message: `Room ${roomData.id} (${roomData.category}) has been updated to ${roomData.status}`,
                roomId: roomData.id,
                timestamp: new Date().toISOString(),
                read: false
            });

            // Broadcast to all clients
            io.emit('sync', serverData);
            io.emit('roomUpdateNotification', {
                room: roomData,
                message: `Room ${roomData.id} updated to ${roomData.status}`
            });

            saveDataToFile();
        }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });

    // Handle errors
    socket.on('error', (error) => {
        console.error(`⚠️ Socket error from ${socket.id}:`, error);
    });
});

// ============================================
// HTTP ROUTES
// ============================================

// API to get current data
app.get('/api/data', (req, res) => {
    res.json(serverData);
});

// API to get notifications
app.get('/api/notifications/:role', (req, res) => {
    const role = req.params.role;
    const notifKey = role === 'admin' ? 'admin' : 'instructors';
    res.json(serverData.notifications[notifKey] || []);
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        uptime: process.uptime(),
        rooms: serverData.allRooms.length,
        users: serverData.usersDatabase.length,
        requests: serverData.pendingRequests.length,
        logs: serverData.systemLogs.length
    });
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'html', 'Login.html'));
});

// ============================================
// SERVER STARTUP
// ============================================

server.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let ips = [];

    for (const name of Object.keys(networkInterfaces)) {
        for (const iface of networkInterfaces[name]) {
            if (iface.family === 'IPv4') {
                ips.push(iface.address);
            }
        }
    }

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║        CTU ROOM MANAGEMENT SYSTEM - SERVER STARTED           ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log(`║ Server running on port: ${PORT}`);
    console.log('║ Access the system from any device on the network:            ║');
    ips.forEach(ip => {
        console.log(`║   • http://${ip}:${PORT}`);
    });
    console.log('║ Local access: http://localhost:' + PORT + '                    ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║ Default Login Credentials:                                ║');
    console.log('║   Username: admin                                         ║');
    console.log('║   Role: Admin                                             ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
});

// Periodic data cleanup (every 24 hours)
setInterval(() => {
    // Remove old logs (older than 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    serverData.systemLogs = serverData.systemLogs.filter(log =>
        new Date(log.timestamp) > sevenDaysAgo
    );

    // Clear old notifications (older than 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    Object.keys(serverData.notifications).forEach(key => {
        serverData.notifications[key] = serverData.notifications[key].filter(notif =>
            new Date(notif.timestamp) > oneDayAgo
        );
    });

    saveDataToFile();
    console.log('🧹 Cleanup completed');
}, 24 * 60 * 60 * 1000);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n⏹️  Shutting down gracefully...');
    saveDataToFile();
    process.exit(0);
});

module.exports = server;