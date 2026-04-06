// Get username from URL parameter (fallback to logged-in user)
const urlParams = new URLSearchParams(window.location.search);
const viewingUsername = urlParams.get('user') || localStorage.getItem('platePalUsername') || null;

let viewingUser = null;
let hasShownUnsafeWarningDialog = false;

async function loadUserProfile() {
    if (!viewingUsername) {
        showDialog({
            title: 'User Not Found',
            message: 'No user specified.'
        });
        window.location.href = 'search-users.html';
        return;
    }

    // Fetch user info from backend
    try {
        const currentUsername = localStorage.getItem('platePalUsername');
        const params = new URLSearchParams();
        if (currentUsername) params.append('currentUser', currentUsername);
        const response = await fetch(`/api/users/username/${encodeURIComponent(viewingUsername)}?${params.toString()}`);
        if (!response.ok) {
            throw new Error('User not found');
        }

        const userData = await response.json();
        viewingUser = {
            _id: userData._id,
            username: userData.username,
            description: userData.bio || 'No description yet',
            avatar: userData.profilePic || null,
            isBlocked: userData.isBlocked || false,
            isWarned: Boolean(userData.isWarned),
            warningCount: Number(userData.warningCount || 0),
            lastWarningReason: userData.lastWarningReason || '',
            lastWarningAt: userData.lastWarningAt || null
        };
    } catch (err) {
        console.error('Error loading user profile:', err);
        showDialog({
            title: 'User Not Found',
            message: 'User not found.'
        });
        window.location.href = 'search-users.html';
        return;
    }

    // Display user profile with proper avatar handling
    const avatarContainer = document.querySelector('.profile-header');
    const hasValidAvatar = viewingUser.avatar && viewingUser.avatar.trim() !== '' && viewingUser.avatar.startsWith('data:');

    if (hasValidAvatar) {
        const existingCircle = avatarContainer.querySelector('.user-avatar-circle');
        if (existingCircle) existingCircle.remove();
        document.querySelector('#avatar').style.display = 'block';
        document.querySelector('#avatar').src = viewingUser.avatar;
    } else {
        const existingImg = document.querySelector('#avatar');
        if (existingImg) existingImg.style.display = 'none';

        let circleElement = avatarContainer.querySelector('.user-avatar-circle');
        if (!circleElement) {
            circleElement = document.createElement('div');
            circleElement.className = 'user-avatar-circle';
            avatarContainer.insertBefore(circleElement, avatarContainer.querySelector('div'));
        }
        circleElement.innerText = viewingUser.username.charAt(0).toUpperCase();
    }

    document.querySelector('#username').innerText = viewingUser.username;
    document.querySelector('#description').innerText = viewingUser.description;

    const safetyStatusEl = document.getElementById('accountSafetyStatus');
    if (safetyStatusEl) {
        if (viewingUser.isWarned && viewingUser.warningCount > 0) {
            safetyStatusEl.textContent = `Account Safety: Flagged (${viewingUser.warningCount} report${viewingUser.warningCount !== 1 ? 's' : ''})`;
            safetyStatusEl.style.color = '#b42318';
        } else {
            safetyStatusEl.textContent = 'Account Safety: No active warnings reported';
            safetyStatusEl.style.color = '#166534';
        }
    }

    const warningEl = document.getElementById('accountWarning');
    if (warningEl) {
        if (viewingUser.isWarned && viewingUser.warningCount > 0) {
            const warningDate = viewingUser.lastWarningAt
                ? new Date(viewingUser.lastWarningAt).toLocaleDateString()
                : 'Unknown date';
            const reasonSuffix = viewingUser.lastWarningReason
                ? ` Latest reason: ${viewingUser.lastWarningReason}.`
                : '';
            warningEl.textContent = `Warning: This account has been reported ${viewingUser.warningCount} time(s). Last report: ${warningDate}.${reasonSuffix}`;
            warningEl.style.display = 'block';

            if (!hasShownUnsafeWarningDialog) {
                showDialog({
                    title: 'Unsafe Account Warning',
                    message: `This account has been reported ${viewingUser.warningCount} time(s). Last report: ${warningDate}.${reasonSuffix}`,
                    tone: 'danger'
                });
                hasShownUnsafeWarningDialog = true;
            }
        } else {
            warningEl.style.display = 'none';
            warningEl.textContent = '';
            hasShownUnsafeWarningDialog = false;
        }
    }

    // Update buttons - hide if viewing own profile
    const currentUser = localStorage.getItem('platePalUsername');

    if (currentUser === viewingUsername) {
        const blockBtn = document.getElementById('blockUserBtn');
        const reportBtn = document.getElementById('reportUserBtn');
        if (blockBtn) blockBtn.style.display = 'none';
        if (reportBtn) reportBtn.style.display = 'none';
    } else {
        updateBlockButton();
    }

    // Display reviews from backend
    await displayUserReviews(viewingUsername);
}

function updateBlockButton() {
    const blockBtn = document.getElementById('blockUserBtn');
    if (blockBtn) {
        blockBtn.innerText = viewingUser.isBlocked ? 'Unblock User' : 'Block User';
    }
}

function blockUser() {
    const currentUser = localStorage.getItem('platePalUsername');
    if (!currentUser) {
        showDialog({
            title: 'Login Required',
            message: 'Please login to block users.'
        });
        return;
    }

    if (viewingUser.isBlocked) {
        // Unblock
        fetch(`/api/unblock/${viewingUser._id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ blockerUsername: currentUser })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                viewingUser.isBlocked = false;
                updateBlockButton();
                displayUserReviews(viewingUsername); // Reload reviews
                showToast('User unblocked');
            } else {
                showDialog({
                    title: 'Action Failed',
                    message: 'Error unblocking user: ' + (data.error || 'Unknown error'),
                    tone: 'danger'
                });
            }
        })
        .catch(err => {
            console.error('Error unblocking user:', err);
            showDialog({
                title: 'Action Failed',
                message: 'Error unblocking user.',
                tone: 'danger'
            });
        });
    } else {
        // Block
        fetch(`/api/block/${viewingUser._id}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ blockerUsername: currentUser })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                viewingUser.isBlocked = true;
                updateBlockButton();
                displayUserReviews(viewingUsername); // This will show blocked message
                showToast('User blocked');
            } else {
                showDialog({
                    title: 'Action Failed',
                    message: 'Error blocking user: ' + (data.error || 'Unknown error'),
                    tone: 'danger'
                });
            }
        })
        .catch(err => {
            console.error('Error blocking user:', err);
            showDialog({
                title: 'Action Failed',
                message: 'Error blocking user.',
                tone: 'danger'
            });
        });
    }
}

async function displayUserReviews(username) {
    const reviewsContainer = document.getElementById('reviewsContainer');

    if (viewingUser.isBlocked) {
        reviewsContainer.innerHTML = '<p style="color:#888;">This user is blocked.</p>';
        return;
    }

    // Try to load reviews from the backend
    try {
        const currentUsername = localStorage.getItem('platePalUsername');
        const params = new URLSearchParams();
        if (currentUsername) params.append('currentUser', currentUsername);
        const response = await fetch(`/api/users/${encodeURIComponent(username)}/reviews?${params.toString()}`);
        if (!response.ok) {
            throw new Error('Unable to load reviews');
        }

        const userReviews = await response.json();
        if (!Array.isArray(userReviews) || userReviews.length === 0) {
            reviewsContainer.innerHTML = '<p style="color:#888;">No reviews yet from this user.</p>';
            return;
        }

        userReviews.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        let reviewsHTML = '';
        userReviews.forEach(review => {
            const ratingStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            const restaurantName = review.establishment?.name || 'Unknown';
            const dateText = (review.updatedAt || review.createdAt) ? new Date(review.updatedAt || review.createdAt).toLocaleString('en-US', {
                year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : '';

            reviewsHTML += `
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
        reviewsContainer.innerHTML = reviewsHTML;
        return;
    } catch (err) {
        console.warn('Falling back to local reviews due to error:', err);
    }

    // Fallback: Load reviews from localStorage (for legacy data)
    let allReviews = [];
    try {
        allReviews = JSON.parse(localStorage.getItem('platepalReviews')) || [];
    } catch (e) {
        allReviews = [];
    }

    const userReviews = allReviews.filter(r => r.username === username);

    if (userReviews.length === 0) {
        reviewsContainer.innerHTML = '<p style="color:#888;">No reviews yet from this user.</p>';
    } else {
        let reviewsHTML = '';
        userReviews.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        userReviews.forEach(review => {
            const ratingStars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
            reviewsHTML += `
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
        reviewsContainer.innerHTML = reviewsHTML;
    }
}

function openReportModal() {
    const currentUser = localStorage.getItem('platePalUsername');
    if (!currentUser) {
        showDialog({
            title: 'Login Required',
            message: 'Please login to report users.'
        });
        return;
    }

    if (!viewingUser || !viewingUser._id) {
        showDialog({
            title: 'Report Unavailable',
            message: 'Unable to report this user right now. Please try again.',
            tone: 'danger'
        });
        return;
    }

    const modal = document.getElementById('reportUserModal');
    const subtitle = document.getElementById('reportModalSubtitle');
    const reasonInput = document.getElementById('reportReason');
    const detailsInput = document.getElementById('reportDetails');
    const submitBtn = document.getElementById('submitReportBtn');

    if (!modal || !reasonInput || !detailsInput || !submitBtn) return;

    subtitle.textContent = `Report @${viewingUser.username} to keep the community safe.`;
    reasonInput.value = '';
    detailsInput.value = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Report';
    modal.style.display = 'flex';
}

function closeReportModal() {
    const modal = document.getElementById('reportUserModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function reportUser() {
    openReportModal();
}

function submitUserReport() {
    const currentUser = localStorage.getItem('platePalUsername');
    if (!currentUser || !viewingUser || !viewingUser._id) {
        showDialog({
            title: 'Report Failed',
            message: 'Unable to submit report. Please login and try again.',
            tone: 'danger'
        });
        return;
    }

    const reasonField = document.getElementById('reportReason');
    const detailsField = document.getElementById('reportDetails');
    const submitBtn = document.getElementById('submitReportBtn');
    if (!reasonField || !detailsField || !submitBtn) {
        return;
    }

    const reason = (reasonField.value || '').trim();
    const details = (detailsField.value || '').trim();

    if (!reason) {
        showDialog({
            title: 'Reason Required',
            message: 'Please select a reason for this report.'
        });
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    fetch(`/api/users/${viewingUser._id}/report`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reporterUsername: currentUser, reason, details })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            closeReportModal();
            const reportCount = data.report && data.report.reportCount ? data.report.reportCount : null;
            const reportId = data.report && data.report.id ? data.report.id : '';
            const routeVersion = data.routeVersion || 'unknown-route';
            if (reportCount) {
                showToast(`Report submitted for ${viewingUser.username}. Total reports: ${reportCount}. (${routeVersion}${reportId ? ` | ${reportId}` : ''})`);
            } else {
                showToast(`Report submitted for ${viewingUser.username}. (${routeVersion})`);
            }
            loadUserProfile();
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Report';
            showDialog({
                title: 'Report Failed',
                message: 'Error reporting user: ' + (data.error || data.message || 'Unknown error'),
                tone: 'danger'
            });
        }
    })
    .catch(err => {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Report';
        console.error('Error reporting user:', err);
        showDialog({
            title: 'Report Failed',
            message: 'Error reporting user.',
            tone: 'danger'
        });
    });
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
document.addEventListener('DOMContentLoaded', async function() {
    await loadUserProfile();
    updateNavbar();

    if (typeof startLiveRefresh === 'function') {
        startLiveRefresh('user-profile-page', async function () {
            await loadUserProfile();
        }, 7000);
    }

    const modal = document.getElementById('reportUserModal');
    if (modal) {
        modal.addEventListener('click', function (event) {
            if (event.target === modal) {
                closeReportModal();
            }
        });
    }

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            closeReportModal();
        }
    });
});

// Refresh reviews when page comes into focus
window.addEventListener('focus', function() {
    if (viewingUser) {
        displayUserReviews(viewingUser.username);
    }
});

// Listen for changes in localStorage (reviews being added)
window.addEventListener('storage', function(e) {
    if (e.key === 'platepalReviews') {
        // Refresh the reviews display
        if (viewingUser) {
            displayUserReviews(viewingUser.username);
        }
    }
});
