(function() {
    const CONFIG = window.KevDashboardConfig || {};
    const DATE = window.KevDashboardDate || {};
    const DOM = window.KevDashboardDom || {};

    const COLUMNS = CONFIG.columns || [];
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
    const DEFAULT_COLUMN_ORDER = COLUMNS.map(column => column.key);

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

    function normalizeColumnOrder(order) {
        if (!Array.isArray(order)) return [...DEFAULT_COLUMN_ORDER];
        const expected = new Set(DEFAULT_COLUMN_ORDER);
        const received = new Set(order);
        if (order.length !== DEFAULT_COLUMN_ORDER.length) return [...DEFAULT_COLUMN_ORDER];
        if (received.size !== expected.size) return [...DEFAULT_COLUMN_ORDER];
        for (const key of received) {
            if (!expected.has(key)) return [...DEFAULT_COLUMN_ORDER];
        }
        return [...order];
    }

    function getCellByKey(row, key) {
        return Array.from(row.cells).find(cell => cell.dataset.colKey === key) || null;
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
        const columnSettings = document.querySelector('.column-settings');
        const columnOptionsList = document.getElementById('column-options-list');
        const resetColumnsBtn = document.getElementById('reset-columns');
        const loadedSettings = loadDashboardSettings();

        const state = {
            currentPage: 1,
            sortKey: null,
            sortDirection: 'asc',
            hasManualSort: false,
            currentVisibleRows: rows,
            columnOrder: normalizeColumnOrder(loadedSettings.columnOrder),
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
        if (viewSelector) {
            viewSelector.value = 'recent';
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

        const headers = Array.from(table.querySelectorAll('thead th'));
        headers.forEach((header, columnIndex) => {
            const column = COLUMNS[columnIndex];
            if (column) {
                header.dataset.colKey = column.key;
                header.dataset.sourceIndex = String(column.index);
            }
            header.setAttribute('data-original-text', header.textContent);
            header.setAttribute('data-sortable', 'true');
            header.style.cursor = 'pointer';
            header.draggable = true;
            header.classList.add('draggable-header');
        });

        let draggingKey = null;

        function clearDragClasses() {
            headers.forEach(header => {
                header.classList.remove('drag-over');
                header.classList.remove('dragging');
            });
        }

        function moveColumnBefore(sourceKey, targetKey) {
            if (!sourceKey || !targetKey || sourceKey === targetKey) return;
            const order = [...state.columnOrder];
            const fromIndex = order.indexOf(sourceKey);
            const targetIndex = order.indexOf(targetKey);
            if (fromIndex < 0 || targetIndex < 0) return;

            order.splice(fromIndex, 1);
            const insertIndex = order.indexOf(targetKey);
            order.splice(insertIndex, 0, sourceKey);
            state.columnOrder = order;
            applyColumnOrder(state.columnOrder);
            saveDashboardSettings({ columnOrder: state.columnOrder });
        }

        function reorderCellsInRow(row, orderKeys, cellTag) {
            const cells = Array.from(row.children)
                .filter(cell => cell.tagName === cellTag.toUpperCase() && cell.dataset.colKey);
            if (cells.length === 0) return;

            const cellByKey = new Map(cells.map(cell => [cell.dataset.colKey, cell]));
            orderKeys.forEach(key => {
                const cell = cellByKey.get(key);
                if (cell) row.appendChild(cell);
            });
        }

        function applyColumnOrder(orderKeys) {
            const headerRow = table.querySelector('thead tr');
            if (headerRow) reorderCellsInRow(headerRow, orderKeys, 'th');
            rows.forEach(row => reorderCellsInRow(row, orderKeys, 'td'));
            if (DOM.applyColumnVisibility) {
                DOM.applyColumnVisibility(table, state.columnVisibility);
            }
            renderSortIndicators();
        }

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
                applyDefaultSortForView(viewSelector.value);
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
                state.columnOrder = [...DEFAULT_COLUMN_ORDER];
                columnCheckboxes.forEach(checkbox => {
                    const index = Number(checkbox.dataset.col);
                    checkbox.checked = state.columnVisibility[index];
                });
                applyColumnOrder(state.columnOrder);
                saveDashboardSettings({
                    columns: state.columnVisibility,
                    columnOrder: state.columnOrder,
                });
            });
        }

        if (columnSettings) {
            document.addEventListener('click', function(event) {
                if (!columnSettings.open) return;
                if (columnSettings.contains(event.target)) return;
                columnSettings.open = false;
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

        function renderSortIndicators() {
            headers.forEach(header => {
                header.textContent = header.getAttribute('data-original-text');
            });
            if (!state.sortKey) return;

            const activeHeader = table.querySelector(`thead th[data-col-key="${state.sortKey}"]`);
            if (!activeHeader) return;
            activeHeader.textContent =
                activeHeader.getAttribute('data-original-text') +
                (state.sortDirection === 'asc' ? ' ▲' : ' ▼');
        }

        headers.forEach(header => {
            header.addEventListener('click', function() {
                const clickedKey = header.dataset.colKey;
                if (!clickedKey) return;

                if (state.sortKey === clickedKey) {
                    state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    state.sortKey = clickedKey;
                    state.sortDirection = 'asc';
                }
                state.hasManualSort = true;
                renderSortIndicators();
                state.currentPage = 1;
                updateTable();
            });

            header.addEventListener('dragstart', function(event) {
                draggingKey = header.dataset.colKey || null;
                if (!draggingKey) return;
                header.classList.add('dragging');
                if (event.dataTransfer) {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', draggingKey);
                }
            });

            header.addEventListener('dragover', function(event) {
                if (!draggingKey) return;
                event.preventDefault();
                header.classList.add('drag-over');
            });

            header.addEventListener('dragleave', function() {
                header.classList.remove('drag-over');
            });

            header.addEventListener('drop', function(event) {
                if (!draggingKey) return;
                event.preventDefault();
                header.classList.remove('drag-over');

                const targetKey = header.dataset.colKey || null;
                const sourceKey = (event.dataTransfer && event.dataTransfer.getData('text/plain')) || draggingKey;
                moveColumnBefore(sourceKey, targetKey);
            });

            header.addEventListener('dragend', function() {
                draggingKey = null;
                clearDragClasses();
            });
        });

        const exportBtn = document.getElementById('main-export-filtered');
        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                exportToCSV(table, state.currentVisibleRows);
            });
        }

        applyColumnOrder(state.columnOrder);
        applyDefaultSortForView(viewSelector ? viewSelector.value : 'recent');
        updateTable();

        function applyDefaultSortForView(viewValue) {
            if (state.hasManualSort) return;

            if (viewValue === 'high') {
                state.sortKey = 'dueDate';
                state.sortDirection = 'asc';
                renderSortIndicators();
                return;
            }
            if (viewValue === 'recent') {
                state.sortKey = 'dateAdded';
                state.sortDirection = 'desc';
                renderSortIndicators();
                return;
            }

            state.sortKey = null;
            state.sortDirection = 'asc';
            renderSortIndicators();
        }

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

            if (state.sortKey) {
                visibleRows.sort((a, b) => {
                    if (state.sortKey === 'dateAdded' || state.sortKey === 'dueDate') {
                        const valueA = state.sortKey === 'dateAdded' ? (a.dataset.dateAdded || '') : (a.dataset.dueDate || '');
                        const valueB = state.sortKey === 'dateAdded' ? (b.dataset.dateAdded || '') : (b.dataset.dueDate || '');
                        return state.sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
                    }

                    if (state.sortKey === 'ransomware') {
                        const valueA = a.dataset.ransomware || '';
                        const valueB = b.dataset.ransomware || '';
                        return state.sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
                    }

                    const cellA = getCellByKey(a, state.sortKey);
                    const cellB = getCellByKey(b, state.sortKey);
                    const valueA = cellA ? cellA.textContent.trim() : '';
                    const valueB = cellB ? cellB.textContent.trim() : '';
                    return state.sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
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
        const visibleHeaders = Array.from(table.querySelectorAll('thead th'))
            .filter(th => th.style.display !== 'none');

        const headers = visibleHeaders.map(th => `"${th.textContent.replace(/"/g, '""')}"`);
        let csvContent = headers.join(',') + '\n';

        rows.forEach(row => {
            const rowData = visibleHeaders.map(header => {
                const key = header.dataset.colKey;
                if (key === 'dateAdded') return row.dataset.dateAdded || '';
                if (key === 'dueDate') return row.dataset.dueDate || '';
                if (key === 'ransomware') return row.dataset.ransomware || '';

                const cell = getCellByKey(row, key);
                return cell ? cell.textContent.trim() : '';
            }).map(value => `"${String(value).replace(/"/g, '""')}"`);

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
