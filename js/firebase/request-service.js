// js/firebase/request-service.js
import { db, ref, set, push, onValue, update, remove } from './firebase-config.js';

export const requestService = {
    // Submit new request
    submitRequest: async (requestData) => {
        const requestsRef = ref(db, 'requests');
        const newRequestRef = push(requestsRef);
        await set(newRequestRef, {
            ...requestData,
            status: 'pending',
            createdAt: new Date().toISOString(),
            id: newRequestRef.key
        });
        return newRequestRef.key;
    },

    // Get all requests (real-time)
    getAllRequests: (callback) => {
        const requestsRef = ref(db, 'requests');
        onValue(requestsRef, (snapshot) => {
            const requests = [];
            snapshot.forEach((childSnapshot) => {
                requests.push({
                    id: childSnapshot.key,
                    ...childSnapshot.val()
                });
            });
            callback(requests);
        });
    },

    // Get requests by instructor
    getRequestsByInstructor: (instructorId, callback) => {
        const requestsRef = ref(db, 'requests');
        onValue(requestsRef, (snapshot) => {
            const requests = [];
            snapshot.forEach((childSnapshot) => {
                const data = childSnapshot.val();
                if (data.instructorId === instructorId) {
                    requests.push({
                        id: childSnapshot.key,
                        ...data
                    });
                }
            });
            callback(requests);
        });
    },

    // Update request status (approve/reject)
    updateRequestStatus: async (requestId, status, adminNotes = '') => {
        await update(ref(db, 'requests/' + requestId), {
            status: status,
            adminNotes: adminNotes,
            updatedAt: new Date().toISOString(),
            updatedBy: localStorage.getItem('currentUser') || 'admin'
        });
    },

    // Delete request
    deleteRequest: async (requestId) => {
        await remove(ref(db, 'requests/' + requestId));
    }
};