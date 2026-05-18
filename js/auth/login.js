/* ============================================
   CTU Room Management System - Login Module
   ============================================ */

// Current user session
let currentUser = null;
let currentRole = null;

function switchToRegister() {
    document.getElementById('loginMode').style.display = 'none';
    document.getElementById('registerMode').style.display = 'block';
    document.getElementById('loginError').textContent = '';
    clearLoginForm();

    if (typeof initializeRegistration === 'function') {
        initializeRegistration();
    }
}

function switchToLogin() {
    document.getElementById('loginMode').style.display = 'block';
    document.getElementById('registerMode').style.display = 'none';
    document.getElementById('recoveryMode').style.display = 'none';
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerMessage').textContent = '';
    document.getElementById('registerMessage').className = 'register-message';
    clearRegisterForm();
}

function switchToRecovery() {
    document.getElementById('loginMode').style.display = 'none';
    document.getElementById('registerMode').style.display = 'none';
    document.getElementById('recoveryMode').style.display = 'block';
    document.getElementById('loginError').textContent = '';
}

function clearLoginForm() {
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
}

async function performLogin() {
    const username = document.getElementById('loginUsername').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    if (!username) {
        errorDiv.textContent = 'Please enter your username or ID';
        return;
    }
    if (!password) {
        errorDiv.textContent = 'Please enter your password';
        return;
    }

    try {
        const result = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        const user = result.user;
        currentUser = user.username;
        currentRole = user.role;
        saveSession({
            username: user.username,
            role: user.role,
            fullName: user.fullName
        });
        if (typeof setCurrentUser === 'function') {
            setCurrentUser({
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                email: user.email,
                loginTime: new Date().toISOString()
            });
        }
        document.getElementById('loginView').style.display = 'none';
        window.location.href = user.role === 'admin' ? '/html/AdminDashboard.html' : '/html/InstructorDashboard.html';
    } catch (error) {
        errorDiv.textContent = error.message;
    }
}

async function logout() {
    if (!await showConfirm('Log out of the system?', { title: 'Log Out', confirmText: 'Log Out' })) return;
    currentUser = null;
    currentRole = null;
    clearSession();
    try {
        await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' });
    } catch (_error) {
        // Local logout should still continue if the network is unavailable.
    }

    if (typeof clearAuthentication === 'function') {
        clearAuthentication();
    }

    window.location.href = '/html/Login.html';
}

async function checkExistingSession() {
    let session = getSession();
    try {
        const result = await apiFetch('/api/auth/me');
        session = {
            username: result.user.username,
            role: result.user.role,
            fullName: result.user.fullName
        };
        saveSession(session);
        if (typeof setCurrentUser === 'function') setCurrentUser(result.user);
    } catch (_error) {
        session = null;
    }
    if (session) {
        const { username, role } = session;
        currentUser = username;
        currentRole = role;

        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'Login.html' || currentPage === '') {
            if (role === 'instructor') {
                window.location.href = '/html/InstructorDashboard.html';
            } else {
                window.location.href = '/html/AdminDashboard.html';
            }
        }

        return true;
    }
    return false;
}

function requireAuth(requiredRole) {
    const session = getSession();
    if (!session) {
        window.location.href = './Login.html';
        return false;
    }

    if (requiredRole && session.role !== requiredRole) {
        window.location.href = './Login.html';
        return false;
    }

    currentUser = session.username;
    currentRole = session.role;
    return true;
}

function togglePasswordVisibility(inputId, event) {
    const input = document.getElementById(inputId);
    const button = event.currentTarget;

    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = 'Hide';
    } else {
        input.type = 'password';
        button.textContent = 'Show';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        currentUser,
        currentRole,
        switchToRegister,
        switchToLogin,
        clearLoginForm,
        performLogin,
        logout,
        checkExistingSession,
        requireAuth
    };
}
