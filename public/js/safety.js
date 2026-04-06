const currentUsername = localStorage.getItem('platePalUsername');

function getUserIdentifier() {
    const isUserLoggedIn = localStorage.getItem('platePalLoggedIn') === 'true';
    const storedUsername = localStorage.getItem('platePalUsername');
    if (isUserLoggedIn && storedUsername) {
        return storedUsername;
    }

    let guestId = localStorage.getItem('platePalGuestId');
    if (!guestId) {
        guestId = 'guest_' + Date.now();
        localStorage.setItem('platePalGuestId', guestId);
    }
    return guestId;
}

async function loadBlockedUsers() {
    const container = document.getElementById('blockedUsersList');
    const noMessage = document.getElementById('noBlockedMessage');

    if (!currentUsername) {
        container.innerHTML = '<p style="color:#666;">Please login to see your blocked users.</p>';
        noMessage.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`/api/users/${encodeURIComponent(currentUsername)}/blocked`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Unable to load blocked users');
        }

        const blockedUsers = data.blockedUsers || [];
        if (blockedUsers.length === 0) {
            container.innerHTML = '';
            noMessage.style.display = 'block';
            return;
        }

        container.innerHTML = blockedUsers.map(user => `
            <div class="item">
                <div class="user-item">
                    <div class="user-info">
                        <h3>${user.username}</h3>
                        <p>Blocked on ${new Date(user.blockedAt).toLocaleDateString()}</p>
                    </div>
                    <button class="btn btn-unblock" onclick="unblockUser('${user._id}')">Unblock</button>
                </div>
            </div>
        `).join('');
        noMessage.style.display = 'none';
    } catch (err) {
        console.error('Error loading blocked users:', err);
        container.innerHTML = '<p style="color:#c00;">Unable to load blocked users.</p>';
        noMessage.style.display = 'none';
    }
}

async function loadReportedReviews() {
    const container = document.getElementById('reportedReviewsList');
    const noMessage = document.getElementById('noReportsMessage');

    if (!currentUsername) {
        container.innerHTML = '<p style="color:#666;">Please login to see your reported reviews.</p>';
        noMessage.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`/api/users/${encodeURIComponent(currentUsername)}/reported-reviews`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Unable to load reported reviews');
        }

        const reportedReviews = data.reportedReviews || [];
        if (reportedReviews.length === 0) {
            container.innerHTML = '';
            noMessage.style.display = 'block';
            return;
        }

        container.innerHTML = reportedReviews.map(report => {
            const pendingReports = Array.isArray(report.reports)
                ? report.reports.filter(r => r.reporter === currentUsername)
                : [];
            const latestReport = pendingReports[pendingReports.length - 1] || {};
            const statusClass = latestReport.status === 'pending' ? 'status-pending' : 'status-reviewed';
            const statusText = latestReport.status === 'pending' ? 'Pending Review' : 'Reviewed';

            return `
                <div class="item">
                    <h3>${report.title || 'Review Report'}</h3>
                    <div class="report-details">
                        <strong>From:</strong> ${report.user?.username || 'Unknown'} | <strong>Establishment:</strong> ${report.establishment?.name || 'Unknown'}
                    </div>
                    <div class="report-body">
                        "${report.comment || ''}"
                    </div>
                    <div class="report-details">
                        <strong>Reason:</strong> ${latestReport.reason || 'Reported content'}<br>
                        <strong>Reported:</strong> ${latestReport.createdAt ? new Date(latestReport.createdAt).toLocaleDateString() : 'Unknown'}
                    </div>
                    <span class="report-status ${statusClass}">${statusText}</span>
                </div>
            `;
        }).join('');
        noMessage.style.display = 'none';
    } catch (err) {
        console.error('Error loading reported reviews:', err);
        container.innerHTML = '<p style="color:#c00;">Unable to load reported reviews.</p>';
        noMessage.style.display = 'none';
    }
}

async function loadReportedUsers() {
    const container = document.getElementById('reportedUsersList');
    const noMessage = document.getElementById('noReportedUsersMessage');

    if (!currentUsername) {
        container.innerHTML = '<p style="color:#666;">Please login to see your reported users.</p>';
        noMessage.style.display = 'none';
        return;
    }

    try {
        const response = await fetch(`/api/users/${encodeURIComponent(currentUsername)}/reported-users`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Unable to load reported users');
        }

        const reportedUsers = data.reportedUsers || [];
        if (reportedUsers.length === 0) {
            container.innerHTML = '';
            noMessage.style.display = 'block';
            return;
        }

        container.innerHTML = reportedUsers.map(report => {
            const reportedUsername = report.reportedUser?.username || 'Unknown';
            const statusClass = report.status === 'pending' ? 'status-pending' : 'status-reviewed';
            const statusText = report.status === 'pending' ? 'Pending Review' : 'Reviewed';
            const totalReports = Number(report.reportCount || 1);
            const latestDate = report.lastReportedAt || report.createdAt;

            return `
                <div class="item">
                    <h3>${reportedUsername}</h3>
                    <div class="report-details">
                        <strong>Total Reports:</strong> ${totalReports}<br>
                        <strong>Reason:</strong> ${report.reason || 'Inappropriate behavior'}<br>
                        <strong>Last Reported:</strong> ${latestDate ? new Date(latestDate).toLocaleDateString() : 'Unknown'}
                    </div>
                    ${report.details ? `<div class="report-body">"${report.details}"</div>` : ''}
                    <span class="report-status ${statusClass}">${statusText}</span>
                </div>
            `;
        }).join('');
        noMessage.style.display = 'none';
    } catch (err) {
        console.error('Error loading reported users:', err);
        container.innerHTML = '<p style="color:#c00;">Unable to load reported users.</p>';
        noMessage.style.display = 'none';
    }
}

async function unblockUser(id) {
    const currentUser = localStorage.getItem('platePalUsername');
    if (!currentUser) {
        showDialog({
            title: 'Login Required',
            message: 'Please login to unblock users.'
        });
        return;
    }

    const approved = await showConfirmDialog({
        title: 'Confirm Unblock',
        message: 'Are you sure you want to unblock this user?',
        confirmText: 'Unblock',
        cancelText: 'Cancel'
    });
    if (!approved) {
        return;
    }

    try {
        const response = await fetch(`/api/unblock/${id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ blockerUsername: currentUser })
        });
        const data = await response.json();
        if (response.ok && data.success) {
            showToast('User unblocked.');
            await loadBlockedUsers();
            return;
        }
        showDialog({
            title: 'Unblock Failed',
            message: 'Could not unblock user: ' + (data.error || 'Unknown error'),
            tone: 'danger'
        });
    } catch (err) {
        console.error('Error unblocking user:', err);
        showDialog({
            title: 'Unblock Failed',
            message: 'Could not unblock user.',
            tone: 'danger'
        });
    }
}

loadBlockedUsers();
loadReportedUsers();
loadReportedReviews();

if (typeof startLiveRefresh === 'function') {
    startLiveRefresh('safety-page', async function () {
        await Promise.all([
            loadBlockedUsers(),
            loadReportedUsers(),
            loadReportedReviews()
        ]);
    }, 7000);
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
