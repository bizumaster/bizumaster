// HEADER
fetch('/components/header.html')
  .then(res => res.text())
  .then(data => {
    const header = document.getElementById('header');
    if (header) {
      header.innerHTML = data;

      // NAVBAR
      fetch('/components/navbar.html')
        .then(res => res.text())
        .then(nav => {
          const navbar = document.getElementById('navbar');
          if (navbar) {
            navbar.innerHTML = nav;

            setActiveMenu(); // ativa menu correto
          }
        });
    }
  });

// FOOTER
fetch('/components/footer.html')
  .then(res => res.text())
  .then(data => {
    const footer = document.getElementById('footer');
    if (footer) footer.innerHTML = data;
  });


// FUNÇÃO ACTIVE
function setActiveMenu() {
  const links = document.querySelectorAll('nav a');
  const currentPage = window.location.pathname.split('/').pop();

  links.forEach(link => {
    const linkPage = link.getAttribute('href');

    if (linkPage === currentPage) {
      link.classList.add('active');

      // ativa dropdown pai
      const parentDropdown = link.closest('.dropdown');
      if (parentDropdown) {
        const mainLink = parentDropdown.querySelector('a');
        if (mainLink) mainLink.classList.add('active');
      }
    }
  });
}


// ===== MENU MOBILE =====
function toggleMenuMobile() {
  const menu = document.getElementById('navMenu');
  if (menu) menu.classList.toggle('active');
}

// ===== DROPDOWN =====
function toggleMenu(event) {
  event.preventDefault();
  event.stopPropagation();
  const dropdown = event.target.closest('.dropdown');
  if (dropdown) dropdown.classList.toggle('active');
}

// Fechar dropdown ao clicar fora
document.addEventListener('click', function(e) {
  if (!e.target.closest('.dropdown')) {
    document.querySelectorAll('.dropdown.active').forEach(d => d.classList.remove('active'));
  }
});
