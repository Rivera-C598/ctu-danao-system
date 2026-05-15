/* ============================================
   CTU Room Management System - Auth Guard
   ============================================
   Prevents unauthorized access to protected pages
*/

/**
 * Check if user is authenticated
 * @returns {boolean} true if user is logged in
 */
function isAuthenticated() {
    const currentUser = localStorage.getItem('ctu_current_user');
    return currentUser !== null && currentUser !== 'null';
}

/**
 * Get current authenticated user
 * @returns {Object|null} Current user object or null
 */
function getCurrentUser() {
    const currentUser = localStorage.getItem('ctu_current_user');
    if (!currentUser || currentUser === 'null') {
        return null;
    }
    try {
        return JSON.parse(currentUser);
    } catch (e) {
        console.error('Error parsing current user:', e);
        return null;
    }
}

/**
 * Check if user is admin
 * @returns {boolean} true if current user is admin
 */
function isAdmin() {
    const user = getCurrentUser();
    return user && user.role === 'admin';
}

/**
 * Protect page - redirect to login if not authenticated
 * For use on protected pages like AdminDashboard
 */
function protectPage() {
    if (!isAuthenticated()) {
        console.warn('Unauthorized access attempt - redirecting to login');
        window.location.href = '/html/Login.html';
        return false;
    }
    return true;
}

/**
 * Set authenticated user (called after successful login)
 * @param {Object} user - User object to store
 */
function setCurrentUser(user) {
    localStorage.setItem('ctu_current_user', JSON.stringify(user));
}

/**
 * Clear authentication (logout)
 */
function clearAuthentication() {
    localStorage.removeItem('ctu_current_user');
    localStorage.removeItem('ctu_selected_role');
    console.log('User logged out');
}

/**
 * Set selected role (for UI purposes)
 * @param {string} role - 'instructor' or 'admin'
 */
function setSelectedRole(role) {
    localStorage.setItem('ctu_selected_role', role);
}

/**
 * Get selected role
 * @returns {string|null} Selected role
 */
function getSelectedRole() {
    return localStorage.getItem('ctu_selected_role');
}
