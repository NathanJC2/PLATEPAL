// Get restaurant ID from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const restaurantId = (urlParams.get('id') || '').trim();

let restaurant = null;

// Load restaurant data from database
async function loadRestaurant() {
    if (!restaurantId) {
        showToast('No restaurant ID provided');
        return;
    }

    try {
        const response = await fetch(`/api/establishments/${restaurantId}`, { cache: 'no-store' });
        const data = await response.json();

        if (response.ok) {
            // Map database fields to frontend expected format
            restaurant = {
                id: data._id,
                name: data.name,
                cuisine: data.cuisine,
                location: data.location,
                rating: data.rating,
                reviews: data.reviewCount,
                description: data.description,
                emoji: getEmojiForCuisine(data.cuisine),
                image: data.image || '',
                phone: "(02) 123-4567", // Default phone
                address: `${data.location} Area`, // Default address
                hours: "11:00 AM - 10:00 PM" // Default hours
            };

            // Set current restaurant early so review-based stat sync can update
            // header values on the first page load.
            currentRestaurant = restaurant;

            // Load reviews after loading restaurant
            await loadReviews();
            loadRestaurantDetails();
        } else {
            showToast('Restaurant not found');
        }
    } catch (error) {
        console.error('Error loading restaurant:', error);
        showToast('Error loading restaurant from database');
    }
}

// Load reviews from database
async function loadReviews() {
    try {
        const currentUsername = localStorage.getItem('platePalUsername');
        const viewerId = getUserIdentifier();
        const params = new URLSearchParams();
        if (currentUsername) params.append('currentUser', currentUsername);
        if (viewerId) params.append('viewerId', viewerId);
        const response = await fetch(`/api/establishments/${restaurantId}/reviews?${params.toString()}`, { cache: 'no-store' });
        const reviews = await response.json();
        if (response.ok) {
            // Store raw reviews in a global variable for reference
            window.dbReviews = reviews;

            // Keep a local copy of reviews in the format the UI expects so that
            // actions like marking helpful/unhelpful work even when the review
            // data is only coming from the backend.
            allReviews.length = 0;
            reviews.forEach(r => {
                allReviews.push({
                    id: r._id,
                    username: r.user?.username || 'Unknown',
                    userAvatar: r.user?.profilePic || null,
                    title: r.title,
                    body: r.comment,
                    rating: r.rating,
                    timestamp: r.updatedAt || r.createdAt,
                    restaurantId: r.establishment?.toString?.() || restaurantId,
                    helpful: r.helpful || 0,
                    helpfulBy: r.helpfulBy || [],
                    unhelpful: r.unhelpful || 0,
                    unhelpfulBy: r.unhelpfulBy || [],
                    ownerResponse: r.ownerResponse
                });
            });

            syncRestaurantStatsFromReviews(reviews);
        } else {
            console.error('Error loading reviews:', reviews.error);
            window.dbReviews = [];
            allReviews.length = 0;
            syncRestaurantStatsFromReviews([]);
        }
    } catch (error) {
        console.error('Error loading reviews:', error);
        window.dbReviews = [];
        allReviews.length = 0;
        syncRestaurantStatsFromReviews([]);
    }
}

function syncRestaurantStatsFromReviews(reviews) {
    if (!currentRestaurant) return;

    const reviewCount = Array.isArray(reviews) ? reviews.length : 0;
    const totalRating = (reviews || []).reduce((sum, review) => sum + (Number(review.rating) || 0), 0);
    const averageRating = reviewCount > 0 ? Number((totalRating / reviewCount).toFixed(1)) : 0;

    currentRestaurant.reviews = reviewCount;
    currentRestaurant.rating = averageRating;
    if (restaurant) {
        restaurant.reviews = reviewCount;
        restaurant.rating = averageRating;
    }
    renderRestaurantHeader();
}

function loadRestaurantDetails() {
    currentRestaurant = restaurant;
    trackRecentlyViewed();
    // Now the rest of the code can use currentRestaurant
    renderRestaurantHeader();
    renderCreateReviewForm();
    renderReviews();
}

// Helper function to get a cuisine icon/initial for restaurants
function getEmojiForCuisine(cuisine) {
    return '';
}


// Mock reviews data
const allReviews = [];

// Returns a stable identifier for the current viewer (logged-in user or guest)
function getUserIdentifier() {
    const isUserLoggedInNow = localStorage.getItem('platePalLoggedIn') === 'true';
    const storedUsername = localStorage.getItem('platePalUsername');
    if (isUserLoggedInNow && storedUsername) return storedUsername;

    let guestId = localStorage.getItem('platePalGuestId');
    if (!guestId) {
        guestId = 'guest_' + Date.now();
        localStorage.setItem('platePalGuestId', guestId);
    }

    return guestId;
}

let currentRestaurant = null;
let visibleReviews = 2;
function getFavoritesKey() {
    const username = localStorage.getItem('platePalUsername') || 'guest';
    return `platePalFavorites_${username}`;
}

let userFavorites = JSON.parse(localStorage.getItem(getFavoritesKey())) || [];
let hiddenReviewIds = JSON.parse(localStorage.getItem('platepalHiddenReviewIds')) || [];
let showHiddenReviewsMode = false;
let isUserLoggedIn = localStorage.getItem('platePalLoggedIn') === 'true';
let currentUsername = localStorage.getItem('platePalUsername') || '';
let currentAccountType = localStorage.getItem('platePalAccountType') || 'user';
let currentEstablishmentId = (localStorage.getItem('platePalEstablishmentId') || '').trim();
let ownerEstablishmentId = currentEstablishmentId;

async function refreshOwnerInfo() {
    const username = localStorage.getItem('platePalUsername');
    if (!username) return;

    try {
        const response = await fetch(`/api/users/username/${encodeURIComponent(username)}`, { cache: 'no-store' });
        if (!response.ok) return;
        const user = await response.json();
        if (user.accountType === 'owner' && user.establishmentId) {
            ownerEstablishmentId = user.establishmentId;
            localStorage.setItem('platePalEstablishmentId', ownerEstablishmentId);
        }
    } catch (e) {
        // Ignore network errors
    }
}

function getRecentlyViewedKey() {
    const username = localStorage.getItem('platePalUsername');
    return username ? `platePalRecentlyViewed_${username}` : 'platePalRecentlyViewed_guest';
}

// Track this restaurant as recently viewed
function trackRecentlyViewed() {
    if (currentRestaurant) {
        const key = getRecentlyViewedKey();
        let recentlyViewed = JSON.parse(localStorage.getItem(key)) || [];
        recentlyViewed = recentlyViewed.filter(name => name !== currentRestaurant.name);
        recentlyViewed.unshift(currentRestaurant.name);
        recentlyViewed = recentlyViewed.slice(0, 10);
        localStorage.setItem(key, JSON.stringify(recentlyViewed));
    }
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

function renderRestaurantHeader() {
    const isFavorite = userFavorites.includes(currentRestaurant.id);
    const headerHTML = `
        <div class="restaurant-banner">
            ${currentRestaurant.image ? `<img src="${currentRestaurant.image}" alt="${currentRestaurant.name}">` : `<div class="emoji">${currentRestaurant.name.charAt(0)}</div>`}
        </div>
        <div class="restaurant-info">
            <h1>${currentRestaurant.name}</h1>
            <p class="restaurant-meta">${currentRestaurant.cuisine} • ${currentRestaurant.location}</p>
            <div class="rating-section">
                <span class="stars">${generateStars(Math.floor(currentRestaurant.rating))}</span>
                <span class="rating-text">${currentRestaurant.rating} (${currentRestaurant.reviews} reviews)</span>
            </div>

            <div class="contact-info">
                <p><strong>Address:</strong> ${currentRestaurant.address}</p>
                <p><strong>Phone:</strong> ${currentRestaurant.phone}</p>
                <p><strong>Hours:</strong> ${currentRestaurant.hours}</p>
            </div>

            <p style="color: #666; margin-bottom: 15px;">${currentRestaurant.description}</p>

            <div class="action-buttons">
                <button class="btn btn-favorite ${isFavorite ? 'added' : ''}" onclick="toggleFavorite()">
                    ${isFavorite ? '♥ Favorited' : '♡ Add to Favorites'}
                </button>
                ${currentAccountType === 'owner' && currentEstablishmentId === restaurantId ? `
                    <button class="btn btn-primary" onclick="openEditEstablishmentModal()" style="margin-left: 10px;">
                        ✏️ Edit Establishment
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    document.getElementById('restaurantHeader').innerHTML = headerHTML;
}

function renderCreateReviewForm() {
    // Rating form (visible to everyone)
    const ratingFormHTML = `
        <div class="create-review" style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
            <h3>Rate this Restaurant</h3>
            <div class="form-group">
                <label>Rating:</label>
                <div class="star-rating-input" id="ratingStars">
                    ${[1, 2, 3, 4, 5].map(star => 
                        `<span class="star-input" onclick="setFormRating(${star})" data-value="${star}">★</span>`
                    ).join('')}
                </div>
            </div>
        </div>
    `;

    // Full review form (only for logged-in regular users)
    let reviewFormHTML = '';

    // If owner of this establishment, they should not create a review here
    const accountType = localStorage.getItem('platePalAccountType');
    const ownerEstablishmentId = localStorage.getItem('platePalEstablishmentId');
    const isOwnerOfThis = accountType === 'owner' && ownerEstablishmentId === restaurantId;

    if (!isUserLoggedIn) {
        reviewFormHTML = `
            <div class="login-prompt-form">
                <p>Please <a href="login.html" style="color: #856404; text-decoration: underline;">login</a> to write a review</p>
            </div>
        `;
    } else if (isOwnerOfThis) {
        reviewFormHTML = `
            <div class="create-review" style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                <h3>Owner Response</h3>
                <p>You can respond to customer reviews below, but you cannot post a review for your own establishment.</p>
            </div>
        `;
    } else {
        reviewFormHTML = `
            <div class="create-review" style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
                <h3>Write a Review</h3>
                
                <div class="form-group">
                    <label for="reviewTitle">Review Title: <span style="color: red;">*</span></label>
                    <input type="text" id="reviewTitle" placeholder="Summarize your experience...">
                </div>

                <div class="form-group">
                    <label for="reviewBody">Review: <span style="color: red;">*</span></label>
                    <textarea id="reviewBody" placeholder="Share your experience in detail..."></textarea>
                </div>

                <div class="form-group">
                    <label for="reviewImage">Image:</label>
                    <input type="file" id="reviewImage" accept="image/*">
                    <div id="imagePreview" style="margin-top: 10px;"></div>
                </div>

                <div class="form-group">
                    <label for="reviewVideo">Video:</label>
                    <input type="file" id="reviewVideo" accept="video/*">
                    <div id="videoPreview" style="margin-top: 10px;"></div>
                </div>

                <div class="form-actions">
                    <button class="btn btn-primary" onclick="submitReview()">Post Review</button>
                    <button class="btn btn-secondary" onclick="clearReviewForm()">Clear</button>
                </div>
            </div>
        `;
    }

    document.getElementById('createReviewForm').innerHTML = ratingFormHTML + reviewFormHTML;
    
    if (isUserLoggedIn && !isOwnerOfThis) {
        setupFilePreviewHandlers();
    }
}

let formRating = 0;

function setupFilePreviewHandlers() {
    const imageInput = document.getElementById('reviewImage');
    const videoInput = document.getElementById('reviewVideo');

    if (imageInput) {
        imageInput.addEventListener('change', function() {
            const file = this.files[0];
            const preview = document.getElementById('imagePreview');
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.innerHTML = `<img src="${e.target.result}" alt="Image preview" style="max-width: 100%; max-height: 150px; border-radius: 4px;">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (videoInput) {
        videoInput.addEventListener('change', function() {
            const file = this.files[0];
            const preview = document.getElementById('videoPreview');
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.innerHTML = `<video controls style="max-width: 100%; max-height: 150px; border-radius: 4px;"><source src="${e.target.result}"></video>`;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function setFormRating(rating) {
    // If clicking the same star, toggle between full and half
    if (formRating === rating) {
        // If it's a full star, make it half
        formRating = rating - 0.5;
    } else if (formRating === rating - 0.5) {
        // If it's already half, clear it
        formRating = 0;
    } else {
        // Otherwise, set it to full star
        formRating = rating;
    }
    
    updateRatingDisplay('ratingStars', formRating);
    
    // Save guest rating to localStorage
    let guestRatings = {};
    try {
        guestRatings = JSON.parse(localStorage.getItem('platepalGuestRatings')) || {};
    } catch (e) {
        guestRatings = {};
    }
    
    if (formRating === 0) {
        delete guestRatings[restaurantId];
    } else {
        guestRatings[restaurantId] = formRating;
    }
    
    localStorage.setItem('platepalGuestRatings', JSON.stringify(guestRatings));
}

function updateRatingDisplay(containerId, rating) {
    const stars = document.querySelectorAll(`#${containerId} .star-input`);
    stars.forEach((star, index) => {
        const starValue = index + 1;
        star.classList.remove('active', 'half-active');
        
        if (starValue <= rating) {
            star.classList.add('active');
        } else if (starValue - 0.5 === rating) {
            star.classList.add('half-active');
        }
    });
}

function submitReview() {
    if (!isUserLoggedIn) {
        showDialog({
            title: 'Login Required',
            message: 'Please login to post a review.'
        });
        return;
    }

    const title = document.getElementById('reviewTitle').value;
    const body = document.getElementById('reviewBody').value;

    if (!title || !body || formRating === 0) {
        showDialog({
            title: 'Required Fields',
            message: 'Please fill in all required fields (title, review, and rating).'
        });
        return;
    }

    const imageInput = document.getElementById('reviewImage');
    const videoInput = document.getElementById('reviewVideo');
    const image = imageInput ? imageInput.files[0] : null;
    const video = videoInput ? videoInput.files[0] : null;

    let imageData = null;
    let videoData = null;
    let filesProcessed = 0;
    let filesToProcess = (image ? 1 : 0) + (video ? 1 : 0);

    if (filesToProcess === 0) {
        saveReview(null, null);
    } else {
        if (image) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imageData = e.target.result;
                filesProcessed++;
                if (filesProcessed === filesToProcess) {
                    saveReview(imageData, videoData);
                }
            };
            reader.readAsDataURL(image);
        }

        if (video) {
            const reader = new FileReader();
            reader.onload = function(e) {
                videoData = e.target.result;
                filesProcessed++;
                if (filesProcessed === filesToProcess) {
                    saveReview(imageData, videoData);
                }
            };
            reader.readAsDataURL(video);
        }
    }
}

function saveReview(imageData, videoData) {
    const title = document.getElementById('reviewTitle').value;
    const body = document.getElementById('reviewBody').value;

    // First get user ID from username
    fetch(`/api/users/username/${currentUsername}`)
    .then(response => response.json())
    .then(user => {
        if (!user._id) {
            showDialog({
                title: 'User Not Found',
                message: 'User not found.',
                tone: 'danger'
            });
            return;
        }

        // Send review to server
        return fetch('/api/reviews', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: user._id,
                establishmentId: restaurantId,
                title: title,
                comment: body,
                rating: formRating
            })
        });
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('Review posted successfully!');
            clearReviewForm();
            // Reload reviews from database
            loadReviews().then(() => {
                renderReviews();
            });
        } else {
            showDialog({
                title: 'Post Failed',
                message: 'Error posting review: ' + (data.error || 'Unknown error'),
                tone: 'danger'
            });
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showDialog({
            title: 'Post Failed',
            message: 'Error posting review.',
            tone: 'danger'
        });
    });
}

function clearReviewForm() {
    if (isUserLoggedIn) {
        const titleInput = document.getElementById('reviewTitle');
        const bodyInput = document.getElementById('reviewBody');
        if (titleInput) titleInput.value = '';
        if (bodyInput) bodyInput.value = '';
    }
    
    formRating = 0;
    const imagePreview = document.getElementById('imagePreview');
    const videoPreview = document.getElementById('videoPreview');
    const imageInput = document.getElementById('reviewImage');
    const videoInput = document.getElementById('reviewVideo');
    
    if (imagePreview) imagePreview.innerHTML = '';
    if (videoPreview) videoPreview.innerHTML = '';
    if (imageInput) imageInput.value = '';
    if (videoInput) videoInput.value = '';
    
    document.querySelectorAll('.star-rating-input .star-input').forEach(star => star.classList.remove('active'));
    updateRatingDisplay('ratingStars', 0);
}

function renderReviews() {
    // Get reviews from database
    let dbReviews = window.dbReviews || [];

    // Get reviews from localStorage (for any unsaved changes)
    let storedReviews = [];
    try {
        storedReviews = JSON.parse(localStorage.getItem('platepalReviews')) || [];
    } catch (e) {
        storedReviews = [];
    }

    // Combine database reviews with stored user reviews.
    // Database reviews should override local storage values (so likes/dislikes stay correct).
    const combinedMap = new Map();
    dbReviews.forEach(r => combinedMap.set(r._id, {
        id: r._id,
        username: (r.user && r.user.username) || 'Unknown',
        userAvatar: r.user?.profilePic || null,
        title: r.title || '',
        body: r.comment || '',
        rating: r.rating || 0,
        timestamp: r.updatedAt || r.createdAt,
        restaurantId: r.establishment?.toString?.() || restaurantId,
        helpful: r.helpful || 0,
        helpfulBy: r.helpfulBy || [],
        unhelpful: r.unhelpful || 0,
        unhelpfulBy: r.unhelpfulBy || [],
        ownerResponse: r.ownerResponse
    }));

    // Only add stored reviews if they are not present in the DB (e.g. offline/unsynced)
    storedReviews.forEach(r => {
        if (!combinedMap.has(r.id)) {
            combinedMap.set(r.id, r);
        }
    });

    let combinedReviews = Array.from(combinedMap.values()).map(r => ({
        ...r,
        helpful: r.helpful || 0,
        helpfulBy: r.helpfulBy || [],
        unhelpful: r.unhelpful || 0,
        unhelpfulBy: r.unhelpfulBy || [],
        ownerResponse: r.ownerResponse
    }));

    // Refresh owner info from localStorage (ensures owner can respond immediately after login)
    ownerEstablishmentId = localStorage.getItem('platePalEstablishmentId') || ownerEstablishmentId;
    currentAccountType = localStorage.getItem('platePalAccountType') || currentAccountType;

    // Apply filter (search) if any
    const filter = (window._reviewFilter || '').trim().toLowerCase();
    if (filter) {
        combinedReviews = combinedReviews.filter(r => {
            return (
                (r.title && r.title.toLowerCase().includes(filter)) ||
                (r.body && r.body.toLowerCase().includes(filter)) ||
                (r.username && r.username.toLowerCase().includes(filter))
            );
        });
    }

    // Filter for this restaurant and sort by helpfulness (descending), then by date (descending)
    let restaurantReviews = combinedReviews
        .filter(r => r.restaurantId === restaurantId);

    if (!showHiddenReviewsMode) {
        restaurantReviews = restaurantReviews.filter(r => !hiddenReviewIds.includes(r.id));
    }

    restaurantReviews = restaurantReviews.sort((a, b) => {
        if ((b.helpful || 0) !== (a.helpful || 0)) return (b.helpful || 0) - (a.helpful || 0);
        return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Ensure current user's reviews appear first so they see their own posts immediately
    if (currentUsername) {
        const userReviews = restaurantReviews.filter(r => r.username === currentUsername);
        const otherReviews = restaurantReviews.filter(r => r.username !== currentUsername);
        restaurantReviews = [...userReviews, ...otherReviews];
    }

    // If a filter is active, show all matching results (don't limit to visibleReviews)
    const activeFilter = (window._reviewFilter || '').trim();
    if (!activeFilter) {
        restaurantReviews = restaurantReviews.slice(0, visibleReviews);
    }
    
    if (restaurantReviews.length === 0) {
        document.getElementById('reviewsContainer').innerHTML = '<p style="color: #999; text-align: center; padding: 20px;">No reviews yet. Be the first to review this restaurant!</p>';
        document.getElementById('showMoreContainer').style.display = 'none';
        return;
    }

    const reviewsHTML = restaurantReviews.map(review => {
        const isOwn = review.username === currentUsername;
        const canModerateReview = isUserLoggedIn && !!currentUsername;
        const ratingStars = generateStars(review.rating);
        const modifiedDate = new Date(review.timestamp).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const userIdentifier = getUserIdentifier();
        const isHelpful = review.helpfulBy && review.helpfulBy.includes(userIdentifier);
        const isUnhelpful = review.unhelpfulBy && review.unhelpfulBy.includes(userIdentifier);
        
        return `
        <div class="review-card">
            <div class="review-header">
                <div class="user-avatar">
                    ${review.userAvatar && review.userAvatar.startsWith('data:') ? `<img src="${review.userAvatar}" alt="${review.username}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">` : review.username.charAt(0).toUpperCase()}
                </div>
                <div class="review-user-info">
                    <a href="user-profile.html?user=${review.username}" class="review-username">${review.username}</a>
                    ${isOwn ? '<span style="background: #8B0000; color: white; padding: 2px 8px; border-radius: 3px; font-size: 11px; margin-left: 8px;">Your Review</span>' : ''}
                    <div class="review-meta">Last modified: ${modifiedDate}</div>
                </div>
            </div>

            <div class="review-rating">
                ${[1, 2, 3, 4, 5].map((star, index) => {
                    if (index < Math.floor(review.rating)) {
                        return `<span class="star-input active" style="cursor: default;">★</span>`;
                    } else if (index === Math.floor(review.rating) && review.rating % 1 !== 0) {
                        return `<span class="star-input half-active" style="cursor: default;">★</span>`;
                    } else {
                        return `<span class="star-input" style="cursor: default;">★</span>`;
                    }
                }).join('')}
            </div>
            
            <div class="review-title">${review.title}</div>
            
            <div class="review-body" id="review-body-${review.id}" ${countWords(review.body) > 50 ? `style="max-height: 100px; overflow: hidden;"` : ''}>
                ${review.body}
            </div>
            
            ${countWords(review.body) > 50 ? `
                <button class="read-more" id="btn-${review.id}" onclick="toggleReviewBody('${review.id}')" style="color: #8B0000; cursor: pointer; font-weight: bold; font-size: 13px; margin-bottom: 12px; display: inline-block;">Show More</button>
            ` : ''}
            
            ${review.image || review.video ? `
                <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 15px;">
                    ${review.image ? `<img src="${review.image}" alt="Review image" style="max-width: 100%; max-height: 300px; border-radius: 4px;">` : ''}
                    ${review.video ? `<video controls style="max-width: 100%; max-height: 300px; border-radius: 4px;"><source src="${review.video}"></video>` : ''}
                </div>
            ` : ''}

            <div class="review-actions">
                <div class="action-group">
                    <span style="color: #666; font-size: 13px; margin-right: 5px;">Was this review helpful?</span>
                    <button class="helpful-btn ${isHelpful ? 'active' : ''}" onclick="markHelpful('${review.id}')" aria-label="Mark review helpful">👍</button>
                    <span style="color: #666; font-size: 13px; margin-right: 10px;">${review.helpful || 0}</span>
                    <button class="helpful-btn unhelpful-btn ${isUnhelpful ? 'active' : ''}" onclick="markUnhelpful('${review.id}')" aria-label="Mark review unhelpful">👎</button>
                    <span style="color: #666; font-size: 13px;">${review.unhelpful || 0}</span>
                </div>
                ${!isOwn && canModerateReview ? `
                <div class="action-group" style="margin-top: 10px; gap: 10px; display: flex; flex-wrap: wrap;">
                    <button class="btn btn-secondary btn-small" onclick="reportReview('${review.id}')">Report Review</button>
                    ${showHiddenReviewsMode ? `<button class="btn btn-secondary btn-small" onclick="unhideReview('${review.id}')">Unhide Review</button>` : `<button class="btn btn-secondary btn-small" onclick="hideReview('${review.id}')">Hide Review</button>`}
                </div>
                ` : ''}
                ${!isOwn && !canModerateReview ? `
                <div class="action-group" style="margin-top: 10px;">
                    <span style="color: #666; font-size: 12px;">Login to report or hide reviews.</span>
                </div>
                ` : ''}
            </div>

            ${review.ownerResponse ? `
                <div class="owner-response">
                    <div class="owner-response-header">📝 Response from ${currentRestaurant.name}</div>
                    <div class="owner-response-text">${review.ownerResponse.text}</div>
                    <div class="response-date">${new Date(review.ownerResponse.timestamp).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                    ${(() => {
                        const accountType = localStorage.getItem('platePalAccountType');
                        const ownerEstablishmentId = localStorage.getItem('platePalEstablishmentId');
                        const isOwner = accountType === 'owner' && ownerEstablishmentId === restaurantId;
                        return isOwner ? `
                            <div class="owner-response-actions" style="margin-top: 10px; display: flex; gap: 10px;">
                                <button class="btn btn-secondary btn-small" onclick="editOwnerResponse('${review.id}', '${review.ownerResponse.text.replace(/'/g, "\\'")}')">Edit</button>
                                <button class="btn btn-secondary btn-small" onclick="deleteOwnerResponse('${review.id}')">Delete</button>
                            </div>
                        ` : '';
                    })()}
                </div>
            ` : ''}

            ${isOwn ? `
                <div class="review-edit-delete" style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn btn-secondary btn-small" onclick="editReview('${review.id}')">Edit</button>
                    <button class="btn btn-secondary btn-small" onclick="deleteReview('${review.id}')">Delete</button>
                </div>
            ` : ''}

            ${(() => {
                const accountType = localStorage.getItem('platePalAccountType');
                const ownerEstablishmentId = localStorage.getItem('platePalEstablishmentId');
                const isOwner = accountType === 'owner' && ownerEstablishmentId === restaurantId;
                return isOwner && !review.ownerResponse && !isOwn ? `
                    <div style="margin-top: 15px;">
                        <button class="btn btn-primary btn-small" onclick="openOwnerResponseModal('${review.id}')">Respond to Review</button>
                    </div>
                ` : '';
            })()}
        </div>
        `;
    }).join('');

    document.getElementById('reviewsContainer').innerHTML = reviewsHTML;

    // Show/hide "Show More" button (only when no filter is active)
    const totalReviews = combinedReviews.filter(r => r.restaurantId === restaurantId).length;
    if (activeFilter) {
        document.getElementById('showMoreContainer').style.display = 'none';
    } else {
        document.getElementById('showMoreContainer').style.display = visibleReviews < totalReviews ? 'block' : 'none';
    }

    // Update filter info display
    const filterInfoEl = document.getElementById('reviewFilterInfo');
    if (filterInfoEl) {
            if (activeFilter) {
            filterInfoEl.style.display = 'block';
            filterInfoEl.innerHTML = `${restaurantReviews.length} result${restaurantReviews.length !== 1 ? 's' : ''} for <strong>${escapeHtml(activeFilter)}</strong> — <a href=\"#\" onclick=\"clearReviewFilter();return false;\">Clear</a>`;
        } else {
            filterInfoEl.style.display = 'none';
            filterInfoEl.innerHTML = '';
        }
    }
}

function editReview(reviewId) {
    // Get the review from database reviews first, then localStorage
    let review = null;
    
    // Check database reviews
    if (window.dbReviews) {
        review = window.dbReviews.find(r => r._id === reviewId);
    }
    
    // If not found in database, check localStorage
    if (!review) {
        let allReviews = [];
        try {
            allReviews = JSON.parse(localStorage.getItem('platepalReviews')) || [];
        } catch (e) {
            allReviews = [];
        }
        review = allReviews.find(r => r.id === reviewId);
    }
    
    if (!review) {
        showDialog({
            title: 'Review Not Found',
            message: 'Review not found.',
            tone: 'danger'
        });
        return;
    }

    const reviewTitle = review.title || '';
    const reviewBody = review.comment || review.body || '';

    // Create edit form
    const editForm = `
        <form id="editReviewForm" onsubmit="submitEditReview(event, '${reviewId}')">
            <div class="form-group">
                <label>Rating:</label>
                <div class="star-rating-input" id="editRatingStars">
                    ${[1, 2, 3, 4, 5].map(star => 
                        `<span class="star-input" onclick="setEditFormRating(${star})" data-value="${star}">★</span>`
                    ).join('')}
                </div>
            </div>
            
            <div class="form-group">
                <label for="editReviewTitle">Review Title: <span style="color: red;">*</span></label>
                <input type="text" id="editReviewTitle" value="${reviewTitle}" placeholder="Summarize your experience...">
            </div>

            <div class="form-group">
                <label for="editReviewBody">Review: <span style="color: red;">*</span></label>
                <textarea id="editReviewBody" placeholder="Share your experience in detail...">${reviewBody}</textarea>
            </div>

            <div class="form-group">
                <label for="editReviewImage">Image:</label>
                <input type="file" id="editReviewImage" accept="image/*">
                <div id="editImagePreview" style="margin-top: 10px;">
                    ${review.image ? `<img src="${review.image}" alt="Current image" style="max-width: 100%; max-height: 100px; border-radius: 4px;"><br><small style="color: #999;">Current image shown above</small>` : ''}
                </div>
            </div>

            <div class="form-group">
                <label for="editReviewVideo">Video:</label>
                <input type="file" id="editReviewVideo" accept="video/*">
                <div id="editVideoPreview" style="margin-top: 10px;">
                    ${review.video ? `<video controls style="max-width: 100%; max-height: 100px; border-radius: 4px;"><source src="${review.video}"></video><br><small style="color: #999;">Current video shown above</small>` : ''}
                </div>
            </div>

            <div class="form-actions">
                <button type="submit" class="btn btn-primary">Save Changes</button>
                <button type="button" class="btn btn-secondary" onclick="closeEditModal()">Cancel</button>
            </div>
        </form>
    `;

    document.getElementById('editFormContainer').innerHTML = editForm;
    
    // Set the initial rating
    editFormRating = review.rating;
    updateEditStars();
    
    // Open modal
    document.getElementById('editReviewModal').style.display = 'block';
    
    // Setup file preview handlers
    setupEditFilePreviewHandlers();
}

let editFormRating = 0;

function setEditFormRating(rating) {
    // If clicking the same star, toggle between full and half
    if (editFormRating === rating) {
        // If it's a full star, make it half
        editFormRating = rating - 0.5;
    } else if (editFormRating === rating - 0.5) {
        // If it's already half, clear it
        editFormRating = 0;
    } else {
        // Otherwise, set it to full star
        editFormRating = rating;
    }
    
    updateRatingDisplay('editRatingStars', editFormRating);
}

function updateEditStars() {
    updateRatingDisplay('editRatingStars', editFormRating);
}

function closeEditModal() {
    document.getElementById('editReviewModal').style.display = 'none';
}

function setupEditFilePreviewHandlers() {
    const imageInput = document.getElementById('editReviewImage');
    const videoInput = document.getElementById('editReviewVideo');

    if (imageInput) {
        imageInput.addEventListener('change', function() {
            const file = this.files[0];
            const preview = document.getElementById('editImagePreview');
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.innerHTML = `<img src="${e.target.result}" alt="Image preview" style="max-width: 100%; max-height: 150px; border-radius: 4px;">`;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    if (videoInput) {
        videoInput.addEventListener('change', function() {
            const file = this.files[0];
            const preview = document.getElementById('editVideoPreview');
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.innerHTML = `<video controls style="max-width: 100%; max-height: 150px; border-radius: 4px;"><source src="${e.target.result}"></video>`;
                };
                reader.readAsDataURL(file);
            }
        });
    }
}

function submitEditReview(event, reviewId) {
    event.preventDefault();

    const title = document.getElementById('editReviewTitle').value;
    const body = document.getElementById('editReviewBody').value;

    if (!title || !body || editFormRating === 0) {
        showDialog({
            title: 'Required Fields',
            message: 'Please fill in all required fields (title, review, and rating).'
        });
        return;
    }

    // Check if this is a database review or localStorage review
    let isDatabaseReview = false;
    if (window.dbReviews) {
        isDatabaseReview = window.dbReviews.some(r => r._id === reviewId);
    }

    if (isDatabaseReview) {
        // Update database review
        fetch(`/api/reviews/${reviewId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                comment: body,
                rating: editFormRating
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Review updated successfully!');
                closeEditModal();
                // Reload reviews from database
                loadReviews().then(() => {
                    renderReviews();
                });
            } else {
                showDialog({
                    title: 'Update Failed',
                    message: 'Error updating review: ' + (data.error || 'Unknown error'),
                    tone: 'danger'
                });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showDialog({
                title: 'Update Failed',
                message: 'Error updating review.',
                tone: 'danger'
            });
        });
    } else {
        // Handle localStorage review (existing logic)
        const imageInput = document.getElementById('editReviewImage');
        const videoInput = document.getElementById('editReviewVideo');
        const image = imageInput ? imageInput.files[0] : null;
        const video = videoInput ? videoInput.files[0] : null;

        let allReviews = [];
        try {
            allReviews = JSON.parse(localStorage.getItem('platepalReviews')) || [];
        } catch (e) {
            allReviews = [];
        }

        const reviewIndex = allReviews.findIndex(r => r.id === reviewId);
        if (reviewIndex === -1) {
            showDialog({
                title: 'Review Not Found',
                message: 'Review not found.',
                tone: 'danger'
            });
            return;
        }

        const currentReview = allReviews[reviewIndex];
        let imageData = currentReview.image;
        let videoData = currentReview.video;
        let filesProcessed = 0;
        let filesToProcess = (image ? 1 : 0) + (video ? 1 : 0);

        if (filesToProcess === 0) {
            updateReviewInStorage(reviewId, title, body, editFormRating, imageData, videoData);
        } else {
            if (image) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    imageData = e.target.result;
                    filesProcessed++;
                    if (filesProcessed === filesToProcess) {
                        updateReviewInStorage(reviewId, title, body, editFormRating, imageData, videoData);
                    }
                };
                reader.readAsDataURL(image);
            }

            if (video) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    videoData = e.target.result;
                    filesProcessed++;
                    if (filesProcessed === filesToProcess) {
                        updateReviewInStorage(reviewId, title, body, editFormRating, imageData, videoData);
                    }
                };
                reader.readAsDataURL(video);
            }
        }
    }
}

function updateReviewInStorage(reviewId, title, body, rating, imageData, videoData) {
    let allReviews = [];
    try {
        allReviews = JSON.parse(localStorage.getItem('platepalReviews')) || [];
    } catch (e) {
        allReviews = [];
    }

    const reviewIndex = allReviews.findIndex(r => r.id === reviewId);
    if (reviewIndex > -1) {
        allReviews[reviewIndex].title = title;
        allReviews[reviewIndex].body = body;
        allReviews[reviewIndex].rating = rating;
        allReviews[reviewIndex].image = imageData;
        allReviews[reviewIndex].video = videoData;
        allReviews[reviewIndex].timestamp = new Date().toISOString();
        
        localStorage.setItem('platepalReviews', JSON.stringify(allReviews));
        
        showToast('Review updated successfully!');
        closeEditModal();
        renderReviews();
    }
}

async function deleteReview(reviewId) {
    const approved = await showConfirmDialog({
        title: 'Delete Review',
        message: 'Are you sure you want to delete this review?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        tone: 'danger'
    });
    if (!approved) {
        return;
    }

    // Check if this is a database review or localStorage review
    let isDatabaseReview = false;
    if (window.dbReviews) {
        isDatabaseReview = window.dbReviews.some(r => r._id === reviewId);
    }

    if (isDatabaseReview) {
        // Delete database review
        fetch(`/api/reviews/${reviewId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Review deleted successfully!');
                // Reload reviews from database
                loadReviews().then(() => {
                    renderReviews();
                });
            } else {
                showDialog({
                    title: 'Delete Failed',
                    message: 'Error deleting review: ' + (data.error || 'Unknown error'),
                    tone: 'danger'
                });
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showDialog({
                title: 'Delete Failed',
                message: 'Error deleting review.',
                tone: 'danger'
            });
        });
    } else {
        // Handle localStorage review
        let allReviews = [];
        try {
            allReviews = JSON.parse(localStorage.getItem('platepalReviews')) || [];
        } catch (e) {
            allReviews = [];
        }

        const reviewIndex = allReviews.findIndex(r => r.id === reviewId);
        if (reviewIndex > -1) {
            allReviews.splice(reviewIndex, 1);
            localStorage.setItem('platepalReviews', JSON.stringify(allReviews));
            showToast('Review deleted successfully!');
            renderReviews();
        } else {
            showDialog({
                title: 'Review Not Found',
                message: 'Review not found.',
                tone: 'danger'
            });
        }
    }
}

async function markHelpful(reviewId) {
    const userIdentifier = getUserIdentifier();
    console.log('markHelpful clicked', reviewId, userIdentifier);
    showToast('Saving vote...');

    try {
        const response = await fetch(`/api/reviews/${reviewId}/helpful`, {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIdentifier })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            // Remove any local override so we display the DB's authoritative counts
            try {
                const stored = JSON.parse(localStorage.getItem('platepalReviews')) || [];
                const filtered = stored.filter(r => r.id !== reviewId);
                localStorage.setItem('platepalReviews', JSON.stringify(filtered));
            } catch (e) {
                // ignore
            }

            // Trigger other pages to refresh user stats
            localStorage.setItem('platepalRefreshUsers', Date.now().toString());
            window.dispatchEvent(new Event('platepalRefreshUsers'));

            await loadReviews();
            renderReviews();
            return;
        }

        console.warn('Server did not update helpful:', data);
        showToast('Could not save vote (server)');
    } catch (err) {
        console.warn('Unable to persist helpful to server:', err);
        showToast('Could not save vote (network)');
    }

    // Fallback to localStorage when server update fails
    toggleHelpfulLocally(reviewId, userIdentifier);
}


async function markUnhelpful(reviewId) {
    const userIdentifier = getUserIdentifier();
    console.log('markUnhelpful clicked', reviewId, userIdentifier);
    showToast('Saving vote...');

    try {
        const response = await fetch(`/api/reviews/${reviewId}/unhelpful`, {
            method: 'POST',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIdentifier })
        });

        const data = await response.json();
        if (response.ok && data.success) {
            // Trigger other pages to refresh user stats
            localStorage.setItem('platepalRefreshUsers', Date.now().toString());

            await loadReviews();
            renderReviews();
            return;
        }

        console.warn('Server did not update unhelpful:', data);
        showToast('Could not save vote (server)');
    } catch (err) {
        console.warn('Unable to persist unhelpful to server:', err);
        showToast('Could not save vote (network)');
    }

    // Fallback to localStorage when server update fails
    toggleUnhelpfulLocally(reviewId, userIdentifier);
}

async function reportReview(reviewId) {
    const isLoggedInNow = localStorage.getItem('platePalLoggedIn') === 'true';
    const username = (localStorage.getItem('platePalUsername') || '').trim();
    if (!isLoggedInNow || !username) {
        showDialog({
            title: 'Login Required',
            message: 'You must be logged in to report reviews.'
        });
        return;
    }

    const reason = await showPromptDialog({
        title: 'Report Review',
        message: 'Why are you reporting this review?',
        placeholder: 'fake, offensive, irrelevant, etc.',
        confirmText: 'Submit Report',
        cancelText: 'Cancel'
    });
    if (!reason) {
        return;
    }

    try {
        const response = await fetch(`/api/reviews/${reviewId}/report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIdentifier: username, reason })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            showToast('Review reported. Thank you for helping keep the community safe.');
            await loadReviews();
            renderReviews();
            return;
        }

        if (response.status === 401) {
            showDialog({
                title: 'Login Required',
                message: 'You must be logged in to report reviews.',
                tone: 'danger'
            });
            return;
        }

        showDialog({
            title: 'Report Failed',
            message: 'Unable to report review: ' + (data.error || 'Unknown error'),
            tone: 'danger'
        });
    } catch (err) {
        console.error('Error reporting review:', err);
        showDialog({
            title: 'Report Failed',
            message: 'Unable to report review.',
            tone: 'danger'
        });
    }
}

async function hideReview(reviewId) {
    const isLoggedInNow = localStorage.getItem('platePalLoggedIn') === 'true';
    const username = (localStorage.getItem('platePalUsername') || '').trim();
    if (!isLoggedInNow || !username) {
        showDialog({
            title: 'Login Required',
            message: 'You must be logged in to hide reviews.'
        });
        return;
    }

    const approved = await showConfirmDialog({
        title: 'Hide Review',
        message: 'Hide this review from your feed? You can still view and unhide it later.',
        confirmText: 'Hide Review',
        cancelText: 'Cancel'
    });
    if (!approved) {
        return;
    }

    try {
        const response = await fetch(`/api/reviews/${reviewId}/hide`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userIdentifier: username, action: 'hide' })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            if (!hiddenReviewIds.includes(reviewId)) {
                hiddenReviewIds.push(reviewId);
                localStorage.setItem('platepalHiddenReviewIds', JSON.stringify(hiddenReviewIds));
            }
            showToast('Review hidden from your view.');
            await loadReviews();
            renderReviews();
            return;
        }

        if (response.status === 401) {
            showDialog({
                title: 'Login Required',
                message: 'You must be logged in to hide reviews.',
                tone: 'danger'
            });
            return;
        }

        console.warn('Unable to hide review response:', data);
        fallbackHideReview(reviewId);
    } catch (err) {
        console.error('Error hiding review:', err);
        fallbackHideReview(reviewId);
    }
}

function unhideReview(reviewId) {
    if (!hiddenReviewIds.includes(reviewId)) {
        return;
    }
    hiddenReviewIds = hiddenReviewIds.filter(id => id !== reviewId);
    localStorage.setItem('platepalHiddenReviewIds', JSON.stringify(hiddenReviewIds));
    showToast('Review unhidden.');
    renderReviews();
}

function toggleHiddenReviews() {
    showHiddenReviewsMode = !showHiddenReviewsMode;
    const toggleButton = document.getElementById('toggleHiddenBtn');
    if (toggleButton) {
        toggleButton.textContent = showHiddenReviewsMode ? 'Hide hidden reviews' : 'Show hidden reviews';
    }
    renderReviews();
}

function fallbackHideReview(reviewId) {
    if (!hiddenReviewIds.includes(reviewId)) {
        hiddenReviewIds.push(reviewId);
        localStorage.setItem('platepalHiddenReviewIds', JSON.stringify(hiddenReviewIds));
    }
    showToast('Review hidden locally.');
    renderReviews();
}

function toggleHelpfulLocally(reviewId, userIdentifier) {
    let stored = [];
    try {
        stored = JSON.parse(localStorage.getItem('platepalReviews')) || [];
    } catch (e) {
        stored = [];
    }

    const combinedMap = new Map();
    allReviews.forEach(r => combinedMap.set(r.id, JSON.parse(JSON.stringify(r))));
    stored.forEach(r => combinedMap.set(r.id, JSON.parse(JSON.stringify(r))));

    const review = combinedMap.get(reviewId);
    if (!review) {
        showDialog({
            title: 'Review Not Found',
            message: 'Review not found.',
            tone: 'danger'
        });
        return;
    }

    review.helpful = review.helpful || 0;
    review.helpfulBy = review.helpfulBy || [];
    review.unhelpful = review.unhelpful || 0;
    review.unhelpfulBy = review.unhelpfulBy || [];

    const hIndex = review.helpfulBy.indexOf(userIdentifier);
    if (hIndex > -1) {
        review.helpfulBy.splice(hIndex, 1);
        review.helpful = Math.max(0, review.helpful - 1);
    } else {
        review.helpfulBy.push(userIdentifier);
        review.helpful++;
    }

    const uIndex = review.unhelpfulBy.indexOf(userIdentifier);
    if (uIndex > -1) {
        review.unhelpfulBy.splice(uIndex, 1);
        review.unhelpful = Math.max(0, review.unhelpful - 1);
    }

    const si = stored.findIndex(r => r.id === reviewId);
    if (si > -1) {
        stored[si] = review;
    } else {
        stored.push(review);
    }

    localStorage.setItem('platepalReviews', JSON.stringify(stored));
    renderReviews();
}

function toggleUnhelpfulLocally(reviewId, userIdentifier) {
    let stored = [];
    try {
        stored = JSON.parse(localStorage.getItem('platepalReviews')) || [];
    } catch (e) {
        stored = [];
    }

    const combinedMap = new Map();
    allReviews.forEach(r => combinedMap.set(r.id, JSON.parse(JSON.stringify(r))));
    stored.forEach(r => combinedMap.set(r.id, JSON.parse(JSON.stringify(r))));

    const review = combinedMap.get(reviewId);
    if (!review) {
        showDialog({
            title: 'Review Not Found',
            message: 'Review not found.',
            tone: 'danger'
        });
        return;
    }

    review.unhelpful = review.unhelpful || 0;
    review.unhelpfulBy = review.unhelpfulBy || [];
    review.helpful = review.helpful || 0;
    review.helpfulBy = review.helpfulBy || [];

    const uIndex = review.unhelpfulBy.indexOf(userIdentifier);
    if (uIndex > -1) {
        review.unhelpfulBy.splice(uIndex, 1);
        review.unhelpful = Math.max(0, review.unhelpful - 1);
    } else {
        review.unhelpfulBy.push(userIdentifier);
        review.unhelpful++;
    }

    const hIndex = review.helpfulBy.indexOf(userIdentifier);
    if (hIndex > -1) {
        review.helpfulBy.splice(hIndex, 1);
        review.helpful = Math.max(0, review.helpful - 1);
    }

    const si = stored.findIndex(r => r.id === reviewId);
    if (si > -1) {
        stored[si] = review;
    } else {
        stored.push(review);
    }

    localStorage.setItem('platepalReviews', JSON.stringify(stored));
    renderReviews();
}

function toggleReviewBody(reviewId) {
    const bodyElement = document.getElementById(`review-body-${reviewId}`);
    const btnElement = document.getElementById(`btn-${reviewId}`);
    
    if (bodyElement.style.maxHeight === '100px') {
        bodyElement.style.maxHeight = 'none';
        bodyElement.style.overflow = 'visible';
        btnElement.textContent = 'Show Less';
    } else {
        bodyElement.style.maxHeight = '100px';
        bodyElement.style.overflow = 'hidden';
        btnElement.textContent = 'Show More';
    }
}

function countWords(text) {
    return text.trim().split(/\s+/).length;
}

function toggleFavorite() {
    if (!isUserLoggedIn) {
        showDialog({
            title: 'Login Required',
            message: 'Please login to add favorites.'
        });
        return;
    }

    const index = userFavorites.indexOf(currentRestaurant.id);
    if (index > -1) {
        userFavorites.splice(index, 1);
    } else {
        userFavorites.push(currentRestaurant.id);
    }
    
    localStorage.setItem(getFavoritesKey(), JSON.stringify(userFavorites));
    renderRestaurantHeader();
}

function loadMoreReviews() {
    // Recompute total based on combined (mock + stored) and current filter
    let storedReviews = [];
    try {
        storedReviews = JSON.parse(localStorage.getItem('platepalReviews')) || [];
    } catch (e) {
        storedReviews = [];
    }

    const combinedMap = new Map();
    allReviews.forEach(r => combinedMap.set(r.id, r));
    storedReviews.forEach(r => combinedMap.set(r.id, r));

    let combined = Array.from(combinedMap.values());
    const filter = (window._reviewFilter || '').trim().toLowerCase();
    if (filter) {
        combined = combined.filter(r => {
            return (
                (r.title && r.title.toLowerCase().includes(filter)) ||
                (r.body && r.body.toLowerCase().includes(filter)) ||
                (r.username && r.username.toLowerCase().includes(filter))
            );
        });
    }

    const totalReviews = combined.filter(r => r.restaurantId === restaurantId).length;
    visibleReviews = Math.min(visibleReviews + 2, totalReviews);
    renderReviews();
}

function setReviewFilter(value) {
    window._reviewFilter = value || '';
    // reset visibleReviews so search shows top results initially
    visibleReviews = 2;
    renderReviews();
}

// Ensure Enter key also triggers the search (useful if user presses Enter)
const reviewSearchInput = document.getElementById('reviewSearch');
if (reviewSearchInput) {
    reviewSearchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            setReviewFilter(this.value);
        }
    });
}

function clearReviewFilter() {
    window._reviewFilter = '';
    const input = document.getElementById('reviewSearch');
    if (input) input.value = '';
    visibleReviews = 2;
    renderReviews();
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"'`]/g, function (s) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '`': '&#96;'
        })[s];
    });
}

// Initial render
refreshOwnerInfo().then(() => {
    loadRestaurant(restaurantId);
});

if (typeof startLiveRefresh === 'function') {
    startLiveRefresh('establishment-details-page', async function () {
        isUserLoggedIn = localStorage.getItem('platePalLoggedIn') === 'true';
        currentUsername = localStorage.getItem('platePalUsername') || '';
        currentAccountType = localStorage.getItem('platePalAccountType') || 'user';
        currentEstablishmentId = (localStorage.getItem('platePalEstablishmentId') || '').trim();

        if (!currentRestaurant) {
            await refreshOwnerInfo();
            await loadRestaurant(restaurantId);
            return;
        }

        await Promise.all([
            refreshOwnerInfo(),
            loadReviews()
        ]);
        renderReviews();
        renderRestaurantHeader();
    }, 7000);
}

// Load saved guest rating
function loadSavedGuestRating() {
    let guestRatings = {};
    try {
        guestRatings = JSON.parse(localStorage.getItem('platepalGuestRatings')) || {};
    } catch (e) {
        guestRatings = {};
    }
    
    if (guestRatings[restaurantId]) {
        // If logged in, use guest rating as form rating and remove the guest rating
        if (isUserLoggedIn) {
            formRating = guestRatings[restaurantId];
            delete guestRatings[restaurantId];
            localStorage.setItem('platepalGuestRatings', JSON.stringify(guestRatings));
        } else {
            // If not logged in, just display the guest rating
            formRating = guestRatings[restaurantId];
        }
        updateRatingDisplay('ratingStars', formRating);
    }
}

// Call after rendering forms
setTimeout(loadSavedGuestRating, 100);

// Update navbar
function logout() {
    localStorage.removeItem('loggedInUser');
    localStorage.removeItem('platePalLoggedIn');
    localStorage.removeItem('platePalUsername');
    showToast('Logged out successfully!');
    setTimeout(() => {
        window.location.href = 'PlatePal_Main.html';
    }, 800);
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

updateNavbar();

// Owner Response Functions
let currentResponseReviewId = null;

function openOwnerResponseModal(reviewId) {
    currentResponseReviewId = reviewId;
    document.getElementById('ownerResponseText').value = '';
    document.getElementById('ownerResponseModal').style.display = 'block';
}

function closeOwnerResponseModal() {
    document.getElementById('ownerResponseModal').style.display = 'none';
    currentResponseReviewId = null;
}

async function submitOwnerResponse() {
    const responseText = document.getElementById('ownerResponseText').value.trim();
    if (!responseText) {
        showToast('Please enter a response');
        return;
    }

    const username = localStorage.getItem('platePalUsername');
    if (!username) {
        showToast('You must be logged in');
        return;
    }

    try {
        const response = await fetch(`/api/reviews/${currentResponseReviewId}/owner-response`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, responseText })
        });

        const data = await response.json();
        if (response.ok) {
            showToast('Response submitted successfully');
            closeOwnerResponseModal();
            loadReviews().then(() => renderReviews());
        } else {
            showToast(data.error || 'Error submitting response');
        }
    } catch (error) {
        console.error('Error submitting owner response:', error);
        showToast('Error submitting response');
    }
}

function editOwnerResponse(reviewId, currentText) {
    currentResponseReviewId = reviewId;
    document.getElementById('editOwnerResponseText').value = currentText;
    document.getElementById('editOwnerResponseModal').style.display = 'block';
}

function closeEditOwnerResponseModal() {
    document.getElementById('editOwnerResponseModal').style.display = 'none';
    currentResponseReviewId = null;
}

async function updateOwnerResponse() {
    const responseText = document.getElementById('editOwnerResponseText').value.trim();
    if (!responseText) {
        showToast('Please enter a response');
        return;
    }

    const username = localStorage.getItem('platePalUsername');
    if (!username) {
        showToast('You must be logged in');
        return;
    }

    try {
        const response = await fetch(`/api/reviews/${currentResponseReviewId}/owner-response`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, responseText })
        });

        const data = await response.json();
        if (response.ok) {
            showToast('Response updated successfully');
            closeEditOwnerResponseModal();
            loadReviews().then(() => renderReviews());
        } else {
            showToast(data.error || 'Error updating response');
        }
    } catch (error) {
        console.error('Error updating owner response:', error);
        showToast('Error updating response');
    }
}

async function deleteOwnerResponse(reviewId) {
    const approved = await showConfirmDialog({
        title: 'Delete Response',
        message: 'Are you sure you want to delete this response?',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        tone: 'danger'
    });
    if (!approved) {
        return;
    }

    const username = localStorage.getItem('platePalUsername');
    if (!username) {
        showToast('You must be logged in');
        return;
    }

    try {
        const response = await fetch(`/api/reviews/${reviewId}/owner-response`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });

        const data = await response.json();
        if (response.ok) {
            showToast('Response deleted successfully');
            loadReviews().then(() => renderReviews());
        } else {
            showToast(data.error || 'Error deleting response');
        }
    } catch (error) {
        console.error('Error deleting owner response:', error);
        showToast('Error deleting response');
    }
}

// Edit Establishment Functions
function openEditEstablishmentModal() {
    // Populate form with current restaurant data
    document.getElementById('editEstName').value = currentRestaurant.name;
    document.getElementById('editEstEmoji').value = currentRestaurant.emoji || '';
    document.getElementById('editEstImage').value = currentRestaurant.image || '';
    document.getElementById('editEstCuisine').value = currentRestaurant.cuisine;
    document.getElementById('editEstLocation').value = currentRestaurant.location;
    document.getElementById('editEstDescription').value = currentRestaurant.description || '';
    document.getElementById('editEstPhone').value = currentRestaurant.phone || '';
    document.getElementById('editEstAddress').value = currentRestaurant.address || '';
    document.getElementById('editEstHours').value = currentRestaurant.hours || '';
    
    document.getElementById('editEstablishmentModal').style.display = 'block';
}

function closeEditEstablishmentModal() {
    document.getElementById('editEstablishmentModal').style.display = 'none';
}

function saveEstablishmentChanges() {
    // Get values from form
    const updatedData = {
        name: document.getElementById('editEstName').value.trim(),
        emoji: document.getElementById('editEstEmoji').value.trim(),
        image: document.getElementById('editEstImage').value.trim(),
        cuisine: document.getElementById('editEstCuisine').value.trim(),
        location: document.getElementById('editEstLocation').value.trim(),
        description: document.getElementById('editEstDescription').value.trim(),
        phone: document.getElementById('editEstPhone').value.trim(),
        address: document.getElementById('editEstAddress').value.trim(),
        hours: document.getElementById('editEstHours').value.trim()
    };
    
    // Validate required fields
    if (!updatedData.name || !updatedData.cuisine || !updatedData.location) {
        showDialog({
            title: 'Required Fields',
            message: 'Please fill in all required fields (Name, Cuisine, Location).'
        });
        return;
    }
    
    // Update current restaurant object
    currentRestaurant.name = updatedData.name;
    currentRestaurant.emoji = updatedData.emoji;
    currentRestaurant.image = updatedData.image;
    currentRestaurant.cuisine = updatedData.cuisine;
    currentRestaurant.location = updatedData.location;
    currentRestaurant.description = updatedData.description;
    currentRestaurant.phone = updatedData.phone;
    currentRestaurant.address = updatedData.address;
    currentRestaurant.hours = updatedData.hours;
    
    // Save to localStorage
    let customEstablishments = {};
    try {
        customEstablishments = JSON.parse(localStorage.getItem('platePalCustomEstablishments')) || {};
    } catch (e) {
        customEstablishments = {};
    }
    
    customEstablishments[restaurantId] = {
        name: updatedData.name,
        emoji: updatedData.emoji,
        image: updatedData.image,
        cuisine: updatedData.cuisine,
        location: updatedData.location,
        description: updatedData.description,
        phone: updatedData.phone,
        address: updatedData.address,
        hours: updatedData.hours
    };
    
    localStorage.setItem('platePalCustomEstablishments', JSON.stringify(customEstablishments));
    
    // Close modal and refresh display
    closeEditEstablishmentModal();
    showToast('Establishment updated successfully!');
    renderRestaurantHeader();
}

// Load custom establishment data on page load
function loadCustomEstablishmentData() {
    let customEstablishments = {};
    try {
        customEstablishments = JSON.parse(localStorage.getItem('platePalCustomEstablishments')) || {};
    } catch (e) {
        customEstablishments = {};
    }
    
    if (customEstablishments[restaurantId]) {
        const customData = customEstablishments[restaurantId];
        currentRestaurant.name = customData.name || currentRestaurant.name;
        currentRestaurant.emoji = customData.emoji || currentRestaurant.emoji;
        currentRestaurant.image = customData.image || currentRestaurant.image;
        currentRestaurant.cuisine = customData.cuisine || currentRestaurant.cuisine;
        currentRestaurant.location = customData.location || currentRestaurant.location;
        currentRestaurant.description = customData.description || currentRestaurant.description;
        currentRestaurant.phone = customData.phone || currentRestaurant.phone;
        currentRestaurant.address = customData.address || currentRestaurant.address;
        currentRestaurant.hours = customData.hours || currentRestaurant.hours;
    }
}

// Call on page load
loadCustomEstablishmentData();

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('editReviewModal');
    const ownerModal = document.getElementById('ownerResponseModal');
    const editOwnerModal = document.getElementById('editOwnerResponseModal');
    const editEstModal = document.getElementById('editEstablishmentModal');
    
    if (event.target === modal) {
        closeEditModal();
    }
    
    if (event.target === ownerModal) {
        closeOwnerResponseModal();
    }
    
    if (event.target === editOwnerModal) {
        closeEditOwnerResponseModal();
    }
    
    if (event.target === editEstModal) {
        closeEditEstablishmentModal();
    }
};

