// Prevent URL preview in status bar
document.addEventListener('mouseover', function(e) {
    if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.getAttribute('role') === 'button') {
        window.status = '';
        return false;
    }
});

// Additional prevention for all interactive elements
document.addEventListener('mouseover', function(e) {
    if (e.target.closest('a') || e.target.closest('button') || e.target.closest('[role="button"]')) {
        window.status = '';
        return false;
    }
});

// Prevent default link behavior
document.querySelectorAll('a').forEach(link => {
    link.addEventListener('mouseover', function(e) {
        e.preventDefault();
        return false;
    });
});