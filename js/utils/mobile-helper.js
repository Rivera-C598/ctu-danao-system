/**
 * Mobile Helper Functions for Instructor Dashboard
 * Ensures smooth mobile experience on CP/Mobile devices
 */

// Prevent zoom on double tap for iOS
let lastTouchEnd = 0;
document.addEventListener('touchend', function(event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Prevent pull-to-refresh on mobile (optional, keeps app feel)
document.body.addEventListener('touchmove', function(e) {
    if (e.target.closest('.modal-content') || e.target.closest('.sidebar.expanded')) {
        e.stopPropagation();
    }
}, { passive: true });

// Handle iOS keyboard appearing
document.addEventListener('focusin', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        document.body.classList.add('keyboard-open');
        // Scroll element into view after keyboard opens
        setTimeout(() => {
            e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
    }
});

document.addEventListener('focusout', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        document.body.classList.remove('keyboard-open');
    }
});

// Swipe gesture for sidebar (swipe right to open)
let touchStartX = 0;
let touchEndX = 0;

document.addEventListener('touchstart', function(e) {
    touchStartX = e.changedTouches[0].screenX;
}, false);

document.addEventListener('touchend', function(e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, false);

function handleSwipe() {
    const sidebar = document.getElementById('mobileSidebar');
    if (!sidebar) return;
    
    // Swipe right to open (from left edge)
    if (touchEndX > touchStartX + 50 && touchStartX < 50) {
        sidebar.classList.add('expanded');
    }
    // Swipe left to close
    if (touchStartX > touchEndX + 50 && sidebar.classList.contains('expanded')) {
        sidebar.classList.remove('expanded');
    }
}

// Vibrations for button clicks (if supported)
function hapticFeedback() {
    if ('vibrate' in navigator) {
        navigator.vibrate(10);
    }
}

// Add haptic feedback to all buttons
document.addEventListener('click', function(e) {
    if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
        hapticFeedback();
    }
});

// Prevent horizontal scroll bounce on iOS
document.body.addEventListener('touchmove', function(e) {
    if (e.target.closest('.category-filters')) {
        const element = e.target.closest('.category-filters');
        const isScrollable = element.scrollWidth > element.clientWidth;
        if (isScrollable) {
            e.stopPropagation();
        }
    }
}, { passive: true });

// Status bar height adjustment for notched iPhones
function adjustForNotch() {
    const safeAreaTop = getComputedStyle(document.documentElement).getPropertyValue('--sat');
    if (safeAreaTop) {
        document.documentElement.style.setProperty('--sat', safeAreaTop);
    }
}

// Call on load
adjustForNotch();

// Export for use in other scripts
window.MobileHelper = {
    hapticFeedback,
    adjustForNotch,
    toggleMobileMenu: function() {
        const sidebar = document.getElementById('mobileSidebar');
        if (sidebar) {
            sidebar.classList.toggle('expanded');
        }
    }
};