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

	// Form validation example
	const contactForm = document.querySelector('.contact-form');
	if (contactForm) {
		contactForm.addEventListener('submit', function(e) {
			e.preventDefault();
			// Add your form validation logic here
			alert('Form submitted successfully!');
		});
	}
});