// This file contains JavaScript code for interactivity on the website, such as handling events and dynamic content updates.

document.addEventListener('DOMContentLoaded', function() {
    // Example: Smooth scrolling for anchor links
    const links = document.querySelectorAll('a[href^="#"]');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            targetElement.scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Remove the toggle mobile navigation code
    // const navToggle = document.querySelector('.nav-toggle');
    // const navMenu = document.querySelector('.nav-menu');

    // Ensure the navigation menu is closed by default
    // navMenu.classList.remove('active');

    // navToggle.addEventListener('click', function() {
    //     navMenu.classList.toggle('active');
    //     navToggle.classList.toggle('active');
    // });

    // Background image transition
    const aboutSection = document.querySelector('#about');
    const body = document.body;

    window.addEventListener('scroll', function() {
        const aboutSectionTop = aboutSection.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;

        if (aboutSectionTop <= windowHeight / 2) {
            body.classList.add('background-transition');
        } else {
            body.classList.remove('background-transition');
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // Add any JavaScript animations or interactions here
    console.log('Document loaded');

    fetch('assets/projects.json')
        .then(response => response.json())
        .then(projects => {
            const projectsGrid = document.querySelector('.projects-grid');
            if (!projectsGrid) {
                console.error('Projects grid element not found');
                return;
            }
            projects.forEach(project => {
                const projectItem = document.createElement('div');
                projectItem.classList.add('project-item', 'card');
               // projectItem.style.backgroundImage = `url(${project.image})`;
                projectItem.innerHTML = `
                    <a href="${project.link}" target="_blank">
                        <img src="${project.image}" alt="${project.title}">
                        <div class="card-title">${project.title}</div>
                        <div class="card-content">
                            <div class="card-description">${project.description}</div>
                        </div>
                    </a>
                `;
                projectsGrid.appendChild(projectItem);
            });
        })
        .catch(error => console.error('Error loading projects:', error));
});