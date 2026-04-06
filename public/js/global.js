function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);

    setTimeout(() => {
        if (document.body.contains(toast)) {
            document.body.removeChild(toast);
        }
    }, 3000);
}

function ensureDialogHost() {
    let host = document.getElementById('globalDialogHost');
    if (!host) {
        host = document.createElement('div');
        host.id = 'globalDialogHost';
        host.className = 'global-dialog-host';
        host.style.display = 'none';
        document.body.appendChild(host);
    }
    return host;
}

function showDialog(options) {
    const opts = options || {};
    const title = opts.title || 'Notice';
    const message = opts.message || '';
    const okText = opts.okText || 'OK';
    const toneClass = opts.tone === 'danger' ? 'global-dialog-btn-danger' : '';

    const host = ensureDialogHost();
    host.innerHTML = `
        <div class="global-dialog-backdrop" data-role="dialog-backdrop">
            <div class="global-dialog" role="dialog" aria-modal="true" aria-labelledby="globalDialogTitle">
                <h3 id="globalDialogTitle">${title}</h3>
                <p>${message}</p>
                <div class="global-dialog-actions">
                    <button id="globalDialogOk" class="${toneClass}">${okText}</button>
                </div>
            </div>
        </div>
    `;
    host.style.display = 'block';

    const cleanup = function () {
        host.style.display = 'none';
        host.innerHTML = '';
    };

    const okBtn = document.getElementById('globalDialogOk');
    if (okBtn) {
        okBtn.addEventListener('click', cleanup, { once: true });
    }

    const backdrop = host.querySelector('[data-role="dialog-backdrop"]');
    if (backdrop) {
        backdrop.addEventListener('click', function (event) {
            if (event.target === backdrop) {
                cleanup();
            }
        }, { once: true });
    }
}

function showConfirmDialog(options) {
    const opts = options || {};
    const title = opts.title || 'Confirm';
    const message = opts.message || '';
    const confirmText = opts.confirmText || 'Confirm';
    const cancelText = opts.cancelText || 'Cancel';
    const toneClass = opts.tone === 'danger' ? 'global-dialog-btn-danger' : '';

    return new Promise(function (resolve) {
        const host = ensureDialogHost();
        host.innerHTML = `
            <div class="global-dialog-backdrop" data-role="dialog-backdrop">
                <div class="global-dialog" role="dialog" aria-modal="true" aria-labelledby="globalConfirmTitle">
                    <h3 id="globalConfirmTitle">${title}</h3>
                    <p>${message}</p>
                    <div class="global-dialog-actions">
                        <button id="globalConfirmCancel" class="global-dialog-btn-secondary">${cancelText}</button>
                        <button id="globalConfirmOk" class="${toneClass}">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;
        host.style.display = 'block';

        const finish = function (result) {
            host.style.display = 'none';
            host.innerHTML = '';
            resolve(result);
        };

        const okBtn = document.getElementById('globalConfirmOk');
        const cancelBtn = document.getElementById('globalConfirmCancel');
        const backdrop = host.querySelector('[data-role="dialog-backdrop"]');

        if (okBtn) okBtn.addEventListener('click', function () { finish(true); }, { once: true });
        if (cancelBtn) cancelBtn.addEventListener('click', function () { finish(false); }, { once: true });
        if (backdrop) {
            backdrop.addEventListener('click', function (event) {
                if (event.target === backdrop) {
                    finish(false);
                }
            }, { once: true });
        }
    });
}

function showPromptDialog(options) {
    const opts = options || {};
    const title = opts.title || 'Input Required';
    const message = opts.message || '';
    const placeholder = opts.placeholder || '';
    const confirmText = opts.confirmText || 'Submit';
    const cancelText = opts.cancelText || 'Cancel';
    const initialValue = typeof opts.initialValue === 'string' ? opts.initialValue : '';
    const multiline = opts.multiline === true;

    return new Promise(function (resolve) {
        const host = ensureDialogHost();
        const fieldMarkup = multiline
            ? `<textarea id="globalPromptInput" class="global-dialog-input" rows="4" placeholder="${placeholder}">${initialValue}</textarea>`
            : `<input id="globalPromptInput" class="global-dialog-input" type="text" placeholder="${placeholder}" value="${initialValue}">`;

        host.innerHTML = `
            <div class="global-dialog-backdrop" data-role="dialog-backdrop">
                <div class="global-dialog" role="dialog" aria-modal="true" aria-labelledby="globalPromptTitle">
                    <h3 id="globalPromptTitle">${title}</h3>
                    <p>${message}</p>
                    ${fieldMarkup}
                    <div class="global-dialog-actions">
                        <button id="globalPromptCancel" class="global-dialog-btn-secondary">${cancelText}</button>
                        <button id="globalPromptOk">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;
        host.style.display = 'block';

        const finish = function (result) {
            host.style.display = 'none';
            host.innerHTML = '';
            resolve(result);
        };

        const inputEl = document.getElementById('globalPromptInput');
        const okBtn = document.getElementById('globalPromptOk');
        const cancelBtn = document.getElementById('globalPromptCancel');
        const backdrop = host.querySelector('[data-role="dialog-backdrop"]');

        if (inputEl) {
            inputEl.focus();
            inputEl.addEventListener('keydown', function (event) {
                if (!multiline && event.key === 'Enter') {
                    event.preventDefault();
                    finish((inputEl.value || '').trim());
                }
            });
        }

        if (okBtn) okBtn.addEventListener('click', function () {
            finish((inputEl && inputEl.value ? inputEl.value : '').trim());
        }, { once: true });
        if (cancelBtn) cancelBtn.addEventListener('click', function () { finish(null); }, { once: true });
        if (backdrop) {
            backdrop.addEventListener('click', function (event) {
                if (event.target === backdrop) {
                    finish(null);
                }
            }, { once: true });
        }
    });
}

const __liveRefreshRegistry = {};

function startLiveRefresh(key, refreshFn, intervalMs) {
    if (!key || typeof refreshFn !== 'function') {
        return;
    }

    const safeInterval = Number(intervalMs) > 0 ? Number(intervalMs) : 8000;

    if (__liveRefreshRegistry[key]) {
        clearInterval(__liveRefreshRegistry[key].intervalId);
        document.removeEventListener('visibilitychange', __liveRefreshRegistry[key].visibilityHandler);
    }

    const runRefresh = function () {
        if (document.visibilityState !== 'visible') {
            return;
        }
        Promise.resolve(refreshFn()).catch(function (err) {
            console.warn('Live refresh failed for', key, err);
        });
    };

    const visibilityHandler = function () {
        if (document.visibilityState === 'visible') {
            runRefresh();
        }
    };

    const intervalId = setInterval(runRefresh, safeInterval);
    document.addEventListener('visibilitychange', visibilityHandler);

    __liveRefreshRegistry[key] = { intervalId, visibilityHandler };
}

function stopLiveRefresh(key) {
    const item = __liveRefreshRegistry[key];
    if (!item) {
        return;
    }

    clearInterval(item.intervalId);
    document.removeEventListener('visibilitychange', item.visibilityHandler);
    delete __liveRefreshRegistry[key];
}
