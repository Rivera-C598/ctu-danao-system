// js/firebase/firebase-config.js
// ============================================
// SERVER CONFIGURATION (Not using Firebase)
// ============================================
// This system uses Node.js + Socket.io for real-time synchronization

const SERVER_CONFIG = {
    SERVER_URL: window.location.protocol.startsWith('http')
        ? window.location.origin
        : 'http://localhost:3000',
    SOCKET_OPTIONS: {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
    }
};

export { SERVER_CONFIG };