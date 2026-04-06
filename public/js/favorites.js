// All establishments data
let establishments = [];
let favorites = [];

// Load establishments from database
async function loadEstablishments() {
    try {
        const response = await fetch('/api/establishments', { cache: 'no-store' });
        const data = await response.json();

        // Map database fields to frontend expected format
        establishments = data.map(est => ({
            id: est._id, // Use MongoDB _id as id
            name: est.name,
            cuisine: est.cuisine,
            location: est.location,
            rating: est.rating,
            reviews: est.reviewCount, // Map reviewCount to reviews
            description: est.description,
            emoji: getEmojiForCuisine(est.cuisine), // Add emoji based on cuisine
        }));

        await syncEstablishmentStatsFromReviews();

        loadCustomEstablishmentData();
        loadFavoritesFromStorage();
        loadFavorites();
    } catch (error) {
        console.error('Error loading establishments:', error);
        showToast('Error loading establishments from database');
    }
}

async function syncEstablishmentStatsFromReviews() {
    const statTasks = establishments.map(async est => {
        try {
            const response = await fetch(`/api/establishments/${est.id}/reviews`, { cache: 'no-store' });
            if (!response.ok) return;

            const reviews = await response.json();
            const reviewCount = Array.isArray(reviews) ? reviews.length : 0;
            const totalRating = (reviews || []).reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
            const averageRating = reviewCount > 0 ? Number((totalRating / reviewCount).toFixed(1)) : 0;

            est.reviews = reviewCount;
            est.rating = averageRating;
        } catch (error) {
            console.error('Error syncing establishment stats for', est.id, error);
        }
    });

    await Promise.all(statTasks);
}

// Helper function to get a cuisine icon/initial for restaurants
function getEmojiForCuisine(cuisine) {
    return '';
}

// Load user's favorite IDs from localStorage
function getFavoritesKey() {
    const username = localStorage.getItem('platePalUsername') || 'guest';
    return `platePalFavorites_${username}`;
}

let userFavoriteIds = [];

// Load custom establishment data from localStorage
function loadCustomEstablishmentData() {
    let customEstablishments = {};
    try {
        customEstablishments = JSON.parse(localStorage.getItem('platePalCustomEstablishments')) || {};
    } catch (e) {
        customEstablishments = {};
    }
    
    // Apply custom data to establishments
    establishments.forEach(est => {
        if (customEstablishments[est.id]) {
            const customData = customEstablishments[est.id];
            est.name = customData.name || est.name;
            est.emoji = customData.emoji || est.emoji;
            est.cuisine = customData.cuisine || est.cuisine;
            est.location = customData.location || est.location;
            est.description = customData.description || est.description;
        }
    });
}

function loadFavoritesFromStorage() {
    try {
        userFavoriteIds = JSON.parse(localStorage.getItem(getFavoritesKey())) || [];
    } catch (e) {
        userFavoriteIds = [];
    }
    
    // Map favorite IDs to full establishment objects
    favorites = establishments.filter(est => userFavoriteIds.includes(est.id));
}

function saveFavorites() {
    // Save only the IDs to localStorage (to match behavior in other pages)
    const favoriteIds = favorites.map(f => f.id);
    localStorage.setItem(getFavoritesKey(), JSON.stringify(favoriteIds));
}

function createFavoriteCard(restaurant) {
    return `
        <div class="card">
            <div class="card-image">${restaurant.emoji || restaurant.name.charAt(0)}</div>
            <div class="card-content">
                <h3 class="card-name">${restaurant.name}</h3>
                <p class="card-info">${restaurant.cuisine} • ${restaurant.location}</p>
                <p class="rating">Rating: ${restaurant.rating}</p>
                <p class="card-info">${restaurant.reviews} Reviews</p>
                <p class="card-description">${restaurant.description || ''}</p>
                <div class="card-actions">
                    <button class="btn btn-details" onclick="viewDetails('${restaurant.id}')">View Details</button>
                    <button class="btn btn-remove" onclick="removeFromFavorites('${restaurant.id}')">Remove</button>
                </div>
            </div>
        </div>
    `;
}

function loadFavorites() {
    const container = document.getElementById("favoritesContainer");
    const noMessage = document.getElementById("noFavoritesMessage");
    const loginRequired = document.getElementById("loginRequiredMessage");

    const isLoggedIn = localStorage.getItem('platePalLoggedIn') === 'true';

    // If user is not logged in, show a login prompt instead of favorites
    if (!isLoggedIn) {
        container.innerHTML = "";
        noMessage.style.display = "none";
        if (loginRequired) loginRequired.style.display = "block";
        return;
    }

    // user is logged in: hide login prompt and show favorites/no-favorites
    if (loginRequired) loginRequired.style.display = "none";

    if (favorites.length === 0) {
        container.innerHTML = "";
        noMessage.style.display = "block";
    } else {
        container.innerHTML = favorites.map(createFavoriteCard).join("");
        noMessage.style.display = "none";
    }
}

function removeFromFavorites(id) {
    favorites = favorites.filter(f => f.id !== id);
    saveFavorites();
    
    // Reload favorites from localStorage to ensure sync
    loadFavoritesFromStorage();
    
    loadFavorites();
    showToast("Removed from favorites!");
}

function viewDetails(id) {
    window.location.href = `establishment-details.html?id=${id}`;
}

function logout() {
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('platePalLoggedIn');
    localStorage.removeItem('platePalUsername');
    showToast('Logged out successfully!');
    setTimeout(() => {
        window.location.href = 'PlatePal_Main.html';
    }, 800);
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

// Load establishments on page load
document.addEventListener('DOMContentLoaded', function() {
    loadEstablishments();
    updateNavbar();

    if (typeof startLiveRefresh === 'function') {
        startLiveRefresh('favorites-page', async function () {
            await loadEstablishments();
        }, 10000);
    }
});
