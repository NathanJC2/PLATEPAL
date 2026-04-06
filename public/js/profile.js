let currentUser = null;
let newAvatarData = null;
let hasShownOwnerWarningPrompt = false;

async function showOwnerSafetyWarningIfNeeded(username) {
    if (!username || hasShownOwnerWarningPrompt) {
        return;
    }

    try {
        const response = await fetch(`/api/users/username/${encodeURIComponent(username)}`, { cache: 'no-store' });
        if (!response.ok) {
            return;
        }

        const userData = await response.json();
        const warningCount = Number(userData.warningCount || 0);
        if (!userData.isWarned || warningCount <= 0) {
            return;
        }

        const warningDate = userData.lastWarningAt
            ? new Date(userData.lastWarningAt).toLocaleDateString()
            : 'Unknown date';
        const reasonSuffix = userData.lastWarningReason
            ? ` Latest reason: ${userData.lastWarningReason}.`
            : '';

        showDialog({
            title: 'Account Warning Notice',
            message: `Your account has been reported ${warningCount} time(s). Last report: ${warningDate}.${reasonSuffix}`,
            tone: 'danger'
        });
        hasShownOwnerWarningPrompt = true;
    } catch (err) {
        console.warn('Could not load account safety warning:', err);
    }
}

function normalizeAvatar(avatar) {
    const value = typeof avatar === 'string' ? avatar.trim() : '';
    const invalidValues = ['', 'undefined', 'null', 'false'];
    if (!value || invalidValues.includes(value.toLowerCase())) {
        return '';
    }
    return value;
}

function loadUserProfile() {
    const userData = localStorage.getItem('loggedInUser');
    if (!userData) {
        showDialog({
            title: 'Login Required',
            message: 'Please login first.'
        });
        window.location.href = 'login.html';
        return;
    }
    
    try {
        currentUser = JSON.parse(userData);
        currentUser.avatar = normalizeAvatar(currentUser.avatar);
        document.getElementById('username').innerText = currentUser.username;
        document.getElementById('description').innerText = currentUser.description || 'No description yet';
        updateAvatarDisplay();

        // Show warning prompt to the account owner when their account is flagged.
        showOwnerSafetyWarningIfNeeded(currentUser.username);

        // If user is an owner, show their owned establishment here too
        if (currentUser.accountType === 'owner' && currentUser.establishmentId) {
            fetch(`/api/establishments/${encodeURIComponent(currentUser.establishmentId)}`)
                .then(res => res.ok ? res.json() : null)
                .then(est => {
                    if (est && est.name) {
                        const ownerTitle = document.getElementById('ownerTitle');
                        if (ownerTitle) {
                            ownerTitle.textContent = `Owner of ${est.name}`;
                            ownerTitle.style.display = 'block';
                        }
                    }
                })
                .catch(() => {
                    // If the establishment isn't found, still show owner status without name
                    const ownerTitle = document.getElementById('ownerTitle');
                    if (ownerTitle) {
                        ownerTitle.textContent = 'Owner';
                        ownerTitle.style.display = 'block';
                    }
                });
        }

        // Load and display user's reviews
        displayMyReviews(currentUser.username);

        // If this user is an owner, also show their owner responses
        if (currentUser.accountType === 'owner') {
            displayOwnerResponses(currentUser.username);
        }
    } catch (e) {
        console.error('Error loading user profile:', e);
        showDialog({
            title: 'Profile Error',
            message: 'Error loading profile.',
            tone: 'danger'
        });
        window.location.href = 'PlatePal_Main.html';
    }
    
    // Set up avatar upload listeners once
    setupAvatarUpload();
}

// Display owner responses (feedback left by an owner in response to reviews)
async function displayOwnerResponses(username) {
    const titleEl = document.getElementById('ownerResponsesTitle');
    const container = document.getElementById('ownerResponsesContainer');
    if (!container || !titleEl) return;

    try {
        const response = await fetch(`/api/users/${encodeURIComponent(username)}/owner-responses`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Unable to load owner responses');
        }

        const responses = await response.json();
        if (!Array.isArray(responses) || responses.length === 0) {
            titleEl.style.display = 'none';
            container.style.display = 'none';
            return;
        }

        titleEl.style.display = 'block';
        container.style.display = 'block';

        // Sort newest first
        responses.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const html = responses.map(resp => {
            const restaurantName = resp.review?.establishment?.name || 'Unknown establishment';
            const reviewTitle = resp.review?.title || '';
            const reviewBody = resp.review?.comment || '';
            const dateText = resp.timestamp ? new Date(resp.timestamp).toLocaleString('en-US', {
                year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '';

            return `
                <div class="review-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0;">Response to ${restaurantName}</h4>
                        <small style="color:#999;">${dateText}</small>
                    </div>
                    ${reviewTitle ? `<p style="font-weight:600; margin: 8px 0 4px;">Original review: ${reviewTitle}</p>` : ''}
                    ${reviewBody ? `<p style="color:#555; margin: 4px 0;">${reviewBody}</p>` : ''}
                    <div style="background:#f8f8f8; padding:10px; border-radius:6px;">
                        <p style="margin:0;">${resp.text}</p>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html;
    } catch (err) {
        console.warn('Error loading owner responses:', err);
        titleEl.style.display = 'none';
        container.style.display = 'none';
    }
}

function setupAvatarUpload() {
    const editAvatarCircle = document.getElementById("editAvatarCircle");
    const avatarUpload = document.getElementById("avatarUpload");
    
    editAvatarCircle.onclick = function() {
        avatarUpload.click();
    };
    
    avatarUpload.onchange = function(event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                newAvatarData = e.target.result;
                const editAvatarImage = document.getElementById("editAvatarImage");
                const editAvatarPlaceholder = document.getElementById("editAvatarPlaceholder");
                editAvatarImage.src = newAvatarData;
                editAvatarImage.style.display = "block";
                editAvatarPlaceholder.style.display = "none";
            }
            reader.readAsDataURL(file);
        }
    };
}

function toggleEdit() {
    newAvatarData = null;
    document.getElementById("editSection").style.display = "block";
    document.getElementById("descInput").value = document.getElementById("description").innerText;
    
    const editAvatarImage = document.getElementById("editAvatarImage");
    const editAvatarPlaceholder = document.getElementById("editAvatarPlaceholder");
    
    if (currentUser.avatar && currentUser.avatar.startsWith('data:')) {
        editAvatarImage.src = currentUser.avatar;
        editAvatarImage.style.display = "block";
        editAvatarPlaceholder.style.display = "none";
    } else {
        editAvatarImage.style.display = "none";
        editAvatarPlaceholder.style.display = "block";
    }
}

function cancelEdit() {
    document.getElementById("editSection").style.display = "none";
    newAvatarData = null;
}

function saveProfile() {
    const newDesc = document.getElementById("descInput").value;
    
    if (newAvatarData) {
        currentUser.avatar = newAvatarData;
    }
    currentUser.description = newDesc;
    
    // Update loggedInUser
    localStorage.setItem('loggedInUser', JSON.stringify(currentUser));
    
    // Also update platepalAccounts so it reflects in search-users page
    try {
        const accounts = JSON.parse(localStorage.getItem('platepalAccounts')) || {};
        if (accounts[currentUser.username]) {
            accounts[currentUser.username].description = currentUser.description;
            accounts[currentUser.username].avatar = currentUser.avatar;
            localStorage.setItem('platepalAccounts', JSON.stringify(accounts));
        }
    } catch (e) {
        console.error('Error updating accounts:', e);
    }
    
    updateAvatarDisplay();
    document.getElementById("description").innerText = newDesc;
    showToast('Profile updated successfully!');
    document.getElementById("editSection").style.display = "none";
    newAvatarData = null;
}

function updateAvatarDisplay() {
    const avatar = document.getElementById('avatar');
    const avatarInitial = document.getElementById('avatarInitial');
    if (!avatar || !avatarInitial) return;

    const avatarValue = normalizeAvatar(currentUser.avatar);
    const validAvatarSource = avatarValue && (
        avatarValue.startsWith('data:') ||
        avatarValue.startsWith('http:') ||
        avatarValue.startsWith('https:') ||
        avatarValue.startsWith('/') ||
        avatarValue.startsWith('blob:')
    );

    avatar.onerror = function() {
        avatar.style.display = 'none';
        avatarInitial.style.display = 'flex';
        avatarInitial.textContent = currentUser.username ? currentUser.username.charAt(0).toUpperCase() : '?';
    };
    avatar.onload = function() {
        avatar.style.display = 'block';
        avatarInitial.style.display = 'none';
    };

    if (validAvatarSource) {
        avatar.src = avatarValue;
    } else {
        avatar.style.display = 'none';
        avatarInitial.style.display = 'flex';
        avatarInitial.textContent = currentUser.username ? currentUser.username.charAt(0).toUpperCase() : '?';
    }
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

// Load profile on page load
document.addEventListener('DOMContentLoaded', function() {
    loadUserProfile();
    updateNavbar();

    if (typeof startLiveRefresh === 'function') {
        startLiveRefresh('profile-page', async function () {
            if (!currentUser || !currentUser.username) {
                loadUserProfile();
                return;
            }

            await Promise.all([
                displayMyReviews(currentUser.username),
                currentUser.accountType === 'owner' ? displayOwnerResponses(currentUser.username) : Promise.resolve(),
                showOwnerSafetyWarningIfNeeded(currentUser.username)
            ]);
        }, 8000);
    }
});

// Refresh reviews when page comes into focus
window.addEventListener('focus', function() {
    if (currentUser) {
        displayMyReviews(currentUser.username);
    }
});

// Optionally, in the future, you can dynamically load and display user reviews here.
async function displayMyReviews(username) {
    const reviewsContainer = document.getElementById('myReviewsContainer');
    if (!reviewsContainer) return;

    // Try to load reviews from the backend (database)
    try {
        const response = await fetch(`/api/users/${encodeURIComponent(username)}/reviews`, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error('Unable to load reviews');
        }

        const userReviews = await response.json();
        if (!Array.isArray(userReviews) || userReviews.length === 0) {
            reviewsContainer.innerHTML = '<p style="color:#888;">You have not written any reviews yet.</p>';
            return;
        }

        userReviews.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        let html = '';
        userReviews.forEach(review => {
            const ratingStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            const restaurantName = review.establishment?.name || 'Unknown';
            const dateText = (review.updatedAt || review.createdAt) ? new Date(review.updatedAt || review.createdAt).toLocaleString('en-US', {
                year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '';

            html += `
                <div class="review-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0;">${review.title}</h4>
                        <span style="color:#FFA500; font-size:16px;">${ratingStars}</span>
                    </div>
                    <p>${review.comment}</p>
                    <small style="color:#999;">${restaurantName}${dateText ? ' • ' + dateText : ''}</small>
                </div>
            `;
        });
        reviewsContainer.innerHTML = html;
        return;
    } catch (err) {
        console.warn('Falling back to local reviews due to error:', err);
    }

    // Fallback: Load reviews from localStorage (legacy data)
    let allReviews = [];
    try {
        allReviews = JSON.parse(localStorage.getItem('platepalReviews')) || [];
    } catch (e) {
        allReviews = [];
    }

    const userReviews = allReviews.filter(r => r.username === username);

    if (userReviews.length === 0) {
        reviewsContainer.innerHTML = '<p style="color:#888;">You have not written any reviews yet.</p>';
    } else {
        let html = '';
        userReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        userReviews.forEach(review => {
            const ratingStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            html += `
                <div class="review-card">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h4 style="margin:0;">${review.title}</h4>
                        <span style="color:#FFA500; font-size:16px;">${ratingStars}</span>
                    </div>
                    <p>${review.body}</p>
                    <small style="color:#999;">Last Modified: ${new Date(review.timestamp).toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
                </div>
            `;
        });
        reviewsContainer.innerHTML = html;
    }
}
