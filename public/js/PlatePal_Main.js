let restaurants = [];

// Load establishments from database
async function loadEstablishments() {
    try {
        const response = await fetch('/api/establishments');
        const data = await response.json();
        
        // Map database fields to frontend expected format
        restaurants = data.map(est => ({
            id: est._id, // Use MongoDB _id as id
            name: est.name,
            cuisine: est.cuisine,
            location: est.location,
            rating: est.rating,
            reviews: est.reviewCount, // Map reviewCount to reviews
            description: est.description,
            latitude: typeof est.latitude === 'number' ? est.latitude : null,
            longitude: typeof est.longitude === 'number' ? est.longitude : null,
            emoji: getEmojiForCuisine(est.cuisine) // Add emoji based on cuisine
        }));
        
        await loadSections();
    } catch (error) {
        console.error('Error loading establishments:', error);
        showToast('Error loading establishments from database');
    }
}

// Helper function to get a cuisine icon/initial for restaurants
function getEmojiForCuisine(cuisine) {
    return '';
}

function calculateDistanceKm(lat1, lng1, lat2, lng2) {
    const toRad = degree => degree * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c;
}

function getNearbyRestaurants(userLocation) {
    if (!userLocation) return null;

    const validRestaurants = restaurants.filter(r =>
        typeof r.latitude === 'number' && typeof r.longitude === 'number'
    );

    if (validRestaurants.length === 0) {
        return null;
    }

    return validRestaurants
        .map(r => ({
            ...r,
            distanceKm: calculateDistanceKm(
                userLocation.latitude,
                userLocation.longitude,
                r.latitude,
                r.longitude
            )
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 3);
}

function getFallbackNearbyRestaurants() {
    return [...restaurants]
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 3)
        .map(r => ({ ...r, distanceKm: null }));
}

function requestNearbyRestaurants() {
    return new Promise(resolve => {
        if (!navigator.geolocation) {
            resolve({
                nearbyRestaurants: getFallbackNearbyRestaurants(),
                message: 'Geolocation is not supported. Showing popular restaurants instead.'
            });
            return;
        }

        navigator.geolocation.getCurrentPosition(position => {
            const userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };

            const nearbyRestaurants = getNearbyRestaurants(userLocation);
            if (nearbyRestaurants && nearbyRestaurants.length > 0) {
                resolve({
                    nearbyRestaurants,
                    message: 'Showing restaurants closest to your current location.'
                });
            } else {
                resolve({
                    nearbyRestaurants: getFallbackNearbyRestaurants(),
                    message: 'Nearby coordinates are unavailable. Showing popular restaurants instead.'
                });
            }
        }, () => {
            resolve({
                nearbyRestaurants: getFallbackNearbyRestaurants(),
                message: 'Allow location access to see restaurants near you.'
            });
        }, {
            timeout: 10000
        });
    });
}

// Load custom establishment data from localStorage (for any overrides)
function loadCustomEstablishmentData() {
    let customEstablishments = {};
    try {
        customEstablishments = JSON.parse(localStorage.getItem('platePalCustomEstablishments')) || {};
    } catch (e) {
        customEstablishments = {};
    }
    
    // Apply custom data to restaurants
    restaurants.forEach(rest => {
        if (customEstablishments[rest.id]) {
            const customData = customEstablishments[rest.id];
            rest.name = customData.name || rest.name;
            rest.emoji = customData.emoji || rest.emoji;
            rest.cuisine = customData.cuisine || rest.cuisine;
            rest.location = customData.location || rest.location;
            rest.description = customData.description || rest.description;
        }
    });
}

// Load custom data on page load
loadCustomEstablishmentData();

function createCard(restaurant) {
    const distanceText = restaurant.distanceKm ? ` • ${restaurant.distanceKm.toFixed(1)} km away` : '';

    return `
        <div class="card">
            <div class="card-content">
                <h3>${restaurant.name}</h3>
                <p>${restaurant.cuisine} • ${restaurant.location}${distanceText}</p>
                <p class="rating">Rating: ${restaurant.rating}</p>
                <p>${restaurant.reviews} Reviews</p>
                <button onclick="viewDetails('${restaurant.name}')">View Details</button>
            </div>
        </div>
    `;
}

function getRecentlyViewedKey() {
    const username = localStorage.getItem('platePalUsername');
    return username ? `platePalRecentlyViewed_${username}` : 'platePalRecentlyViewed_guest';
}

async function loadSections() {
    loadCustomEstablishmentData(); // Apply any custom overrides
    
    const mostReviewed = [...restaurants]
        .sort((a, b) => b.reviews - a.reviews)
        .slice(0, 3);

    const nearbyData = await requestNearbyRestaurants();

    // Load recently viewed from localStorage (per-user)
    const recentlyViewed = JSON.parse(localStorage.getItem(getRecentlyViewedKey())) || [];
    const recentRestaurants = recentlyViewed
        .map(name => restaurants.find(r => r.name === name))
        .filter(r => r !== undefined)
        .slice(0, 3);
    
    // If no recently viewed, show first 3 as fallback
    const recent = recentRestaurants.length > 0 ? recentRestaurants : restaurants.slice(0,3);

    const nearbyHeading = document.getElementById('nearbyHeading');
    const nearbySubtitle = document.getElementById('nearbySubtitle');
    if (nearbyHeading) nearbyHeading.textContent = 'Near You';
    if (nearbySubtitle) nearbySubtitle.textContent = nearbyData.message;

    document.getElementById('mostReviewed').innerHTML =
        mostReviewed.map(createCard).join('');

    document.getElementById('nearby').innerHTML =
        nearbyData.nearbyRestaurants.map(createCard).join('');

    document.getElementById('recent').innerHTML =
        recent.map(createCard).join('');
}

function filterRestaurants() {
    const keyword = document.getElementById('searchInput').value.toLowerCase();
    const ratingValue = document.getElementById('ratingFilter').value;

    let filtered = restaurants.filter(r =>
        r.name.toLowerCase().includes(keyword)
    );

    if (ratingValue !== 'all') {
        filtered = filtered.filter(r => r.rating >= ratingValue);
    }

    document.getElementById('mostReviewed').innerHTML =
        filtered.map(createCard).join('');
}

function viewDetails(name) {
    // Track recently viewed (per-user)
    const key = getRecentlyViewedKey();
    let recentlyViewed = JSON.parse(localStorage.getItem(key)) || [];
    // Remove if already exists to avoid duplicates
    recentlyViewed = recentlyViewed.filter(r => r !== name);
    // Add to beginning of array
    recentlyViewed.unshift(name);
    // Keep only last 10
    recentlyViewed = recentlyViewed.slice(0, 10);
    localStorage.setItem(key, JSON.stringify(recentlyViewed));
    
    // Find restaurant by name and redirect using _id
    const restaurant = restaurants.find(r => r.name === name);
    if (restaurant) {
        window.location.href = `establishment-details.html?id=${restaurant.id}`;
    }
}

// Load establishments on page load
document.addEventListener('DOMContentLoaded', function() {
    loadEstablishments();
    updateNavbar();
});

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
