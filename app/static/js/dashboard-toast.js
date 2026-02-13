(function() {
    function setStatusMessage(message) {
        const status = document.getElementById('main-status');
        if (!status) return;
        status.textContent = message;
    }

    let copyToastTimer = null;
    function showCopyToast(message, variant = 'info') {
        let toast = document.getElementById('copy-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'copy-toast';
            toast.className = 'copy-toast';
            toast.innerHTML = `
                <span class="copy-toast-icon" aria-hidden="true"></span>
                <span class="copy-toast-text"></span>
                <span class="copy-toast-progress"></span>
            `;
            document.body.appendChild(toast);
        }

        const icon = toast.querySelector('.copy-toast-icon');
        const text = toast.querySelector('.copy-toast-text');
        const progress = toast.querySelector('.copy-toast-progress');

        if (text) text.textContent = message;
        toast.classList.remove('copy-toast-success', 'copy-toast-error', 'copy-toast-info');
        toast.classList.add(`copy-toast-${variant}`);

        if (icon) {
            icon.textContent =
                variant === 'success' ? '✓' :
                variant === 'error' ? '!' : 'i';
        }

        if (progress) {
            progress.classList.remove('animating');
            void progress.offsetWidth;
            progress.classList.add('animating');
        }

        toast.classList.add('visible');
        if (copyToastTimer) window.clearTimeout(copyToastTimer);
        copyToastTimer = window.setTimeout(function() {
            toast.classList.remove('visible');
        }, 1600);
    }

    window.KevDashboardToast = Object.freeze({
        setStatusMessage,
        showCopyToast,
    });
})();
