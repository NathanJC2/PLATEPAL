document.addEventListener('DOMContentLoaded', function() {
    migrateLegacyUser();

    const remRaw = localStorage.getItem('platepalRemembered');
    let remembered = {};
    try { remembered = remRaw ? JSON.parse(remRaw) : {}; } catch (e) { remembered = {}; }
    const rememberedUsernames = Object.keys(remembered);
    if (rememberedUsernames.length > 0) {
        const firstUser = rememberedUsernames[0];
        document.getElementById('username').value = firstUser;
        document.getElementById('password').value = remembered[firstUser];
        document.getElementById('rememberMe').checked = true;
    } else {
        // Clear form fields if no remembered user (prevents browser autocomplete persistence)
        const form = document.getElementById('loginForm');
        if (form) form.reset();
    }

    const form = document.getElementById('loginForm');
    if (form) {
        form.addEventListener('submit', loginUser);
    }

    const usernameInput = document.getElementById('username');
    if (usernameInput) {
        usernameInput.addEventListener('input', tryAutofillPassword);
        usernameInput.addEventListener('blur', tryAutofillPassword);
    }


});

function loginUser(event) {
    if (event && event.preventDefault) event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const rememberMe = document.getElementById("rememberMe").checked;

    if (!username || !password) {
        showDialog({
            title: 'Missing Credentials',
            message: 'Please enter username and password.'
        });
        return;
    }

    // Send login request to server
    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            const user = data.user;
            const sessionUser = { 
                username: user.username, 
                description: user.bio || '', 
                avatar: user.profilePic || '',
                accountType: user.accountType || 'user',
                establishmentId: user.establishmentId ? String(user.establishmentId) : null
            };
            localStorage.setItem('loggedInUser', JSON.stringify(sessionUser));
            localStorage.setItem('platePalLoggedIn', 'true');
            localStorage.setItem('platePalUsername', username);
            localStorage.setItem('platePalAccountType', user.accountType || 'user');
            localStorage.setItem('platePalEstablishmentId', user.establishmentId ? String(user.establishmentId) : '');

            let remembered = {};
            const remRaw = localStorage.getItem('platepalRemembered');
            if (remRaw) {
                try { remembered = JSON.parse(remRaw) || {}; } catch(e) { remembered = {}; }
            }

            if (rememberMe) {
                remembered[username] = password; 
            } else {
                delete remembered[username];
            }
            localStorage.setItem('platepalRemembered', JSON.stringify(remembered));

            // Clear form fields
            document.getElementById('loginForm').reset();
            
            showToast('Login successful! Redirecting...');
            setTimeout(() => {
                window.location.href = 'PlatePal_Main.html';
            }, 800);
        } else {
            showDialog({
                title: 'Login Failed',
                message: data.message || 'Invalid username or password.',
                tone: 'danger'
            });
        }
    })
    .catch(err => {
        console.error('Login error:', err);
        showDialog({
            title: 'Login Failed',
            message: 'Login failed. Please try again.',
            tone: 'danger'
        });
    });
}

function tryAutofillPassword() {
    const username = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password');
    const rememberCheckbox = document.getElementById('rememberMe');
    if (!username) return;

    const remRaw = localStorage.getItem('platepalRemembered');
    if (!remRaw) return;

    try {
        const remembered = JSON.parse(remRaw) || {};
        if (remembered[username]) {
            passwordInput.value = remembered[username];
            rememberCheckbox.checked = true;
        } else {

        }
    } catch (e) {
        console.error('Error parsing platepalRemembered:', e, remRaw);
    }
}

function migrateLegacyUser() {
    const legacy = localStorage.getItem('platepalUser');
    if (!legacy) return;

    const existing = localStorage.getItem('platepalAccounts');
    if (existing) return;

    try {
        const u = JSON.parse(legacy);
        if (u && u.username) {
            const accounts = {};
            accounts[u.username] = { password: u.password || '', description: u.description || '', avatar: u.avatar || '' };
            localStorage.setItem('platepalAccounts', JSON.stringify(accounts));
            const rememberedUser = localStorage.getItem('rememberedUser');
            if (rememberedUser === u.username) {
                const rem = {};
                rem[u.username] = u.password || '';
                localStorage.setItem('platepalRemembered', JSON.stringify(rem));
            }
            localStorage.removeItem('platepalUser');
            localStorage.removeItem('rememberedUser');
            console.log('Migrated legacy platepalUser to platepalAccounts');
        }
    } catch (e) {
        console.error('Failed to migrate legacy user:', e, legacy);
    }
}
