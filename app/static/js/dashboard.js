// CISA KEV Dashboard JavaScript

const CONFIG = window.KevDashboardConfig || {};
const DATE = window.KevDashboardDate || {};
const TOAST = window.KevDashboardToast || {};

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

function renderTableError(message) {
    const tbody = document.getElementById('main-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = COLUMNS.length || 7;
    cell.textContent = message;
    row.appendChild(cell);
    tbody.appendChild(row);
    if (TOAST.setStatusMessage) TOAST.setStatusMessage(message);
}

function addTextCell(row, value) {
    const cell = document.createElement('td');
    cell.textContent = value ?? '';
    row.appendChild(cell);
}

function addCveCell(row, value) {
    const cell = document.createElement('td');
    const cveText = value || '';
    const trigger = document.createElement('span');
    trigger.className = 'cve-copy';
    trigger.textContent = cveText;
    trigger.title = cveText ? 'Click to copy CVE ID' : '';
    trigger.tabIndex = 0;

    function copyCve(event) {
        event.stopPropagation();
        if (!cveText) return;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(cveText)
                .then(() => {
                    if (TOAST.setStatusMessage) TOAST.setStatusMessage(`Copied ${cveText}`);
                    if (TOAST.showCopyToast) TOAST.showCopyToast(`Copied ${cveText}`, 'success');
                })
                .catch(() => {
                    if (TOAST.setStatusMessage) TOAST.setStatusMessage('Unable to copy CVE ID');
                    if (TOAST.showCopyToast) TOAST.showCopyToast('Unable to copy CVE ID', 'error');
                });
            return;
        }
        if (TOAST.setStatusMessage) TOAST.setStatusMessage('Clipboard not available');
        if (TOAST.showCopyToast) TOAST.showCopyToast('Clipboard not available', 'error');
    }

    trigger.addEventListener('click', copyCve);
    trigger.addEventListener('keydown', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        copyCve(event);
    });

    cell.appendChild(trigger);
    row.appendChild(cell);
}

function addDateCell(row, value, subtext) {
    const cell = document.createElement('td');
    const main = document.createElement('div');
    main.className = 'cell-main';
    main.textContent = value ?? '';

    cell.appendChild(main);
    if (subtext) {
        const meta = document.createElement('div');
        meta.className = 'cell-subtext';
        meta.textContent = subtext;
        cell.appendChild(meta);
    }

    row.appendChild(cell);
}

function addRansomwareCell(row, value) {
    const cell = document.createElement('td');
    cell.className = 'ransomware-cell';
    const badge = document.createElement('span');
    const normalized = value || 'Unknown';

    badge.className = 'ransomware-badge ransomware-pill';
    if (normalized === 'Known') {
        badge.classList.add('ransomware-known');
    } else {
        badge.classList.add('ransomware-unknown');
    }

    badge.textContent = normalized;

    cell.appendChild(badge);
    row.appendChild(cell);
}

function uniqueLinks(cveId, notes) {
    const links = [];
    const seen = new Set();

    const addLink = (url, label) => {
        if (!url || seen.has(url)) return;
        seen.add(url);
        links.push({ url, label });
    };

    if (cveId) {
        addLink(`https://www.cve.org/CVERecord?id=${encodeURIComponent(cveId)}`, 'CVE Record');
        addLink(`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`, 'NVD Entry');
    }

    const urls = (notes || '').match(/https?:\/\/[^\s;]+/g) || [];
    urls.forEach((url, index) => addLink(url, `Reference ${index + 1}`));

    return links;
}

function extractPlainNotes(notes) {
    if (!notes) return '';
    return notes
        .replace(/https?:\/\/[^\s;]+/g, '')
        .replace(/\s*;\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildDetailRow(vulnerability, rowId) {
    const detailsRow = document.createElement('tr');
    detailsRow.className = 'details-row';
    detailsRow.dataset.parentId = rowId;
    detailsRow.style.display = 'none';

    const cell = document.createElement('td');
    cell.colSpan = COLUMNS.length || 7;

    const content = document.createElement('div');
    content.className = 'details-content';

    const summary = document.createElement('div');
    summary.className = 'details-section';
    const summaryTitle = document.createElement('strong');
    summaryTitle.textContent = 'Summary: ';
    summary.appendChild(summaryTitle);
    summary.appendChild(document.createTextNode(vulnerability.shortDescription || 'No summary available.'));
    content.appendChild(summary);

    const action = document.createElement('div');
    action.className = 'details-section';
    const actionTitle = document.createElement('strong');
    actionTitle.textContent = 'Required Action: ';
    action.appendChild(actionTitle);
    action.appendChild(document.createTextNode(vulnerability.requiredAction || 'No required action provided.'));
    content.appendChild(action);

    const notesText = extractPlainNotes(vulnerability.notes);
    if (notesText) {
        const notes = document.createElement('div');
        notes.className = 'details-section';
        const notesTitle = document.createElement('strong');
        notesTitle.textContent = 'Notes: ';
        notes.appendChild(notesTitle);
        notes.appendChild(document.createTextNode(notesText));
        content.appendChild(notes);
    }

    if (Array.isArray(vulnerability.cwes) && vulnerability.cwes.length > 0) {
        const cwes = document.createElement('div');
        cwes.className = 'details-section';
        const cwesTitle = document.createElement('strong');
        cwesTitle.textContent = 'CWEs: ';
        cwes.appendChild(cwesTitle);
        cwes.appendChild(document.createTextNode(vulnerability.cwes.join(', ')));
        content.appendChild(cwes);
    }

    const links = uniqueLinks(vulnerability.cveID, vulnerability.notes);
    if (links.length > 0) {
        const linkSection = document.createElement('div');
        linkSection.className = 'details-section';
        const linksTitle = document.createElement('strong');
        linksTitle.textContent = 'Links: ';
        linkSection.appendChild(linksTitle);

        links.forEach((item, index) => {
            const anchor = document.createElement('a');
            anchor.href = item.url;
            anchor.target = '_blank';
            anchor.rel = 'noopener noreferrer';
            anchor.textContent = item.label;
            linkSection.appendChild(anchor);
            if (index < links.length - 1) {
                linkSection.appendChild(document.createTextNode(' | '));
            }
        });

        content.appendChild(linkSection);
    }

    cell.appendChild(content);
    detailsRow.appendChild(cell);
    return detailsRow;
}

function toggleDetailRow(row, detailsRow) {
    const expanded = row.getAttribute('aria-expanded') === 'true';
    const transitionMs = 170;

    if (expanded) {
        row.setAttribute('aria-expanded', 'false');
        row.classList.remove('expanded');
        detailsRow.classList.remove('details-visible');
        window.setTimeout(function() {
            if (row.getAttribute('aria-expanded') === 'false') {
                detailsRow.style.display = 'none';
            }
        }, transitionMs);
        return;
    }

    row.setAttribute('aria-expanded', 'true');
    row.classList.add('expanded');
    detailsRow.style.display = '';
    // Ensure transition triggers on first open.
    window.requestAnimationFrame(function() {
        detailsRow.classList.add('details-visible');
    });
}

function applyColumnVisibility(table, visibility) {
    const allRows = table.querySelectorAll('tr');
    const visibleCount = Object.values(visibility).filter(Boolean).length || 1;

    allRows.forEach(row => {
        if (row.classList.contains('details-row')) {
            const detailsCell = row.cells[COL_IDX.cve] || row.cells[0];
            if (detailsCell) detailsCell.colSpan = visibleCount;
            return;
        }

        Array.from(row.cells).forEach((cell, idx) => {
            cell.style.display = visibility[idx] === false ? 'none' : '';
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    fetch('./known_exploited_vulnerabilities.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load KEV data (${response.status})`);
            }
            return response.json();
        })
        .then(data => {
            const tbody = document.getElementById('main-table-body');
            if (!tbody) return;

            const vulnerabilities = Array.isArray(data.vulnerabilities) ? data.vulnerabilities : [];
            tbody.innerHTML = '';

            vulnerabilities.forEach((vulnerability, index) => {
                const row = document.createElement('tr');
                row.classList.add('data-row');
                row.tabIndex = 0;
                row.setAttribute('role', 'button');
                row.setAttribute('aria-expanded', 'false');
                row.setAttribute('aria-label', `Toggle details for ${vulnerability.cveID || 'vulnerability'}`);

                const rowId = String(index);
                const dateAdded = vulnerability.dateAdded || '';
                const dueDate = vulnerability.dueDate || '';
                const ransomwareUse = vulnerability.knownRansomwareCampaignUse || 'Unknown';

                row.dataset.rowId = rowId;
                row.dataset.dateAdded = dateAdded;
                row.dataset.dueDate = dueDate;
                row.dataset.ransomware = ransomwareUse;

                if (ransomwareUse === 'Known') {
                    row.classList.add('high-priority');
                }

                addCveCell(row, vulnerability.cveID);
                addTextCell(row, vulnerability.vulnerabilityName);
                addTextCell(row, vulnerability.vendorProject);
                addTextCell(row, vulnerability.product);
                addDateCell(row, dateAdded, DATE.describeDateAdded ? DATE.describeDateAdded(dateAdded) : '');
                addDateCell(row, dueDate, DATE.describeDueDate ? DATE.describeDueDate(dueDate) : '');
                addRansomwareCell(row, ransomwareUse);

                const detailsRow = buildDetailRow(vulnerability, rowId);

                row.addEventListener('click', function(event) {
                    if (event.target.closest('a')) return;
                    toggleDetailRow(row, detailsRow);
                });

                row.addEventListener('keydown', function(event) {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    toggleDetailRow(row, detailsRow);
                });

                tbody.appendChild(row);
                tbody.appendChild(detailsRow);
            });

            initMainTableControls();
            highlightDueDates();
        })
        .catch(error => {
            console.error(error);
            renderTableError('Unable to load KEV data. Please refresh or try again later.');
        });
});

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
                applyColumnVisibility(table, state.columnVisibility);
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
            applyColumnVisibility(table, state.columnVisibility);
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
            exportToCSV('main', table, state.currentVisibleRows);
        });
    }

    if (viewSelector && viewSelector.value === 'high') {
        state.sortColumn = COL_IDX.dueDate;
        state.sortDirection = 'asc';
        renderSortIndicators();
    }

    applyColumnVisibility(table, state.columnVisibility);
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
        const pageCount = Math.ceil(totalVisible / perPage);
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

function exportToCSV(section, table, rows) {
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

    if (TOAST.setStatusMessage) {
        TOAST.setStatusMessage(`Export complete: CISA-${sectionName}-${date}.csv`);
    }
}
