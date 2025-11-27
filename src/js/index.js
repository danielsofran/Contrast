// Mobile menu functionality
document.addEventListener('DOMContentLoaded', function() {
	const menuToggle = document.querySelector('.mobile-menu-toggle');
	const mainMenu = document.querySelector('#main-menu');

	if (menuToggle && mainMenu) {
		menuToggle.addEventListener('click', function() {
			const isExpanded = this.getAttribute('aria-expanded') === 'true';
			this.setAttribute('aria-expanded', !isExpanded);
			mainMenu.classList.toggle('active');
		});
	}

	// Close menu when clicking on a link
	const navLinks = document.querySelectorAll('.nav-menu a');
	navLinks.forEach(link => {
		link.addEventListener('click', () => {
			if (mainMenu.classList.contains('active')) {
				menuToggle.setAttribute('aria-expanded', 'false');
				mainMenu.classList.remove('active');
			}
		});
	});

	// Smooth scrolling for anchor links
	document.querySelectorAll('a[href^="#"]').forEach(anchor => {
		anchor.addEventListener('click', function (e) {
			e.preventDefault();

			const targetId = this.getAttribute('href');
			if (targetId === '#') return;

			const targetElement = document.querySelector(targetId);
			if (targetElement) {
				window.scrollTo({
					top: targetElement.offsetTop - 80,
					behavior: 'smooth'
				});
			}
		});
	});
});