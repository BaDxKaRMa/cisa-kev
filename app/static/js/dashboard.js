// CISA KEV Dashboard JavaScript

function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

function setStatusMessage(message) {
    const status = document.getElementById('main-status');
    if (!status) return;
    status.textContent = message;
}

document.addEventListener('DOMContentLoaded', function() {
    // Fetch JSON data and populate table, then initialize controls
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
        vulnerabilities.forEach(v => {
          const row = document.createElement('tr');
          const dateAdded = v.dateAdded ?? '';
          const ransomwareUse = v.knownRansomwareCampaignUse ?? '';

          row.setAttribute('data-date-added', dateAdded);
          row.setAttribute('data-ransomware', ransomwareUse);
          if (ransomwareUse === 'Known') {
              row.classList.add('high-priority');
          }

          addTextCell(row, v.cveID);
          addTextCell(row, v.vulnerabilityName);
          addTextCell(row, v.vendorProject);
          addTextCell(row, v.product);
          addTextCell(row, dateAdded);
          addTextCell(row, v.dueDate);
          addTextCell(row, ransomwareUse);
          tbody.appendChild(row);
        });
        setStatusMessage(`Loaded ${vulnerabilities.length} vulnerabilities.`);
        // Now initialize controls and highlighting
        initMainTableControls();
        highlightDueDates();
      })
      .catch(error => {
        console.error(error);
        renderTableError('Unable to load KEV data. Please refresh or try again later.');
      });
});

// Function to highlight rows based on dates
function highlightDueDates() {
    // Get current date
    const today = new Date();
    const twoWeeksFromNow = new Date(today);
    twoWeeksFromNow.setDate(today.getDate() + 14);
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    // Format dates as YYYY-MM-DD for comparison
    const todayStr = formatLocalDate(today);
    const twoWeeksStr = formatLocalDate(twoWeeksFromNow);
    const thirtyDaysAgoStr = formatLocalDate(thirtyDaysAgo);
    // Only process the main table
    const table = document.getElementById('main-table');
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        row.classList.remove('recent', 'due-date-past', 'due-date-soon');
        const dueDateCell = row.cells[5];
        if (!dueDateCell) return;
        const dateAddedCell = row.cells[4];
        if (!dateAddedCell) return;
        const dueDateText = dueDateCell.textContent.trim();
        const dateAddedText = dateAddedCell.textContent.trim();
        // Check if recently added (within last 30 days)
        if (dateAddedText && dateAddedText >= thirtyDaysAgoStr) {
            row.classList.add('recent');
        }
        // Check due date
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
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const searchInput = document.getElementById('main-search');
    const perPageSelect = document.getElementById('main-per-page');
    const pagination = document.getElementById('main-pagination');
    const viewSelector = document.getElementById('view-selector');
    const viewDesc = document.getElementById('view-desc');
    let currentPage = 1;
    let sortColumn = null;
    let sortDirection = 'asc';
    let currentVisibleRows = rows;

    // Add event listeners
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

    // Set initial view description
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

    // Add sorting to column headers
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

    // Export button
    const exportBtn = document.getElementById('main-export-filtered');
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            exportToCSV('main', table, currentVisibleRows);
        });
    }

    // Initial update
    updateTable();

    function updateTable() {
        // Get filter and page size
        const filterText = searchInput ? searchInput.value.toLowerCase() : '';
        const perPageValue = perPageSelect ? perPageSelect.value : '25';
        const perPage = perPageValue.toLowerCase() === 'all' ? rows.length : parseInt(perPageValue);
        const viewValue = viewSelector ? viewSelector.value : 'recent';
        const today = new Date();
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        const thirtyDaysAgoStr = formatLocalDate(thirtyDaysAgo);

        // Filter rows by view
        let visibleRows = rows.filter(row => {
            const dateAdded = row.cells[4].textContent.trim();
            const ransomware = row.cells[6].textContent.trim();
            if (viewValue === 'recent') {
                // Added in last 30 days
                return dateAdded >= thirtyDaysAgoStr;
            } else if (viewValue === 'high') {
                // Known ransomware use
                return ransomware === 'Known';
            }
            // 'all' view: show all
            return true;
        });

        // Apply keyword search filter
        if (filterText) {
            visibleRows = visibleRows.filter(row => row.textContent.toLowerCase().includes(filterText));
        }

        // Sort rows if a sort column is selected
        if (sortColumn !== null) {
            visibleRows.sort((a, b) => {
                const cellA = a.cells[sortColumn].textContent.trim();
                const cellB = b.cells[sortColumn].textContent.trim();
                // Check if the values are dates (YYYY-MM-DD format)
                if (/^\d{4}-\d{2}-\d{2}$/.test(cellA) && /^\d{4}-\d{2}-\d{2}$/.test(cellB)) {
                    const dateA = new Date(cellA);
                    const dateB = new Date(cellB);
                    return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
                }
                if (!isNaN(parseFloat(cellA)) && !isNaN(parseFloat(cellB))) {
                    return sortDirection === 'asc' ? parseFloat(cellA) - parseFloat(cellB) : parseFloat(cellB) - parseFloat(cellA);
                }
                return sortDirection === 'asc' ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
            });
        }

        // Update current visible rows for export
        currentVisibleRows = visibleRows;

        // Pagination
        const totalVisible = visibleRows.length;
        const pageCount = Math.ceil(totalVisible / perPage);
        if (currentPage > pageCount) {
            currentPage = Math.max(1, pageCount);
        }

        // Show/hide rows
        rows.forEach(row => row.style.display = 'none');
        visibleRows.forEach((row, idx) => {
            row.style.display = (idx >= (currentPage - 1) * perPage && idx < currentPage * perPage) ? '' : 'none';
        });

        // Update pagination
        updatePagination(pageCount);

        // Highlight due dates for visible rows
        highlightDueDates();
    }

    function updatePagination(pageCount) {
        pagination.innerHTML = '';
        if (pageCount <= 1) return;
        const maxButtons = 7;
        const fragment = document.createDocumentFragment();

        if (pageCount > maxButtons) {
            let pages = [];
            pages.push(1);
            let start = Math.max(2, currentPage - 2);
            let end = Math.min(pageCount - 1, currentPage + 2);
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
    // Get headers
    const headers = Array.from(table.querySelectorAll('thead th'))
        .map(th => `"${th.textContent.replace(/"/g, '""')}"`);

    // Create CSV content
    let csvContent = headers.join(',') + '\n';

    // Add rows
    rows.forEach(row => {
        const cells = Array.from(row.querySelectorAll('td'));
        const rowData = cells.map(cell => `"${cell.textContent.replace(/"/g, '""')}"`);
        csvContent += rowData.join(',') + '\n';
    });

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);

    // Use the current view for the filename
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

    // Click and remove link
    link.click();
    document.body.removeChild(link);

    setStatusMessage(`Export complete: CISA-${sectionName}-${date}.csv`);
}
