/* ============================================
   CTU Room Management System - Login Module
   ============================================ */

// Current user session
let currentUser = null;
let currentRole = null;

/**
 * Switch to registration mode
 */
function switchToRegister() {
    document.getElementById('loginMode').style.display = 'none';
    document.getElementById('registerMode').style.display = 'block';
    document.getElementById('loginError').textContent = '';
    clearLoginForm();

    // Initialize registration with instructor role
    if (typeof initializeRegistration === 'function') {
        initializeRegistration();
    }
}

/**
 * Switch to login mode
 */
function switchToLogin() {
    document.getElementById('loginMode').style.display = 'block';
    document.getElementById('registerMode').style.display = 'none';
    document.getElementById('recoveryMode').style.display = 'none';
    document.getElementById('loginError').textContent = '';
    document.getElementById('registerMessage').textContent = '';
    document.getElementById('registerMessage').className = 'register-message';
    clearRegisterForm();
    clearRecoveryForm();
}

/**
 * Switch to recovery mode
 */
function switchToRecovery(username = '') {
    document.getElementById('loginMode').style.display = 'none';
    document.getElementById('registerMode').style.display = 'none';
    document.getElementById('recoveryMode').style.display = 'block';
    document.getElementById('loginError').textContent = '';

    // Reset to Phase 1
    document.getElementById('recoveryPhase1').style.display = 'block';
    document.getElementById('recoveryPhase2').style.display = 'none';
    document.getElementById('recoveryPhase1Message').style.display = 'none';
    document.getElementById('recoveryPhase2Message').style.display = 'none';

    // Set username if provided
    document.getElementById('recoveryUsername2').value = username;
    document.getElementById('recoveryPhoneNumber2').focus();
}

/**
 * Clear login form
 */
function clearLoginForm() {
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
}

/**
 * Perform login
 */
async function performLogin() {
    const username = document.getElementById('loginUsername').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    // Validation
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

/**
 * Logout user
 */
async function logout() {
    currentUser = null;
    currentRole = null;
    clearSession();
    try {
        await apiFetch('/api/auth/logout', { method: 'POST', body: '{}' });
    } catch (_error) {
        // Local logout should still continue if the network is unavailable.
    }

    // SECURITY: Clear authentication from localStorage
    if (typeof clearAuthentication === 'function') {
        clearAuthentication();
    }

    window.location.href = '/html/Login.html';
}

/**
 * Check for existing session on page load
 */
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
        const { username, role, fullName } = session;
        currentUser = username;
        currentRole = role;

        // Redirect to appropriate dashboard if on login page
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

/**
 * Require authentication
 * @param {string} requiredRole - Required role ('instructor' or 'admin')
 */
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

/**
 * Toggle password visibility
 * @param {string} inputId - ID of the password input element
 */
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    const button = event.target.closest('.btn-toggle-password');

    if (input.type === 'password') {
        input.type = 'text';
        button.textContent = 'Hide';
    } else {
        input.type = 'password';
        button.textContent = 'Show';
    }
}

/**
 * Clear recovery form
 */
function clearRecoveryForm() {
    document.getElementById('recoveryUsername2').value = '';
    document.getElementById('recoveryPhoneNumber2').value = '';
    document.getElementById('recoveryNewPassword2').value = '';
    document.getElementById('recoveryConfirmPassword2').value = '';
    document.getElementById('recoveryPhase1Message').style.display = 'none';
    document.getElementById('recoveryPhase2Message').style.display = 'none';
}

/**
 * Verify phone number for account recovery (UI Mode)
 */
function verifyPhoneNumberUI() {
    const username = document.getElementById('recoveryUsername2').value.trim().toLowerCase();
    const phoneNumber = document.getElementById('recoveryPhoneNumber2').value.trim();
    const messageEl = document.getElementById('recoveryPhase1Message');

    if (!username) {
        messageEl.textContent = 'Please enter your username';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    if (!phoneNumber) {
        messageEl.textContent = 'Please enter your phone number';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    // Find user
    const user = usersDatabase.find(u => u.username.toLowerCase() === username);
    if (!user) {
        messageEl.textContent = 'User not found';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    // Verify phone number
    if (!user.phoneNumber || user.phoneNumber !== phoneNumber) {
        messageEl.textContent = 'Phone number does not match our records';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    // Phone verified - transition to Phase 2
    document.getElementById('recoveryPhase1').style.display = 'none';
    document.getElementById('recoveryPhase2').style.display = 'block';
    document.getElementById('recoveryPhase1Message').style.display = 'none';
    document.getElementById('recoveryPhase2Message').style.display = 'none';
}

/**
 * Reset password in recovery UI mode
 */
function resetPasswordUI() {
    const username = document.getElementById('recoveryUsername2').value.trim().toLowerCase();
    const newPassword = document.getElementById('recoveryNewPassword2').value;
    const confirmPassword = document.getElementById('recoveryConfirmPassword2').value;
    const messageEl = document.getElementById('recoveryPhase2Message');

    if (!newPassword) {
        messageEl.textContent = 'Please enter a new password';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    if (newPassword.length < 6) {
        messageEl.textContent = 'Password must be at least 6 characters';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    if (newPassword !== confirmPassword) {
        messageEl.textContent = 'Passwords do not match';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    // Find user and update password
    const user = usersDatabase.find(u => u.username.toLowerCase() === username);
    if (user) {
        user.password = newPassword;
        saveUsersDatabase();

        messageEl.innerHTML = '<span style="color: #4caf50;">✓ Password updated successfully! Redirecting to login...</span>';
        messageEl.className = 'recovery-message success';
        messageEl.style.display = 'block';

        setTimeout(() => {
            switchToLogin();
            clearRecoveryForm();
        }, 2000);
    }
}

/**
 * Open account recovery modal
 * @param {string} username - Username to recover
 */
function openRecoveryModal(username) {
    const modal = document.getElementById('recoveryModal');
    if (modal) {
        document.getElementById('recoveryUsername').value = username;
        document.getElementById('recoveryPhoneNumber').value = '';
        document.getElementById('recoveryNewPassword').value = '';
        document.getElementById('recoveryConfirmPassword').value = '';

        // Reset to Phase 1 (Phone Verification)
        document.getElementById('recoveryPhase1').style.display = 'block';
        document.getElementById('recoveryPhase2').style.display = 'none';
        document.getElementById('recoveryPhaseMessage').style.display = 'none';
        document.getElementById('recoveryPasswordMessage').style.display = 'none';

        // Reset button
        const submitBtn = document.getElementById('recoverySubmitBtn');
        if (submitBtn) {
            submitBtn.textContent = 'Verify Phone';
            submitBtn.onclick = verifyPhoneNumber;
        }

        modal.style.display = 'flex';
        document.getElementById('recoveryPhoneNumber').focus();
    }
}

/**
 * Close recovery modal
 */
function closeRecoveryModal() {
    const modal = document.getElementById('recoveryModal');
    if (modal) {
        modal.style.display = 'none';

        // Reset to Phase 1
        document.getElementById('recoveryPhase1').style.display = 'block';
        document.getElementById('recoveryPhase2').style.display = 'none';

        // Clear all fields
        document.getElementById('recoveryUsername').value = '';
        document.getElementById('recoveryPhoneNumber').value = '';
        document.getElementById('recoveryNewPassword').value = '';
        document.getElementById('recoveryConfirmPassword').value = '';

        // Hide messages
        document.getElementById('recoveryPhaseMessage').style.display = 'none';
        document.getElementById('recoveryPasswordMessage').style.display = 'none';

        // Reset button
        const submitBtn = document.getElementById('recoverySubmitBtn');
        if (submitBtn) {
            submitBtn.textContent = 'Verify Phone';
            submitBtn.onclick = verifyPhoneNumber;
        }
    }
}

/**
 * Verify phone number for account recovery
 */
function verifyPhoneNumber() {
    const username = document.getElementById('recoveryUsername').value.trim().toLowerCase();
    const phoneNumber = document.getElementById('recoveryPhoneNumber').value.trim();
    const messageEl = document.getElementById('recoveryPhaseMessage');

    if (!phoneNumber) {
        messageEl.textContent = 'Please enter your phone number';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    // Find user
    const user = usersDatabase.find(u => u.username.toLowerCase() === username);
    if (!user) {
        messageEl.textContent = 'User not found';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    // Verify phone number
    if (!user.phoneNumber || user.phoneNumber !== phoneNumber) {
        messageEl.textContent = 'Phone number does not match our records';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    // Phone verified - transition to Phase 2 (password reset)
    document.getElementById('recoveryPhase1').style.display = 'none';
    document.getElementById('recoveryPhase2').style.display = 'block';
    document.getElementById('recoveryPasswordMessage').style.display = 'none';

    // Change button text and function
    const submitBtn = document.getElementById('recoverySubmitBtn');
    if (submitBtn) {
        submitBtn.textContent = 'Update Password';
        submitBtn.onclick = resetPasswordRecovery;
    }
}

/**
 * Reset password with new one
 */
function resetPasswordRecovery() {
    const username = document.getElementById('recoveryUsername').value.trim().toLowerCase();
    const newPassword = document.getElementById('recoveryNewPassword').value;
    const confirmPassword = document.getElementById('recoveryConfirmPassword').value;
    const messageEl = document.getElementById('recoveryPasswordMessage');

    if (!newPassword) {
        messageEl.textContent = 'Please enter a new password';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    if (newPassword.length < 6) {
        messageEl.textContent = 'Password must be at least 6 characters';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    if (newPassword !== confirmPassword) {
        messageEl.textContent = 'Passwords do not match';
        messageEl.className = 'recovery-message error';
        messageEl.style.display = 'block';
        return;
    }

    // Find user and update password
    const user = usersDatabase.find(u => u.username.toLowerCase() === username);
    if (user) {
        user.password = newPassword;
        saveUsersDatabase();

        messageEl.innerHTML = '<span style="color: #4caf50;">✓ Password updated successfully! You can now login with your new password.</span>';
        messageEl.className = 'recovery-message success';
        messageEl.style.display = 'block';

        setTimeout(() => {
            closeRecoveryModal();
            clearLoginForm();
            document.getElementById('loginError').textContent = '';
        }, 2000);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        currentUser,
        currentRole,
        selectedRole,
        selectRole,
        switchToRegister,
        switchToLogin,
        clearLoginForm,
        performLogin,
        logout,
        checkExistingSession,
        requireAuth
    };
}
