// CISA KEV Dashboard JavaScript

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

function renderTableError(message) {
    const tbody = document.getElementById('main-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.textContent = message;
    row.appendChild(cell);
    tbody.appendChild(row);
    setStatusMessage(message);
}

function addTextCell(row, value) {
    const cell = document.createElement('td');
    cell.textContent = value ?? '';
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
    const marker = document.createElement('span');
    const label = document.createElement('span');
    const normalized = value || 'Unknown';

    badge.className = 'ransomware-badge ransomware-pill';
    marker.className = 'ransomware-marker';
    if (normalized === 'Known') {
        badge.classList.add('ransomware-known', 'ransomware-known-pill');
        marker.textContent = '!';
    } else {
        badge.classList.add('ransomware-unknown', 'ransomware-unknown-tag');
        marker.textContent = '?';
    }

    label.textContent = normalized;
    badge.appendChild(marker);
    badge.appendChild(label);

    cell.appendChild(badge);
    row.appendChild(cell);
}

function setStatusMessage(message) {
    const status = document.getElementById('main-status');
    if (!status) return;
    status.textContent = message;
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
    cell.colSpan = 7;

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

                addTextCell(row, vulnerability.cveID);
                addTextCell(row, vulnerability.vulnerabilityName);
                addTextCell(row, vulnerability.vendorProject);
                addTextCell(row, vulnerability.product);
                addDateCell(row, dateAdded, describeDateAdded(dateAdded));
                addDateCell(row, dueDate, describeDueDate(dueDate));
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

    const todayStr = formatLocalDate(today);
    const twoWeeksStr = formatLocalDate(twoWeeksFromNow);
    const thirtyDaysAgoStr = formatLocalDate(thirtyDaysAgo);

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

    let currentPage = 1;
    let sortColumn = null;
    let sortDirection = 'asc';
    let currentVisibleRows = rows;

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            currentPage = 1;
            updateTable();
        });
    }
    if (perPageSelect) {
        perPageSelect.addEventListener('change', function() {
            currentPage = 1;
            updateTable();
        });
    }
    if (viewSelector) {
        viewSelector.addEventListener('change', function() {
            currentPage = 1;
            updateTable();
            updateViewDesc();
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
    headers.forEach((header, columnIndex) => {
        header.setAttribute('data-original-text', header.textContent);
        header.setAttribute('data-sortable', 'true');
        header.style.cursor = 'pointer';

        header.addEventListener('click', function() {
            if (sortColumn === columnIndex) {
                sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                sortColumn = columnIndex;
                sortDirection = 'asc';
            }

            headers.forEach(h => {
                h.textContent = h.getAttribute('data-original-text');
            });

            header.textContent = header.getAttribute('data-original-text') + (sortDirection === 'asc' ? ' ▲' : ' ▼');
            currentPage = 1;
            updateTable();
        });
    });

    const exportBtn = document.getElementById('main-export-filtered');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            exportToCSV('main', table, currentVisibleRows);
        });
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
        const thirtyDaysAgoStr = formatLocalDate(thirtyDaysAgo);

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

        if (sortColumn !== null) {
            visibleRows.sort((a, b) => {
                if (sortColumn === 4 || sortColumn === 5) {
                    const valueA = sortColumn === 4 ? (a.dataset.dateAdded || '') : (a.dataset.dueDate || '');
                    const valueB = sortColumn === 4 ? (b.dataset.dateAdded || '') : (b.dataset.dueDate || '');
                    return sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
                }

                if (sortColumn === 6) {
                    const valueA = a.dataset.ransomware || '';
                    const valueB = b.dataset.ransomware || '';
                    return sortDirection === 'asc' ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
                }

                const cellA = a.cells[sortColumn].textContent.trim();
                const cellB = b.cells[sortColumn].textContent.trim();
                return sortDirection === 'asc' ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
            });
        }

        currentVisibleRows = visibleRows;

        const totalVisible = visibleRows.length;
        const pageCount = Math.ceil(totalVisible / perPage);
        if (currentPage > pageCount) {
            currentPage = Math.max(1, pageCount);
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
            const inPage = idx >= (currentPage - 1) * perPage && idx < currentPage * perPage;
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
            const start = Math.max(2, currentPage - 2);
            const end = Math.min(pageCount - 1, currentPage + 2);

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
                    if (p === currentPage) button.style.fontWeight = 'bold';
                    button.addEventListener('click', function() {
                        currentPage = p;
                        updateTable();
                    });
                    fragment.appendChild(button);
                }
            });
        } else {
            for (let i = 1; i <= pageCount; i++) {
                const button = document.createElement('button');
                button.textContent = i;
                if (i === currentPage) button.style.fontWeight = 'bold';
                button.addEventListener('click', function() {
                    currentPage = i;
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
            row.cells[0].textContent.trim(),
            row.cells[1].textContent.trim(),
            row.cells[2].textContent.trim(),
            row.cells[3].textContent.trim(),
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

    const date = formatLocalDate(new Date());
    link.setAttribute('download', `CISA-${sectionName}-${date}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);

    link.click();
    document.body.removeChild(link);

    setStatusMessage(`Export complete: CISA-${sectionName}-${date}.csv`);
}
