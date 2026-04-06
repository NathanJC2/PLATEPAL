// Update navbar
function updateNavbar() {
    const isLoggedIn = localStorage.getItem('platePalLoggedIn') === 'true';
    const username = localStorage.getItem('platePalUsername');
    const accountType = localStorage.getItem('platePalAccountType');
    const establishmentId = localStorage.getItem('platePalEstablishmentId');

    const navLogin = document.getElementById('navLogin');
    const navRegister = document.getElementById('navRegister');
    const navProfile = document.getElementById('navProfile');
    const navLogout = document.getElementById('navLogout');
    const navMyEstablishment = document.getElementById('navMyEstablishment');

    if (isLoggedIn && username) {
        if (navLogin) navLogin.style.display = 'none';
        if (navRegister) navRegister.style.display = 'none';
        if (navProfile) navProfile.style.display = 'inline';
        if (navLogout) navLogout.style.display = 'inline';

        // Show My Establishment link for owners
        if (navMyEstablishment && accountType === 'owner' && establishmentId) {
            navMyEstablishment.style.display = 'inline';
            navMyEstablishment.href = `establishment-details.html?id=${establishmentId}`;
        } else if (navMyEstablishment) {
            navMyEstablishment.style.display = 'none';
        }
    } else {
        if (navLogin) navLogin.style.display = 'inline';
        if (navRegister) navRegister.style.display = 'inline';
        if (navProfile) navProfile.style.display = 'none';
        if (navLogout) navLogout.style.display = 'none';
        if (navMyEstablishment) navMyEstablishment.style.display = 'none';
    }
}

function logout() {
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('platePalLoggedIn');
    localStorage.removeItem('platePalUsername');
    showToast('Logged out successfully!');
    setTimeout(() => {
        location.reload();
    }, 800);
}

updateNavbar();