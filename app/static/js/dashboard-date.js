(function() {
    function formatLocalDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseIsoDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;
        const [year, month, day] = value.split('-').map(Number);
        return new Date(year, month - 1, day);
    }

    function startOfToday() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    function dayDiff(fromDate, toDate) {
        const msPerDay = 24 * 60 * 60 * 1000;
        return Math.round((toDate - fromDate) / msPerDay);
    }

    function describeDueDate(dueDateValue) {
        const dueDate = parseIsoDate(dueDateValue);
        if (!dueDate) return '';

        const deltaDays = dayDiff(startOfToday(), dueDate);
        if (deltaDays < 0) return `past due ${Math.abs(deltaDays)}d`;
        if (deltaDays === 0) return 'due today';
        return `in ${deltaDays}d`;
    }

    function describeDateAdded(dateAddedValue) {
        const dateAdded = parseIsoDate(dateAddedValue);
        if (!dateAdded) return '';

        const deltaDays = dayDiff(dateAdded, startOfToday());
        if (deltaDays < 0) return `adds in ${Math.abs(deltaDays)}d`;
        return `added ${deltaDays}d ago`;
    }

    window.KevDashboardDate = Object.freeze({
        formatLocalDate,
        parseIsoDate,
        startOfToday,
        dayDiff,
        describeDueDate,
        describeDateAdded,
    });
})();
