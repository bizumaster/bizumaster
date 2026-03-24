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

