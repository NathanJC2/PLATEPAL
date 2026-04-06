// Clear form on page load to prevent text persistence from browser cache/autocomplete
window.addEventListener('load', function() {
    const reviewTitle = document.getElementById('reviewTitle');
    const reviewBody = document.getElementById('reviewBody');
    if (reviewTitle) reviewTitle.value = '';
    if (reviewBody) reviewBody.value = '';
});

let currentReviewData = null;
let currentRating = 0;

function openReviewModal(reviewId = null) {
    const modal = document.getElementById("reviewModal");
    const form = document.getElementById("reviewForm");
    const title = document.getElementById("modalTitle");
    const lastModified = document.getElementById("lastModifiedIndicator");
    const imagePreview = document.getElementById("imagePreview");
    const videoPreview = document.getElementById("videoPreview");

    // Reset form
    form.reset();
    currentRating = 0;
    document.querySelectorAll(".star-input").forEach(star => star.classList.remove("active"));
    imagePreview.innerHTML = "";
    imagePreview.style.display = "none";
    videoPreview.innerHTML = "";
    videoPreview.style.display = "none";
    lastModified.style.display = "none";

    if (reviewId) {
        // Edit mode
        title.textContent = "Edit Review";
        currentReviewData = { id: reviewId };
        lastModified.style.display = "block";
        lastModified.textContent = "Last modified: " + new Date().toLocaleString();
        
        // Load review data (simulated)
        document.getElementById("reviewTitle").value = "Great Food & Ambiance";
        document.getElementById("reviewBody").value = "This restaurant offers amazing dishes and a wonderful atmosphere. Highly recommended!";
        setRating(4);
    } else {
        // Create mode
        title.textContent = "Create Review";
        currentReviewData = null;
    }

    modal.style.display = "block";
}

function closeReviewModal() {
    const modal = document.getElementById("reviewModal");
    modal.style.display = "none";
    currentReviewData = null;
    currentRating = 0;
}

function setRating(stars) {
    currentRating = stars;
    document.getElementById("ratingInput").value = stars;
    document.querySelectorAll(".star-input").forEach((star, index) => {
        if (index < stars) {
            star.classList.add("active");
        } else {
            star.classList.remove("active");
        }
    });
}

function handleFilePreview(inputId, previewId) {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);

    input.addEventListener("change", function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                if (inputId === "imageUpload") {
                    preview.innerHTML = `<img src="${e.target.result}" alt="Image preview">`;
                } else if (inputId === "videoUpload") {
                    preview.innerHTML = `<video controls><source src="${e.target.result}" type="video/mp4">Your browser does not support the video tag.</video>`;
                }
                preview.style.display = "block";
            };
            reader.readAsDataURL(file);
        }
    });
}

function submitReview(event) {
    event.preventDefault();

    const title = document.getElementById("reviewTitle").value;
    const body = document.getElementById("reviewBody").value;
    const rating = currentRating;
    const imageInput = document.getElementById("imageUpload");
    const videoInput = document.getElementById("videoUpload");
    const image = imageInput ? imageInput.files[0] : null;
    const video = videoInput ? videoInput.files[0] : null;

    if (!rating) {
        showDialog({
            title: 'Rating Required',
            message: 'Please select a rating.'
        });
        return;
    }

    const username = localStorage.getItem('platePalUsername');
    if (!username) {
        showDialog({
            title: 'Login Required',
            message: 'You must be logged in to submit a review.'
        });
        return;
    }

    // Process files and convert to base64
    let imageData = null;
    let videoData = null;
    let filesProcessed = 0;
    let filesToProcess = (image ? 1 : 0) + (video ? 1 : 0);

    if (filesToProcess === 0) {
        saveReviewData(null, null);
    } else {
        if (image) {
            const reader = new FileReader();
            reader.onload = function(e) {
                imageData = e.target.result;
                filesProcessed++;
                if (filesProcessed === filesToProcess) {
                    saveReviewData(imageData, videoData);
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
                    saveReviewData(imageData, videoData);
                }
            };
            reader.readAsDataURL(video);
        }
    }
}

function saveReviewData(imageData, videoData) {
    const title = document.getElementById("reviewTitle").value;
    const body = document.getElementById("reviewBody").value;
    const rating = currentRating;
    const username = localStorage.getItem('platePalUsername');

    const reviewData = {
        id: currentReviewData?.id || Date.now(),
        username: username,
        title: title,
        body: body,
        rating: rating,
        image: imageData,
        video: videoData,
        timestamp: new Date().toISOString(),
        isEdit: !!currentReviewData,
        helpful: 0,
        helpfulBy: []
    };

    // Save to localStorage under 'platepalReviews'
    let allReviews = [];
    try {
        allReviews = JSON.parse(localStorage.getItem('platepalReviews')) || [];
    } catch (e) {
        allReviews = [];
    }

    if (currentReviewData) {
        // Edit: replace existing review
        allReviews = allReviews.map(r => r.id === reviewData.id ? reviewData : r);
    } else {
        // New: add review
        allReviews.push(reviewData);
    }
    localStorage.setItem('platepalReviews', JSON.stringify(allReviews));
    
    // Trigger storage event to notify other pages
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'platepalReviews',
        newValue: JSON.stringify(allReviews),
        oldValue: null,
        storageArea: localStorage
    }));

    const message = (currentReviewData ? "Review updated" : "Review created") + " successfully!";
    showToast(message);
    
    // Clear form fields
    document.getElementById('reviewTitle').value = '';
    document.getElementById('reviewBody').value = '';
    currentRating = 0;
    updateStarDisplay();
    if (document.getElementById('imageUpload')) document.getElementById('imageUpload').value = '';
    if (document.getElementById('videoUpload')) document.getElementById('videoUpload').value = '';
    
    closeReviewModal();
    
    // Redirect to profile after 1 second to show the new review
    setTimeout(() => {
        window.location.href = 'profile.html';
    }, 1000);
}

// Initialize file preview handlers
handleFilePreview("imageUpload", "imagePreview");
handleFilePreview("videoUpload", "videoPreview");

// Close modal when clicking outside of it
window.onclick = function(event) {
    const modal = document.getElementById("reviewModal");
    if (event.target === modal) {
        closeReviewModal();
    }
};

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
