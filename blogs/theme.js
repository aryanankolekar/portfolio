// Theme toggle functionality
const themeToggle = document.querySelector('.theme-toggle');
const icon = themeToggle.querySelector('i');

// Check for saved theme preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme);
  icon.className = savedTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
}

// Theme toggle click handler
themeToggle.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  icon.className = newTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
});

// Smooth scrolling without hash URLs
document.querySelectorAll('.fixed-toc a').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const targetId = link.getAttribute('href').substring(1);
    const targetElement = document.getElementById(targetId);
    
    if (targetElement) {
      targetElement.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
      
      // Update URL without hash
      const baseUrl = window.location.pathname.split('/').slice(0, -1).join('/');
      const newUrl = `${baseUrl}/${window.location.pathname.split('/').pop()}`;
      window.history.pushState({}, '', newUrl);
    }
  });
}); 