// Clear form on page load to prevent text persistence from browser cache/autocomplete
window.addEventListener('load', function() {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    document.getElementById('description').value = '';
    document.getElementById('accountType').value = 'user';
    const ownerSection = document.getElementById('establishmentSelectContainer');
    if (ownerSection) ownerSection.style.display = 'none';

    // Ensure stale owner session state doesn't remain while registering
    localStorage.removeItem('platePalEstablishmentId');
    localStorage.removeItem('platePalAccountType');

    // Populate establishment dropdown (for owners)
    loadEstablishmentsForOwner();
});

async function loadEstablishmentsForOwner() {
    const select = document.getElementById('establishmentSelect');
    if (!select) return;

    // Remember what the user had selected (if anything) so we don't overwrite it
    const previousSelection = select.value;

    try {
        const res = await fetch('/api/establishments', { cache: 'no-store' });
        if (!res.ok) throw new Error('Failed to load establishments');
        const data = await res.json();

        // Populate options
        select.innerHTML = data.map(est => `<option value="${est._id}">${est.name}</option>`).join('');

        // Restore selection if it still exists in the updated list
        if (previousSelection && Array.from(select.options).some(o => o.value === previousSelection)) {
            select.value = previousSelection;
        }
    } catch (err) {
        console.error('Error loading establishments for owner:', err);
        // If the backend is unreachable, keep the fallback in the template.
    } finally {
        select.disabled = false;
    }
}

// Avatar upload UI improvements
const avatarCircle = document.getElementById("avatarCircle");
const avatarUpload = document.getElementById("avatarUpload");
const avatarImage = document.getElementById("avatarImage");
const avatarPlaceholder = document.getElementById("avatarPlaceholder");


// Clicking either the circle or the + button opens file picker
avatarCircle.addEventListener("click", function() {
    avatarUpload.click();
});
document.getElementById("avatarAddBtn").addEventListener("click", function() {
    avatarUpload.click();
});

avatarUpload.addEventListener("change", function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            avatarImage.src = e.target.result;
            avatarImage.style.display = "block";
            avatarPlaceholder.style.display = "none";
        }
        reader.readAsDataURL(file);
    }
});

function toggleEstablishmentSelect() {
    const accountType = document.getElementById('accountType').value;
    const container = document.getElementById('establishmentSelectContainer');
    const codeContainer = document.getElementById('ownerCodeContainer');
    container.style.display = accountType === 'owner' ? 'block' : 'none';
    if (codeContainer) codeContainer.style.display = accountType === 'owner' ? 'block' : 'none';
}

function registerUser() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const description = document.getElementById("description").value.trim();
    const avatar = document.getElementById("avatarImage").src || "";
    const accountType = document.getElementById("accountType").value;    const ownerCode = document.getElementById('ownerCode') ? document.getElementById('ownerCode').value.trim() : '';    const email = username + "@example.com"; // Dummy email, since not in form

    if (username === "" || password === "") {
        showDialog({
            title: 'Required Fields',
            message: 'Please fill in username and password.'
        });
        return;
    }

    // Send register request to server
    const requestBody = {
        username,
        email,
        password,
        bio: description,
        profilePic: avatar,
        accountType
    };

    if (accountType === 'owner') {
        const ownerCode = document.getElementById('ownerCode')?.value.trim();
        if (!ownerCode) {
            showDialog({
                title: 'Code Required',
                message: 'Please enter the owner registration code.'
            });
            return;
        }

        const establishmentId = document.getElementById('establishmentSelect')?.value;
        if (!establishmentId) {
            showDialog({
                title: 'Establishment Required',
                message: 'Please select an establishment when registering as an owner.'
            });
            return;
        }
        requestBody.establishmentId = establishmentId;
        requestBody.ownerCode = ownerCode;
    }

    fetch('/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Auto-login the new user to avoid stale remembered credentials
            const user = data.user;
            localStorage.setItem('loggedInUser', JSON.stringify({
                username: user.username,
                description: user.bio || '',
                avatar: user.profilePic || '',
                accountType: user.accountType || 'user',
                establishmentId: user.establishmentId ? String(user.establishmentId) : null
            }));
            localStorage.setItem('platePalLoggedIn', 'true');
            localStorage.setItem('platePalUsername', user.username);
            localStorage.setItem('platePalAccountType', user.accountType || 'user');
            localStorage.setItem('platePalEstablishmentId', user.establishmentId ? String(user.establishmentId) : '');

            // Clear form fields
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            document.getElementById('description').value = '';
            document.getElementById('accountType').value = 'user';
            document.getElementById('avatarImage').src = '';

            showToast('Registration successful! Redirecting...');
            setTimeout(() => {
                window.location.href = 'PlatePal_Main.html';
            }, 1200);
        } else {
            showDialog({
                title: 'Registration Failed',
                message: data.message || 'Registration failed.',
                tone: 'danger'
            });
        }
    })
    .catch(err => {
        console.error('Register error:', err);
        showDialog({
            title: 'Registration Failed',
            message: 'Registration failed. Please try again.',
            tone: 'danger'
        });
    });
}
