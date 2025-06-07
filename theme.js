// Theme toggle functionality
document.addEventListener('DOMContentLoaded', function() {
    const themeToggle = document.querySelector('.theme-toggle');
    const icon = themeToggle.querySelector('i');
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.documentElement.setAttribute('data-theme', savedTheme);
        icon.className = savedTheme === 'light' ? 'fas fa-circle-half-stroke' : 'fas fa-moon';
    }

    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        icon.className = newTheme === 'light' ? 'fas fa-circle-half-stroke' : 'fas fa-moon';
        localStorage.setItem('theme', newTheme);
    });
}); 