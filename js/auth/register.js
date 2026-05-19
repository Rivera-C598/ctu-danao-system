/* ============================================
   CTU Room Management System - Register Module
   ============================================ */

// Registration state
let selectedRegRole = null;
let isUsernameAvailable = false;
let isPasswordValid = false;
let isPasswordMatched = false;

/**
 * Initialize registration with instructor role (no role selection UI)
 */
function initializeRegistration() {
    selectedRegRole = 'instructor';
    validateRegistrationForm();
}

/**
 * Clear registration form
 */
function clearRegisterForm() {
    document.getElementById('regUsername').value = '';
    document.getElementById('regFullName').value = '';
    document.getElementById('regEmail').value = '';
    document.getElementById('regPhoneNumber').value = '';
    if (document.getElementById('regCode')) document.getElementById('regCode').value = '';
    document.getElementById('regPassword').value = '';
    document.getElementById('regConfirmPassword').value = '';
    document.getElementById('regTerms').checked = false;

    // Clear validation states
    document.getElementById('usernameStatus').textContent = '';
    document.getElementById('usernameStatus').className = 'field-status';
    document.getElementById('passwordStrength').innerHTML = '';
    document.getElementById('passwordMatch').textContent = '';
    document.getElementById('passwordMatch').className = 'field-status';

    isUsernameAvailable = false;
    isPasswordValid = false;
    isPasswordMatched = false;
    updateRegisterButton();
}

/**
 * Check username availability in real-time
 */
function checkUsernameAvailability() {
    const username = document.getElementById('regUsername').value.trim().toLowerCase();
    const statusEl = document.getElementById('usernameStatus');

    if (!username) {
        statusEl.textContent = '';
        isUsernameAvailable = false;
        updateRegisterButton();
        return;
    }

    if (username.length < 3) {
        statusEl.textContent = 'Username must be at least 3 characters';
        statusEl.className = 'field-status taken';
        isUsernameAvailable = false;
        updateRegisterButton();
        return;
    }

    // Check if username exists
    const existingUser = usersDatabase.find(u => u.username.toLowerCase() === username);

    if (existingUser) {
        statusEl.innerHTML = `❌ Username "${username}" is already taken. <a href="#" onclick="switchToLogin(); document.getElementById('loginUsername').value='${username}'; return false;">Sign in instead?</a>`;
        statusEl.className = 'field-status taken';
        isUsernameAvailable = false;
    } else {
        statusEl.textContent = '✓ Username is available';
        statusEl.className = 'field-status available';
        isUsernameAvailable = true;
    }

    updateRegisterButton();
}

/**
 * Check password strength
 */
function checkPasswordStrength() {
    const password = document.getElementById('regPassword').value;
    const strengthEl = document.getElementById('passwordStrength');

    if (!password) {
        strengthEl.innerHTML = '';
        isPasswordValid = false;
        updateRegisterButton();
        return;
    }

    let strength = 0;
    let statusText = '';
    let statusClass = '';

    // Check length
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;

    // Check complexity
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    if (strength <= 2) {
        statusClass = 'weak';
        statusText = 'Weak - Add numbers and special characters';
        isPasswordValid = password.length >= 6;
    } else if (strength <= 4) {
        statusClass = 'medium';
        statusText = 'Medium - Good password';
        isPasswordValid = true;
    } else {
        statusClass = 'strong';
        statusText = 'Strong - Excellent password!';
        isPasswordValid = true;
    }

    strengthEl.innerHTML = `
        <div class="password-strength-bar ${statusClass}"></div>
        <div class="password-strength-text">${statusText}</div>
    `;

    // Re-check password match if confirm field has value
    if (document.getElementById('regConfirmPassword').value) {
        checkPasswordMatch();
    }

    updateRegisterButton();
}

/**
 * Check if passwords match
 */
function checkPasswordMatch() {
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regConfirmPassword').value;
    const matchEl = document.getElementById('passwordMatch');

    if (!confirm) {
        matchEl.textContent = '';
        isPasswordMatched = false;
        updateRegisterButton();
        return;
    }

    if (password === confirm) {
        matchEl.textContent = '✓ Passwords match';
        matchEl.className = 'field-status available';
        isPasswordMatched = true;
    } else {
        matchEl.textContent = '❌ Passwords do not match';
        matchEl.className = 'field-status taken';
        isPasswordMatched = false;
    }

    updateRegisterButton();
}

/**
 * Validate entire registration form
 */
function validateRegistrationForm() {
    updateRegisterButton();
}

/**
 * Update register button state
 */
function updateRegisterButton() {
    const termsChecked = document.getElementById('regTerms').checked;
    const fullName = document.getElementById('regFullName').value.trim();
    const code = document.getElementById('regCode') ? document.getElementById('regCode').value.trim() : '';
    const btn = document.getElementById('btnRegister');

    const isValid = isUsernameAvailable &&
        isPasswordValid &&
        isPasswordMatched &&
        termsChecked &&
        fullName &&
        code;

    btn.disabled = !isValid;
}

/**
 * Perform registration
 */
async function performRegistration() {
    const username = document.getElementById('regUsername').value.trim().toLowerCase();
    const fullName = document.getElementById('regFullName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const phoneNumber = document.getElementById('regPhoneNumber').value.trim();
    const registrationCode = document.getElementById('regCode') ? document.getElementById('regCode').value.trim() : '';
    const password = document.getElementById('regPassword').value;
    const messageEl = document.getElementById('registerMessage');

    // Final validation checks
    if (!isUsernameAvailable) {
        messageEl.textContent = 'Please choose a different username';
        messageEl.className = 'register-message error';
        return;
    }

    if (!phoneNumber) {
        messageEl.textContent = 'Phone number is required for account recovery';
        messageEl.className = 'register-message error';
        return;
    }

    if (!registrationCode) {
        messageEl.textContent = 'Registration code is required';
        messageEl.className = 'register-message error';
        return;
    }

    try {
        await apiFetch('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, fullName, email: email || null, phoneNumber, registrationCode })
        });
        messageEl.innerHTML = `✓ Account created successfully! Welcome, <strong>${fullName}</strong>! Redirecting to login...`;
        messageEl.className = 'register-message success';

        setTimeout(() => {
            switchToLogin();
            document.getElementById('loginUsername').value = username;
            document.getElementById('loginError').innerHTML = `<span style="color: var(--available);">Account created! Please sign in with your new credentials.</span>`;
        }, 1500);
    } catch (error) {
        messageEl.textContent = error.message;
        messageEl.className = 'register-message error';
    }
}

// Event listeners for registration form
document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'regTerms') {
        updateRegisterButton();
    }
});

document.addEventListener('input', function (e) {
    if (e.target && (e.target.id === 'regFullName' || e.target.id === 'regCode')) {
        updateRegisterButton();
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        selectedRegRole,
        isUsernameAvailable,
        isPasswordValid,
        isPasswordMatched,
        selectRegRole,
        clearRegisterForm,
        checkUsernameAvailability,
        checkPasswordStrength,
        checkPasswordMatch,
        validateRegistrationForm,
        updateRegisterButton,
        performRegistration
    };
}
