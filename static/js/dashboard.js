// CISA KEV Dashboard JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Fetch JSON data and populate table, then initialize controls
    fetch('./known_exploited_vulnerabilities.json')
      .then(response => response.json())
      .then(data => {
        const tbody = document.getElementById('main-table-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        data.vulnerabilities.forEach(v => {
          const row = document.createElement('tr');
          row.setAttribute('data-date-added', v.dateAdded);
          row.setAttribute('data-ransomware', v.knownRansomwareCampaignUse);
          row.innerHTML = `
            <td>${v.cveID}</td>
            <td>${v.vulnerabilityName}</td>
            <td>${v.vendorProject}</td>
            <td>${v.product}</td>
            <td>${v.dateAdded}</td>
            <td>${v.dueDate}</td>
            <td>${v.knownRansomwareCampaignUse}</td>
          `;
          tbody.appendChild(row);
        });
        // Now initialize controls and highlighting
        initMainTableControls();
        highlightDueDates();
      });
});

// Function to highlight rows based on dates
function highlightDueDates() {
    // Get current date
    const today = new Date();
    const twoWeeksFromNow = new Date();
    twoWeeksFromNow.setDate(today.getDate() + 14);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    // Format dates as YYYY-MM-DD for comparison
    const formatDate = (date) => date.toISOString().split('T')[0];
    const todayStr = formatDate(today);
    const twoWeeksStr = formatDate(twoWeeksFromNow);
    const thirtyDaysAgoStr = formatDate(thirtyDaysAgo);
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
        let desc = '';
        if (viewValue === 'recent') {
            desc = '<strong>Recently Added:</strong> Showing vulnerabilities added in the last 30 days.';
        } else if (viewValue === 'high') {
            desc = '<strong>High Priority:</strong> Showing vulnerabilities known to be used in ransomware campaigns.';
        } else {
            desc = '<strong>All Vulnerabilities:</strong> Showing the full CISA KEV catalog.';
        }
        viewDesc.innerHTML = desc;
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

        // Filter rows by view
        let visibleRows = rows.filter(row => {
            const dateAdded = row.cells[4].textContent.trim();
            const ransomware = row.cells[6].textContent.trim();
            if (viewValue === 'recent') {
                // Added in last 30 days
                const today = new Date();
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(today.getDate() - 30);
                return dateAdded >= thirtyDaysAgo.toISOString().split('T')[0];
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
        let showEllipsis = false;
        if (pageCount > maxButtons) {
            showEllipsis = true;
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
                    pagination.appendChild(span);
                } else {
                    const button = document.createElement('button');
                    button.textContent = p;
                    if (p === currentPage) button.style.fontWeight = 'bold';
                    button.addEventListener('click', function() {
                        currentPage = p;
                        updateTable();
                    });
                    pagination.appendChild(button);
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
                pagination.appendChild(button);
                if (i < pageCount) pagination.appendChild(document.createTextNode(' '));
            }
        }
    }
}

function initTableControls(section) {
    const table = document.getElementById(section + '-table');
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    const rows = tbody.querySelectorAll('tr');
    const headers = table.querySelectorAll('thead th');
    const searchInput = document.getElementById(section + '-search');
    const perPageSelect = document.getElementById(section + '-per-page');
    const pagination = document.getElementById(section + '-pagination');

    // For 'all' table, get the ransomware filter dropdown
    let ransomwareFilter = null;
    if (section === 'all') {
        ransomwareFilter = document.getElementById('all-ransomware-filter');
    }
    
    // For sorting
    let sortColumn = null;
    let sortDirection = 'asc';
    
    // Set default sorting for "Recently Added" table to Date Added (index 4) in descending order
    if (section === 'recent') {
        sortColumn = 4; // Date Added column
        sortDirection = 'desc'; // Most recent first
    }
    
    // Add info element
    const infoElem = document.createElement('div');
    infoElem.id = section + '-info';
    infoElem.className = 'pagination-info';
    pagination.parentNode.insertBefore(infoElem, pagination);
    

    // Set initial page
    let currentPage = 1;
    // Track visible rows for export
    let currentVisibleRows = Array.from(rows);

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

    // Add event listener for ransomware filter (only for 'all' table)
    if (ransomwareFilter) {
        ransomwareFilter.addEventListener('change', function() {
            currentPage = 1;
            updateTable();
        });
    }
    
    // Add sorting to column headers - but not for the "recent" table
    headers.forEach((header, columnIndex) => {
        // Store the original header text without any sorting indicators
        header.setAttribute('data-original-text', header.textContent);
        
        // Only make headers sortable for "high" and "all" tables
        if (section !== 'recent') {
            header.setAttribute('data-sortable', 'true');
            header.style.cursor = 'pointer';
            
            header.addEventListener('click', function() {
                // Update sort direction
                if (sortColumn === columnIndex) {
                    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    sortColumn = columnIndex;
                    sortDirection = 'asc';
                }
                
                // Reset all headers to original text
                headers.forEach(h => {
                    h.textContent = h.getAttribute('data-original-text');
                });
                
                // Add sort indicator to current header
                header.textContent = header.getAttribute('data-original-text') + (sortDirection === 'asc' ? ' ▲' : ' ▼');
                
                // Debug info
                console.log(`Sorting ${section} table by column ${columnIndex} (${header.textContent}) in ${sortDirection} order`);
                
                // Reset to first page and update the table with sorted data
                currentPage = 1;
                updateTable();
            });
        }
    });
    
    // Add export functionality
    const exportBtn = document.getElementById(section + '-export-filtered');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', function() {
            exportToCSV(section, table, currentVisibleRows);
        });
    }
    
    // Apply initial sort indicator if there's a default sort
    if (sortColumn !== null) {
        // Reset all headers to original text first
        headers.forEach(h => {
            h.textContent = h.getAttribute('data-original-text');
        });
        
        // Add sort indicator to the sorted column
        const sortedHeader = headers[sortColumn];
        if (sortedHeader) {
            if (section === 'recent') {
                // For recent table, add a non-interactive indicator
                const indicator = document.createElement('span');
                indicator.textContent = ' ▼';
                indicator.className = 'sort-indicator';
                sortedHeader.appendChild(indicator);
                
                // Add a title explaining this table is pre-sorted
                sortedHeader.setAttribute('title', 'This table is pre-sorted by most recent date added');
                
                // Ensure the Date Added column shows it's sorted by default
                console.log(`Recent table is pre-sorted by Date Added in descending order`);
            } else {
                sortedHeader.textContent = sortedHeader.getAttribute('data-original-text') + 
                    (sortDirection === 'asc' ? ' ▲' : ' ▼');
                console.log(`Initially sorting ${section} table by column ${sortColumn} (${sortedHeader.textContent}) in ${sortDirection} order`);
            }
        }
    }
    
    // Initial update
    updateTable();
    

    function updateTable() {
        // Get filter and page size
        const filterText = searchInput ? searchInput.value.toLowerCase() : '';
        const perPageValue = perPageSelect ? perPageSelect.value : '25';
        const perPage = perPageValue.toLowerCase() === 'all' ? rows.length : parseInt(perPageValue);

        // Filter rows
        let visibleRows = Array.from(rows);

        // --- Ransomware filter logic for 'all' table ---
        if (section === 'all' && ransomwareFilter) {
            const ransomwareValue = ransomwareFilter.value;
            if (ransomwareValue === 'Known') {
                // Only show rows where the Ransomware column is 'Known'
                visibleRows = visibleRows.filter(row => {
                    // Ransomware column is always the 7th column (index 6)
                    const ransomwareCell = row.cells[6];
                    return ransomwareCell && ransomwareCell.textContent.trim() === 'Known';
                });
            } else if (ransomwareValue === 'Unknown') {
                // Only show rows where the Ransomware column is 'Unknown'
                visibleRows = visibleRows.filter(row => {
                    const ransomwareCell = row.cells[6];
                    return ransomwareCell && ransomwareCell.textContent.trim() === 'Unknown';
                });
            } // else 'any' (no filter)
        }

        // Apply keyword search filter (independent of ransomware filter)
        if (filterText) {
            visibleRows = visibleRows.filter(row => {
                return row.textContent.toLowerCase().includes(filterText);
            });
        }
        
        // Sort rows if a sort column is selected
        if (sortColumn !== null) {
            console.log(`Applying sort on ${section} table, column index: ${sortColumn}, direction: ${sortDirection}`);
            
            visibleRows.sort((a, b) => {
                const cellA = a.cells[sortColumn].textContent.trim();
                const cellB = b.cells[sortColumn].textContent.trim();
                
                // Check if the values are dates (YYYY-MM-DD format)
                if (/^\d{4}-\d{2}-\d{2}$/.test(cellA) && /^\d{4}-\d{2}-\d{2}$/.test(cellB)) {
                    // Compare as dates
                    const dateA = new Date(cellA);
                    const dateB = new Date(cellB);
                    const result = sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
                    
                    // Log first few comparisons for debugging
                    if (a === visibleRows[0] || b === visibleRows[0]) {
                        console.log(`Date compare: "${cellA}" vs "${cellB}" = ${result} (${sortDirection})`);
                    }
                    
                    return result;
                }
                
                // Check if they're numeric values
                if (!isNaN(parseFloat(cellA)) && !isNaN(parseFloat(cellB))) {
                    return sortDirection === 'asc' ? parseFloat(cellA) - parseFloat(cellB) : parseFloat(cellB) - parseFloat(cellA);
                }
                
                // Compare as strings
                return sortDirection === 'asc' ? 
                    cellA.localeCompare(cellB) : 
                    cellB.localeCompare(cellA);
            });
        }
        
        // Update current visible rows for export
        currentVisibleRows = visibleRows;
        
        // Log first few rows after sorting for verification
        if (sortColumn !== null && visibleRows.length > 0) {
            console.log(`${section} table after sorting, first row:`, 
                visibleRows[0].cells[0].textContent, 
                "Date:", visibleRows[0].cells[4].textContent);
            if (visibleRows.length > 1) {
                console.log(`${section} table after sorting, second row:`, 
                    visibleRows[1].cells[0].textContent, 
                    "Date:", visibleRows[1].cells[4].textContent);
            }
        }
        
        // Calculate pagination
        const totalVisible = visibleRows.length;
        const pageCount = Math.ceil(totalVisible / perPage);
        
        // Validate current page
        if (currentPage > pageCount) {
            currentPage = Math.max(1, pageCount);
        }
        
        // Update info text
        if (infoElem) {
            if (totalVisible === 0) {
                infoElem.textContent = 'No results found';
            } else {
                const start = (currentPage - 1) * perPage + 1;
                const end = Math.min(currentPage * perPage, totalVisible);
                let infoText = `Showing ${start}-${end} of ${totalVisible}`;
                
                // Add sorting info
                if (sortColumn !== null) {
                    if (section === 'recent') {
                        // For recent table, just show it's sorted by most recent date
                        infoText += ` (sorted by most recent date)`;
                    } else {
                        // For other tables, show the sortable column and direction
                        const headerText = headers[sortColumn].getAttribute('data-original-text');
                        infoText += ` (sorted by ${headerText} ${sortDirection === 'asc' ? 'ascending' : 'descending'})`;
                    }
                }
                
                infoElem.textContent = infoText;
            }
        }
        
        // Show/hide rows
        Array.from(rows).forEach((row, index) => {
            const isVisible = visibleRows.includes(row);
            const pageStart = (currentPage - 1) * perPage;
            const pageEnd = pageStart + perPage;
            const visibleIndex = isVisible ? visibleRows.indexOf(row) : -1;
            
            row.style.display = (isVisible && visibleIndex >= pageStart && visibleIndex < pageEnd) ? '' : 'none';
        });
        
        // Ensure due-date highlighting has correct priority
        // Past due dates should override other highlighting
        visibleRows.forEach(row => {
            // Reset any inline styles
            row.style.backgroundColor = '';
            
            // Now apply our priority-based styling in this order:
            // 1. Past due (highest priority)
            // 2. Due soon
            // 3. High priority (ransomware)
            // 4. Recent
            if (row.classList.contains('due-date-past')) {
                row.style.backgroundColor = getComputedStyle(document.querySelector('.legend-past')).backgroundColor;
            } else if (row.classList.contains('due-date-soon')) {
                row.style.backgroundColor = getComputedStyle(document.querySelector('.legend-soon')).backgroundColor;
            } else if (row.classList.contains('high-priority')) {
                row.style.backgroundColor = getComputedStyle(document.querySelector('.legend-high')).backgroundColor;
            } else if (row.classList.contains('recent')) {
                row.style.backgroundColor = getComputedStyle(document.querySelector('.legend-recent')).backgroundColor;
            }
        });
        
        // Update pagination
        updatePagination(pageCount);
        
        // Make sure highlighting is applied correctly to visible rows
        // This is important after sorting or filtering
        highlightDueDates();
    }
    
    function updatePagination(pageCount) {
        pagination.innerHTML = '';
        if (pageCount <= 1) {
            return;
        }
        // Only condense for the 'all' table, keep others as before
        const maxButtons = 7; // Show up to 7 buttons (first, last, current, 2 before/after)
        let showEllipsis = false;
        if (section === 'all' && pageCount > maxButtons) {
            showEllipsis = true;
            let pages = [];
            // Always show first and last
            pages.push(1);
            // Show up to 2 before and after current page
            let start = Math.max(2, currentPage - 2);
            let end = Math.min(pageCount - 1, currentPage + 2);
            if (start > 2) pages.push('...');
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
            if (end < pageCount - 1) pages.push('...');
            pages.push(pageCount);
            pages.forEach(p => {
                if (p === '...') {
                    const span = document.createElement('span');
                    span.textContent = '...';
                    span.style.margin = '0 4px';
                    pagination.appendChild(span);
                } else {
                    const button = document.createElement('button');
                    button.textContent = p;
                    if (p === currentPage) {
                        button.style.fontWeight = 'bold';
                    }
                    button.addEventListener('click', function() {
                        currentPage = p;
                        updateTable();
                    });
                    pagination.appendChild(button);
                }
            });
        } else {
            // Default: show all page buttons
            for (let i = 1; i <= pageCount; i++) {
                const button = document.createElement('button');
                button.textContent = i;
                if (i === currentPage) {
                    button.style.fontWeight = 'bold';
                }
                button.addEventListener('click', function() {
                    currentPage = i;
                    updateTable();
                });
                pagination.appendChild(button);
                if (i < pageCount) {
                    pagination.appendChild(document.createTextNode(' '));
                }
            }
        }
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
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `CISA-${sectionName}-${date}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);

    // Click and remove link
    link.click();
    document.body.removeChild(link);

    // Optional: Show feedback to user
    const msg = document.createElement('div');
    msg.textContent = `Export complete! Downloaded: CISA-${sectionName}-${date}.csv`;
    msg.style.color = '#4CAF50';
    msg.style.margin = '0.5em 0';
    msg.style.padding = '0.5em';
    msg.style.borderLeft = '3px solid #4CAF50';
    msg.style.backgroundColor = '#f9fff9';

    const container = table.parentNode;
    container.insertBefore(msg, table);

    // Remove message after 3 seconds
    setTimeout(() => {
        msg.style.opacity = '0';
        msg.style.transition = 'opacity 0.5s ease';
        setTimeout(() => container.removeChild(msg), 500);
    }, 3000);
}


