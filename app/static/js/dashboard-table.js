(function() {
    const CONFIG = window.KevDashboardConfig || {};
    const DATE = window.KevDashboardDate || {};
    const DOM = window.KevDashboardDom || {};

    const COLUMNS = CONFIG.columns || [];
    const COL = CONFIG.columnIndex || {};
    const COL_IDX = {
        cve: COL.cve ?? 0,
        name: COL.name ?? 1,
        vendor: COL.vendor ?? 2,
        product: COL.product ?? 3,
        dateAdded: COL.dateAdded ?? 4,
        dueDate: COL.dueDate ?? 5,
        ransomware: COL.ransomware ?? 6,
    };
    const SETTINGS_KEY = CONFIG.settingsKey || 'kevDashboardSettingsV1';
    const DEFAULT_COLUMN_VISIBILITY = CONFIG.defaultColumnVisibility || {
        0: true,
        1: true,
        2: true,
        3: true,
        4: true,
        5: true,
        6: true,
    };

    function loadDashboardSettings() {
        try {
            const raw = window.localStorage.getItem(SETTINGS_KEY);
            if (!raw) return {};
            return JSON.parse(raw) || {};
        } catch {
            return {};
        }
    }

    function saveDashboardSettings(partial) {
        try {
            const current = loadDashboardSettings();
            const next = { ...current, ...partial };
            window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
        } catch {
            // Ignore localStorage failures.
        }
    }

    function highlightDueDates() {
        const today = new Date();
        const twoWeeksFromNow = new Date(today);
        twoWeeksFromNow.setDate(today.getDate() + 14);
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);

        const todayStr = DATE.formatLocalDate ? DATE.formatLocalDate(today) : '';
        const twoWeeksStr = DATE.formatLocalDate ? DATE.formatLocalDate(twoWeeksFromNow) : '';
        const thirtyDaysAgoStr = DATE.formatLocalDate ? DATE.formatLocalDate(thirtyDaysAgo) : '';

        const table = document.getElementById('main-table');
        if (!table) return;

        const rows = table.querySelectorAll('tbody tr.data-row');
        rows.forEach(row => {
            row.classList.remove('recent', 'due-date-past', 'due-date-soon');

            const dueDateText = row.dataset.dueDate || '';
            const dateAddedText = row.dataset.dateAdded || '';

            if (dateAddedText && dateAddedText >= thirtyDaysAgoStr) {
                row.classList.add('recent');
            }

            if (dueDateText) {
                if (dueDateText < todayStr) {
                    row.classList.add('due-date-past');
                } else if (dueDateText <= twoWeeksStr) {
                    row.classList.add('due-date-soon');
                }
            }
        });
    }

    function ensureNoResultsRow(tbody) {
        let row = tbody.querySelector('tr.no-results-row');
        if (!row) {
            row = document.createElement('tr');
            row.className = 'no-results-row';
            row.style.display = 'none';

            const cell = document.createElement('td');
            cell.className = 'no-results-cell';
            row.appendChild(cell);
            tbody.appendChild(row);
        }
        return row;
    }

    function updateNoResultsRow(tbody, columnVisibility, shouldShow, message) {
        const row = ensureNoResultsRow(tbody);
        const cell = row.cells[0];
        const visibleCount = Object.values(columnVisibility).filter(Boolean).length || 1;

        cell.colSpan = visibleCount;
        cell.textContent = message;
        row.style.display = shouldShow ? '' : 'none';
    }

    function noResultsMessage(filterText, viewValue) {
        if (filterText) {
            return 'No vulnerabilities match your current search and filters.';
        }
        if (viewValue === 'high') {
            return 'No vulnerabilities match the High Priority filter right now.';
        }
        if (viewValue === 'recent') {
            return 'No vulnerabilities have been added in the last 30 days.';
        }
        return 'No vulnerabilities available right now.';
    }

    function initMainTableControls() {
        const table = document.getElementById('main-table');
        if (!table) return;

        const tbody = table.querySelector('tbody');
        const rows = Array.from(tbody.querySelectorAll('tr.data-row'));
        const searchInput = document.getElementById('main-search');
        const perPageSelect = document.getElementById('main-per-page');
        const pagination = document.getElementById('main-pagination');
        const viewSelector = document.getElementById('view-selector');
        const viewDesc = document.getElementById('view-desc');
        const columnOptionsList = document.getElementById('column-options-list');
        const resetColumnsBtn = document.getElementById('reset-columns');
        const loadedSettings = loadDashboardSettings();

        const state = {
            currentPage: 1,
            sortColumn: null,
            sortDirection: 'asc',
            currentVisibleRows: rows,
            columnVisibility: { ...DEFAULT_COLUMN_VISIBILITY, ...(loadedSettings.columns || {}) },
        };
        let columnCheckboxes = [];

        if (searchInput && typeof loadedSettings.search === 'string') {
            searchInput.value = loadedSettings.search;
        }
        if (
            perPageSelect &&
            loadedSettings.perPage &&
            perPageSelect.querySelector(`option[value="${loadedSettings.perPage}"]`)
        ) {
            perPageSelect.value = loadedSettings.perPage;
        }
        if (
            viewSelector &&
            loadedSettings.view &&
            viewSelector.querySelector(`option[value="${loadedSettings.view}"]`)
        ) {
            viewSelector.value = loadedSettings.view;
        }

        if (columnOptionsList) {
            const fragment = document.createDocumentFragment();
            COLUMNS.forEach(column => {
                const label = document.createElement('label');
                const input = document.createElement('input');
                input.className = 'column-toggle';
                input.type = 'checkbox';
                input.dataset.col = String(column.index);
                input.checked = state.columnVisibility[column.index] !== false;
                label.appendChild(input);
                label.appendChild(document.createTextNode(` ${column.label}`));
                fragment.appendChild(label);
            });
            columnOptionsList.innerHTML = '';
            columnOptionsList.appendChild(fragment);
        }
        columnCheckboxes = Array.from(document.querySelectorAll('.column-toggle'));

        if (searchInput) {
            searchInput.addEventListener('input', function() {
                state.currentPage = 1;
                saveDashboardSettings({ search: searchInput.value });
                updateTable();
            });
        }
        if (perPageSelect) {
            perPageSelect.addEventListener('change', function() {
                state.currentPage = 1;
                saveDashboardSettings({ perPage: perPageSelect.value });
                updateTable();
            });
        }
        if (viewSelector) {
            viewSelector.addEventListener('change', function() {
                saveDashboardSettings({ view: viewSelector.value });
                if (viewSelector.value === 'high' && state.sortColumn === null) {
                    state.sortColumn = COL_IDX.dueDate;
                    state.sortDirection = 'asc';
                    renderSortIndicators();
                }
                state.currentPage = 1;
                updateTable();
                updateViewDesc();
            });
        }

        if (columnCheckboxes.length > 0) {
            columnCheckboxes.forEach(checkbox => {
                const index = Number(checkbox.dataset.col);
                checkbox.checked = state.columnVisibility[index] !== false;
                checkbox.addEventListener('change', function() {
                    state.columnVisibility[index] = checkbox.checked;
                    if (DOM.applyColumnVisibility) {
                        DOM.applyColumnVisibility(table, state.columnVisibility);
                    }
                    saveDashboardSettings({ columns: state.columnVisibility });
                });
            });
        }

        if (resetColumnsBtn) {
            resetColumnsBtn.addEventListener('click', function() {
                state.columnVisibility = { ...DEFAULT_COLUMN_VISIBILITY };
                columnCheckboxes.forEach(checkbox => {
                    const index = Number(checkbox.dataset.col);
                    checkbox.checked = state.columnVisibility[index];
                });
                if (DOM.applyColumnVisibility) {
                    DOM.applyColumnVisibility(table, state.columnVisibility);
                }
                saveDashboardSettings({ columns: state.columnVisibility });
            });
        }

        updateViewDesc();

        function updateViewDesc() {
            if (!viewDesc || !viewSelector) return;
            const viewValue = viewSelector.value;
            let heading = '';
            let description = '';

            if (viewValue === 'recent') {
                heading = 'Recently Added:';
                description = ' Showing vulnerabilities added in the last 30 days.';
            } else if (viewValue === 'high') {
                heading = 'High Priority:';
                description = ' Showing vulnerabilities known to be used in ransomware campaigns.';
            } else {
                heading = 'All Vulnerabilities:';
                description = ' Showing the full CISA KEV catalog.';
            }

            viewDesc.textContent = '';
            const strong = document.createElement('strong');
            strong.textContent = heading;
            viewDesc.appendChild(strong);
            viewDesc.appendChild(document.createTextNode(description));
        }

        const headers = table.querySelectorAll('thead th');
        function renderSortIndicators() {
            headers.forEach(h => {
                h.textContent = h.getAttribute('data-original-text');
            });
            if (state.sortColumn === null) return;
            const activeHeader = headers[state.sortColumn];
            if (!activeHeader) return;
            activeHeader.textContent =
                activeHeader.getAttribute('data-original-text') +
                (state.sortDirection === 'asc' ? ' ▲' : ' ▼');
        }

        headers.forEach((header, columnIndex) => {
            header.setAttribute('data-original-text', header.textContent);
            header.setAttribute('data-sortable', 'true');
            header.style.cursor = 'pointer';

            header.addEventListener('click', function() {
                if (state.sortColumn === columnIndex) {
                    state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sortColumn = columnIndex;
                    state.sortDirection = 'asc';
                }
                renderSortIndicators();
                state.currentPage = 1;
                updateTable();
            });
        });

        const exportBtn = document.getElementById('main-export-filtered');
        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                exportToCSV(table, state.currentVisibleRows);
            });
        }

        if (viewSelector && viewSelector.value === 'high') {
            state.sortColumn = COL_IDX.dueDate;
            state.sortDirection = 'asc';
            renderSortIndicators();
        }

        if (DOM.applyColumnVisibility) {
            DOM.applyColumnVisibility(table, state.columnVisibility);
        }
        updateTable();

        function updateTable() {
            const filterText = searchInput ? searchInput.value.toLowerCase() : '';
            const perPageValue = perPageSelect ? perPageSelect.value : '25';
            const perPage = perPageValue.toLowerCase() === 'all' ? rows.length : parseInt(perPageValue, 10);
            const viewValue = viewSelector ? viewSelector.value : 'recent';
            const today = new Date();
            const thirtyDaysAgo = new Date(today);
            thirtyDaysAgo.setDate(today.getDate() - 30);
            const thirtyDaysAgoStr = DATE.formatLocalDate ? DATE.formatLocalDate(thirtyDaysAgo) : '';

            let visibleRows = rows.filter(row => {
                const dateAdded = row.dataset.dateAdded || '';
                const ransomware = row.dataset.ransomware || '';
                if (viewValue === 'recent') {
                    return dateAdded >= thirtyDaysAgoStr;
                }
                if (viewValue === 'high') {
                    return ransomware === 'Known';
                }
                return true;
            });

            if (filterText) {
                visibleRows = visibleRows.filter(row => {
                    const detailsRow = row.nextElementSibling;
                    const detailsText = detailsRow && detailsRow.classList.contains('details-row') ? detailsRow.textContent : '';
                    return (row.textContent + ' ' + detailsText).toLowerCase().includes(filterText);
                });
            }

            if (state.sortColumn !== null) {
                visibleRows.sort((a, b) => {
                    if (state.sortColumn === COL_IDX.dateAdded || state.sortColumn === COL_IDX.dueDate) {
                        const valueA =
                            state.sortColumn === COL_IDX.dateAdded ? (a.dataset.dateAdded || '') : (a.dataset.dueDate || '');
                        const valueB =
                            state.sortColumn === COL_IDX.dateAdded ? (b.dataset.dateAdded || '') : (b.dataset.dueDate || '');
                        return state.sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
                    }

                    if (state.sortColumn === COL_IDX.ransomware) {
                        const valueA = a.dataset.ransomware || '';
                        const valueB = b.dataset.ransomware || '';
                        return state.sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
                    }

                    const cellA = a.cells[state.sortColumn].textContent.trim();
                    const cellB = b.cells[state.sortColumn].textContent.trim();
                    return state.sortDirection === 'asc' ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
                });
            }

            state.currentVisibleRows = visibleRows;

            const totalVisible = visibleRows.length;
            const pageCount = perPage > 0 ? Math.ceil(totalVisible / perPage) : 0;
            if (state.currentPage > pageCount) {
                state.currentPage = Math.max(1, pageCount);
            }

            rows.forEach(row => {
                row.style.display = 'none';
                const detailsRow = row.nextElementSibling;
                if (detailsRow && detailsRow.classList.contains('details-row')) {
                    detailsRow.style.display = 'none';
                    detailsRow.classList.remove('details-visible');
                }
            });

            visibleRows.forEach((row, idx) => {
                const inPage = idx >= (state.currentPage - 1) * perPage && idx < state.currentPage * perPage;
                if (!inPage) return;

                row.style.display = '';
                const detailsRow = row.nextElementSibling;
                if (detailsRow && detailsRow.classList.contains('details-row') && row.getAttribute('aria-expanded') === 'true') {
                    detailsRow.style.display = '';
                    detailsRow.classList.add('details-visible');
                }
            });

            updateNoResultsRow(tbody, state.columnVisibility, totalVisible === 0, noResultsMessage(filterText, viewValue));
            if (DOM.applyColumnVisibility) {
                DOM.applyColumnVisibility(table, state.columnVisibility);
            }

            updatePagination(pageCount);
            highlightDueDates();
        }

        function updatePagination(pageCount) {
            pagination.innerHTML = '';
            if (pageCount <= 1) return;

            const maxButtons = 7;
            const fragment = document.createDocumentFragment();

            if (pageCount > maxButtons) {
                const pages = [1];
                const start = Math.max(2, state.currentPage - 2);
                const end = Math.min(pageCount - 1, state.currentPage + 2);

                if (start > 2) pages.push('...');
                for (let i = start; i <= end; i++) pages.push(i);
                if (end < pageCount - 1) pages.push('...');
                pages.push(pageCount);

                pages.forEach(p => {
                    if (p === '...') {
                        const span = document.createElement('span');
                        span.textContent = '...';
                        span.style.margin = '0 4px';
                        fragment.appendChild(span);
                    } else {
                        const button = document.createElement('button');
                        button.textContent = p;
                        if (p === state.currentPage) button.style.fontWeight = 'bold';
                        button.addEventListener('click', function() {
                            state.currentPage = p;
                            updateTable();
                        });
                        fragment.appendChild(button);
                    }
                });
            } else {
                for (let i = 1; i <= pageCount; i++) {
                    const button = document.createElement('button');
                    button.textContent = i;
                    if (i === state.currentPage) button.style.fontWeight = 'bold';
                    button.addEventListener('click', function() {
                        state.currentPage = i;
                        updateTable();
                    });
                    fragment.appendChild(button);
                    if (i < pageCount) fragment.appendChild(document.createTextNode(' '));
                }
            }

            pagination.appendChild(fragment);
        }
    }

    function exportToCSV(table, rows) {
        const headers = Array.from(table.querySelectorAll('thead th'))
            .map(th => `"${th.textContent.replace(/"/g, '""')}"`);

        let csvContent = headers.join(',') + '\n';

        rows.forEach(row => {
            const rowData = [
                row.cells[COL_IDX.cve].textContent.trim(),
                row.cells[COL_IDX.name].textContent.trim(),
                row.cells[COL_IDX.vendor].textContent.trim(),
                row.cells[COL_IDX.product].textContent.trim(),
                row.dataset.dateAdded || '',
                row.dataset.dueDate || '',
                row.dataset.ransomware || '',
            ].map(value => `"${String(value).replace(/"/g, '""')}"`);

            csvContent += rowData.join(',') + '\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);

        let sectionName = 'KEVs';
        const viewSelector = document.getElementById('view-selector');
        if (viewSelector) {
            const viewValue = viewSelector.value;
            if (viewValue === 'recent') {
                sectionName = 'Recently-Added-KEVs';
            } else if (viewValue === 'high') {
                sectionName = 'High-Priority-KEVs';
            } else {
                sectionName = 'All-KEVs';
            }
        }

        const date = DATE.formatLocalDate ? DATE.formatLocalDate(new Date()) : '';
        link.setAttribute('download', `CISA-${sectionName}-${date}.csv`);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    window.KevDashboardTable = Object.freeze({
        highlightDueDates,
        initMainTableControls,
    });
})();
