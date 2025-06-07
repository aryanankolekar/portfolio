// Theme management
document.addEventListener('DOMContentLoaded', function() {
  const themeToggle = document.querySelector('.theme-toggle');
  const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
  
  // Set initial theme based on system preference or stored preference
  const storedTheme = localStorage.getItem('theme');
  if (storedTheme) {
    document.documentElement.setAttribute('data-theme', storedTheme);
    updateThemeIcon(storedTheme);
  } else if (prefersDarkScheme.matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
    updateThemeIcon('dark');
  }
  
  // Toggle theme when button is clicked
  themeToggle.addEventListener('click', function() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  });
  
  // Update theme icon based on current theme
  function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    if (theme === 'dark') {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
    } else {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    }
  }
  
  // Listen for system theme changes
  prefersDarkScheme.addEventListener('change', function(e) {
    if (!localStorage.getItem('theme')) {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      updateThemeIcon(newTheme);
    }
  });
}); 