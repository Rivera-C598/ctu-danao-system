// js/firebase/room-service.js
import { db, ref, set, push, onValue, update, remove } from './firebase-config.js';

// Room Operations
export const roomService = {
    // Add new room
    addRoom: async (roomData) => {
        const roomsRef = ref(db, 'rooms/' + roomData.id);
        await set(roomsRef, {
            ...roomData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        return roomData.id;
    },

    // Get all rooms (real-time)
    getAllRooms: (callback) => {
        const roomsRef = ref(db, 'rooms');
        onValue(roomsRef, (snapshot) => {
            const rooms = [];
            snapshot.forEach((childSnapshot) => {
                rooms.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            callback(rooms);
        });
    },

    // Update room status
    updateRoomStatus: async (roomId, status, scheduleData = null) => {
        const updates = {
            status: status,
            updatedAt: new Date().toISOString()
        };
        if (scheduleData) {
            updates.schedule = scheduleData;
        }
        await update(ref(db, 'rooms/' + roomId), updates);
    },

    // Delete room
    deleteRoom: async (roomId) => {
        await remove(ref(db, 'rooms/' + roomId));
    }
};