// js/firebase/auth-service.js
// ============================================
// Local Storage Authentication Service
// ============================================
// Using local storage with Socket.io sync instead of Firebase

export const authService = {
    // Register new user
    register: async (username, password, userData) => {
        // Ensure usersDatabase is available
        if (typeof usersDatabase === 'undefined') {
            throw new Error('Database not initialized');
        }

        // Check if user exists
        const existingUser = usersDatabase.find(u =>
            u.username && u.username.toLowerCase() === username.toLowerCase()
        );

        if (existingUser) {
            throw new Error('Username already exists');
        }

        // Create new user
        const newUser = {
            ...userData,
            username: username.toLowerCase(),
            password: password, // NOTE: In production, use bcrypt or similar!
            email: userData.email || '',
            role: userData.role || 'instructor',
            createdAt: new Date().toISOString(),
            lastLogin: null,
            loginCount: 0,
            isNewAccount: true
        };

        // Add to database
        usersDatabase.push(newUser);

        // Save and sync
        if (typeof saveUsersDatabase === 'function') {
            saveUsersDatabase();
        } else {
            console.warn('saveUsersDatabase function not available');
        }

        return newUser;
    },

    // Login
    login: async (username, password) => {
        if (typeof usersDatabase === 'undefined') {
            throw new Error('Database not initialized');
        }

        const user = usersDatabase.find(u =>
            u.username && u.username.toLowerCase() === username.toLowerCase()
        );

        if (!user) {
            throw new Error('User not found');
        }

        if (user.password !== password) {
            throw new Error('Incorrect password');
        }

        // Update login stats
        user.lastLogin = new Date().toISOString();
        user.loginCount = (user.loginCount || 0) + 1;

        // Save and sync
        if (typeof saveUsersDatabase === 'function') {
            saveUsersDatabase();
        }

        return user;
    },

    // Logout
    logout: async () => {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('userRole');
        localStorage.removeItem('ctu_current_user');

        // Call global logout if available
        if (typeof logout === 'function') {
            logout();
        }
    },

    // Check if user is logged in
    isLoggedIn: () => {
        return !!localStorage.getItem('ctu_current_user');
    },

    // Get current user data
    getCurrentUser: () => {
        try {
            const session = getSession ? getSession() : JSON.parse(localStorage.getItem('ctu_current_user') || 'null');
            if (!session || !session.username) return null;

            if (typeof usersDatabase === 'undefined') return null;

            return usersDatabase.find(u =>
                u.username && u.username.toLowerCase() === session.username.toLowerCase()
            );
        } catch (e) {
            console.error('Error getting current user:', e);
            return null;
        }
    }
};