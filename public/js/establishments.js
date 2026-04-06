let establishments = [];

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
            image: est.image || '',
            phone: "(02) 123-4567", // Default phone
            address: `${est.location} Area`, // Default address
            hours: "11:00 AM - 10:00 PM" // Default hours
        }));

        await syncEstablishmentStatsFromReviews();

        loadCustomEstablishmentData();
        displayEstablishments();
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

function generateStars(rating) {
    let stars = '';
    for (let i = 0; i < 5; i++) {
        if (i < Math.floor(rating)) {
            stars += '★';
        } else if (i === Math.floor(rating) && rating % 1 !== 0) {
            stars += '<span class="half-star">★</span>';
        } else {
            stars += '☆';
        }
    }
    return stars;
}

function getFavoritesKey() {
    const username = localStorage.getItem('platePalUsername') || 'guest';
    return `platePalFavorites_${username}`;
}

let userFavorites = JSON.parse(localStorage.getItem(getFavoritesKey())) || [];
let userRatings = JSON.parse(localStorage.getItem('platePalRatings')) || {};

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
            est.image = customData.image || est.image;
            est.phone = customData.phone || est.phone;
            est.address = customData.address || est.address;
            est.hours = customData.hours || est.hours;
        }
    });
}

// Load custom data on page load
loadCustomEstablishmentData();

function displayEstablishments(filteredEstablishments = null) {
    const establishmentsToDisplay = filteredEstablishments || establishments;
    const container = document.getElementById('establishmentsContainer');
    const noResults = document.getElementById('noResults');

    if (establishmentsToDisplay.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No establishments found.</p>';
        if (noResults) noResults.style.display = 'block';
        return;
    }

    if (noResults) noResults.style.display = 'none';

    container.innerHTML = establishmentsToDisplay.map(est => `
        <div class="establishment-card" onclick="viewDetails('${est.id}')">
            <div class="establishment-header" style="display:flex; gap:12px; align-items:flex-start;">
                <div class="establishment-image-wrap" style="width:88px; height:88px; overflow:hidden; border-radius:10px; background:#f3f3f3; flex-shrink:0;">
                    ${est.image ? `<img src="${est.image}" alt="${est.name}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:25px;">${est.name.charAt(0)}</div>`}
                </div>
                <div class="establishment-info">
                    <h3>${est.name}</h3>
                    <p class="establishment-meta">${est.cuisine} • ${est.location}</p>
                </div>
            </div>
            <div class="establishment-details">
                <div class="rating">
                    <span class="stars">${generateStars(est.rating)}</span>
                    <span class="rating-text">${est.rating} (${est.reviews} reviews)</span>
                </div>
                <p class="description">${est.description}</p>
                <div class="establishment-actions">
                    <button class="btn-favorite ${userFavorites.includes(est.id) ? 'favorited' : ''}" onclick="toggleFavorite(event, '${est.id}')">
                        ${userFavorites.includes(est.id) ? '♥ Favorited' : '♡ Add to Favorites'}
                    </button>
                    <button class="btn-view-details" onclick="viewDetails('${est.id}')">View Details</button>
                </div>
            </div>
        </div>
    `).join('');
}

function toggleFavorite(event, establishmentId) {
    event.stopPropagation();

    if (!localStorage.getItem('platePalLoggedIn')) {
        showToast('Please login to add favorites');
        return;
    }

    const index = userFavorites.indexOf(establishmentId);
    if (index > -1) {
        userFavorites.splice(index, 1);
    } else {
        userFavorites.push(establishmentId);
    }

    localStorage.setItem(getFavoritesKey(), JSON.stringify(userFavorites));
    displayEstablishments();
}

function viewDetails(establishmentId) {
    window.location.href = `establishment-details.html?id=${establishmentId}`;
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput')?.value.trim().toLowerCase() || '';
    const ratingFilter = document.getElementById('ratingFilter')?.value || 'all';
    const cuisineFilter = document.getElementById('cuisineFilter')?.value || 'all';
    const locationFilter = document.getElementById('locationFilter')?.value || 'all';
    const sortBy = document.getElementById('sortBy')?.value || 'default';

    let filtered = [...establishments];

    // Apply search term filter
    if (searchTerm) {
        filtered = filtered.filter(est => {
            const searchableText = `${est.name} ${est.cuisine} ${est.location} ${est.description}`.toLowerCase();
            return searchableText.includes(searchTerm);
        });
    }

    // Apply rating filter
    if (ratingFilter && ratingFilter !== 'all') {
        const minRating = Number(ratingFilter);
        filtered = filtered.filter(est => Number(est.rating) >= minRating);
    }

    // Apply cuisine filter
    if (cuisineFilter && cuisineFilter !== 'all') {
        filtered = filtered.filter(est => est.cuisine === cuisineFilter);
    }

    // Apply location filter
    if (locationFilter && locationFilter !== 'all') {
        filtered = filtered.filter(est => est.location === locationFilter);
    }

    // Apply sorting
    switch (sortBy) {
        case 'rating':
            filtered.sort((a, b) => b.rating - a.rating);
            break;
        case 'reviews':
            filtered.sort((a, b) => b.reviews - a.reviews);
            break;
        case 'name':
            filtered.sort((a, b) => a.name.localeCompare(b.name));
            break;
        default:
            // Keep original order
            break;
    }

    displayEstablishments(filtered);
}

function clearFilters() {
    document.getElementById('cuisineFilter').value = '';
    document.getElementById('locationFilter').value = '';
    document.getElementById('sortBy').value = 'default';
    displayEstablishments();
}

// Populate filter options
function populateFilters() {
    const cuisineFilter = document.getElementById('cuisineFilter');
    const locationFilter = document.getElementById('locationFilter');

    // Get unique cuisines and locations
    const cuisines = [...new Set(establishments.map(est => est.cuisine))];
    const locations = [...new Set(establishments.map(est => est.location))];

    // Populate cuisine options
    cuisines.forEach(cuisine => {
        const option = document.createElement('option');
        option.value = cuisine;
        option.textContent = cuisine;
        cuisineFilter.appendChild(option);
    });

    // Populate location options
    locations.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = location;
        locationFilter.appendChild(option);
    });
}

function showToast(message) {
    // Create toast element if it doesn't exist
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.style.opacity = '1';

    setTimeout(() => {
        toast.style.opacity = '0';
    }, 3000);
}

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

// Enable Enter key search for the establishments search input
const establishmentsSearchInput = document.getElementById('searchInput');
if (establishmentsSearchInput) {
    establishmentsSearchInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            applyFilters();
        }
    });
}

// Initial load
loadEstablishments();
updateNavbar();

if (typeof startLiveRefresh === 'function') {
    startLiveRefresh('establishments-page', async function () {
        await loadEstablishments();
    }, 10000);
}
