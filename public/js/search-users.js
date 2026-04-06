// List of users displayed on the page
let allUsers = [];

// Load users from the backend database
async function loadUsers(query = '') {
    const currentUsername = localStorage.getItem('platePalUsername');
    try {
        const params = new URLSearchParams();
        if (query) params.append('q', query);
        if (currentUsername) params.append('currentUser', currentUsername);
        const response = await fetch(`/api/users?${params.toString()}`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Failed to load users');
        }

        const users = await response.json();
        allUsers = users.map((user, index) => ({
            username: user.username,
            description: user.bio || 'No description yet',
            avatar: user.profilePic || `https://i.pravatar.cc/200?img=${index}`,
            reviewCount: user.reviewCount || 0,
            helpfulCount: user.helpfulCount || 0,
            unhelpfulCount: user.unhelpfulCount || 0,
            joinDate: user.joinDate || 'N/A'
        }));

        // Filter out current user
        if (currentUsername) {
            allUsers = allUsers.filter(user => user.username !== currentUsername);
        }

    } catch (e) {
        console.error('Error loading users from server:', e);

        // If we can't load users from the backend, show an empty list (do not show fake users)
        allUsers = [];
    }
}

function getReviewCountForUser(username) {
    let allReviews = [];
    try {
        allReviews = JSON.parse(localStorage.getItem('platepalReviews')) || [];
    } catch (e) {
        allReviews = [];
    }
    return allReviews.filter(review => review.username === username).length;
}

function createUserCard(user) {
    const hasValidAvatar = user.avatar && user.avatar.trim() !== '' && user.avatar.startsWith('data:');
    const avatarDisplay = hasValidAvatar 
        ? `<img src="${user.avatar}" alt="${user.username}">` 
        : `<div class="user-avatar">${user.username.charAt(0).toUpperCase()}</div>`;
    
    const reviewCount = typeof user.reviewCount === 'number' ? user.reviewCount : getReviewCountForUser(user.username);
    const helpfulCount = typeof user.helpfulCount === 'number' ? user.helpfulCount : 0;
    
    return `
        <div class="user-card" onclick="viewUserProfile('${user.username}')">
            ${avatarDisplay}
            <div class="user-name">${user.username}</div>
            <div class="user-bio">${user.description}</div>
            <div class="user-stats">
                <div class="stat">
                    <div class="stat-number">${reviewCount}</div>
                    <div>Reviews</div>
                </div>
                <div class="stat">
                    <div class="stat-number">${helpfulCount}</div>
                    <div>Helpful</div>
                </div>
            </div>
            <button class="view-btn">View Profile</button>
        </div>
    `;
}

function displayUsers(users) {
    const grid = document.getElementById('usersGrid');
    const noMessage = document.getElementById('noUsersMessage');
    
    if (users.length === 0) {
        grid.innerHTML = '';
        noMessage.style.display = 'block';
    } else {
        grid.innerHTML = users.map(createUserCard).join('');
        noMessage.style.display = 'none';
    }
}

async function searchUsers() {
    const query = document.getElementById('searchInput').value.trim();
    await loadUsers(query);
    displayUsers(allUsers);
}

function viewUserProfile(username) {
    window.location.href = `user-profile.html?user=${encodeURIComponent(username)}`;
}

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

// Load and display users on page load
document.addEventListener('DOMContentLoaded', async function() {
    await loadUsers();
    displayUsers(allUsers);
    updateNavbar();

    if (typeof startLiveRefresh === 'function') {
        startLiveRefresh('search-users-page', async function () {
            const activeQuery = document.getElementById('searchInput')?.value.trim() || '';
            await loadUsers(activeQuery);
            displayUsers(allUsers);
        }, 10000);
    }
});

// Listen for changes in localStorage (reviews being added or likes updated)
window.addEventListener('storage', function(e) {
    if (e.key === 'platepalReviews' || e.key === 'platepalRefreshUsers') {
        // Refresh the display when reviews or likes change elsewhere
        loadUsers().then(() => displayUsers(allUsers));
    }
});

// Also listen for the custom event, for same-tab updates
window.addEventListener('platepalRefreshUsers', function() {
    loadUsers().then(() => displayUsers(allUsers));
});

// Refresh users when page comes into focus
window.addEventListener('focus', async function() {
    // Reload and redisplay users to get updated review counts
    await loadUsers();
    displayUsers(allUsers);
});

// Allow Enter key to search
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchUsers();
        }
    });
});
