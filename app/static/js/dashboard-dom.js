(function() {
    const CONFIG = window.KevDashboardConfig || {};
    const TOAST = window.KevDashboardToast || {};

    const COLUMNS = CONFIG.columns || [];
    const COLUMN_BY_KEY = COLUMNS.reduce((acc, column) => {
        acc[column.key] = column;
        return acc;
    }, {});

    function setCellMetadata(cell, key) {
        if (!key) return;
        cell.dataset.colKey = key;
        const column = COLUMN_BY_KEY[key];
        if (column) {
            cell.dataset.sourceIndex = String(column.index);
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

    function addTextCell(row, value, key) {
        const cell = document.createElement('td');
        setCellMetadata(cell, key);
        cell.textContent = value ?? '';
        row.appendChild(cell);
    }

    function addCveCell(row, value, key = 'cve') {
        const cell = document.createElement('td');
        setCellMetadata(cell, key);

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

    function addDateCell(row, value, subtext, key) {
        const cell = document.createElement('td');
        setCellMetadata(cell, key);

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

    function addRansomwareCell(row, value, key = 'ransomware') {
        const cell = document.createElement('td');
        setCellMetadata(cell, key);
        cell.classList.add('ransomware-cell');

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

    function buildDetailSection(labelText, bodyText) {
        const section = document.createElement('div');
        section.className = 'details-section';
        const label = document.createElement('strong');
        label.textContent = labelText;
        section.appendChild(label);
        const text = document.createElement('span');
        text.className = 'details-text';
        text.textContent = bodyText;
        section.appendChild(text);
        return section;
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

        content.appendChild(buildDetailSection(
            'Summary',
            vulnerability.shortDescription || 'No summary available.'
        ));

        content.appendChild(buildDetailSection(
            'Required Action',
            vulnerability.requiredAction || 'No required action provided.'
        ));

        const notesText = extractPlainNotes(vulnerability.notes);
        if (notesText) {
            content.appendChild(buildDetailSection('Notes', notesText));
        }

        if (Array.isArray(vulnerability.cwes) && vulnerability.cwes.length > 0) {
            content.appendChild(buildDetailSection('CWEs', vulnerability.cwes.join(', ')));
        }

        const links = uniqueLinks(vulnerability.cveID, vulnerability.notes);
        if (links.length > 0) {
            const linkSection = document.createElement('div');
            linkSection.className = 'details-section';
            const linksLabel = document.createElement('strong');
            linksLabel.textContent = 'Links';
            linkSection.appendChild(linksLabel);

            const linkContainer = document.createElement('div');
            linkContainer.className = 'details-links';

            links.forEach(item => {
                const anchor = document.createElement('a');
                anchor.href = item.url;
                anchor.target = '_blank';
                anchor.rel = 'noopener noreferrer';
                anchor.textContent = item.label;
                linkContainer.appendChild(anchor);
            });

            linkSection.appendChild(linkContainer);
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
        window.requestAnimationFrame(function() {
            detailsRow.classList.add('details-visible');
        });
    }

    function applyColumnVisibility(table, visibility) {
        const allRows = table.querySelectorAll('tr');
        const visibleCount = Object.values(visibility).filter(Boolean).length || 1;

        allRows.forEach(row => {
            if (row.classList.contains('details-row')) {
                const detailsCell = row.cells[0];
                if (detailsCell) detailsCell.colSpan = visibleCount;
                return;
            }

            if (row.classList.contains('no-results-row')) {
                const noResultsCell = row.cells[0];
                if (noResultsCell) {
                    noResultsCell.colSpan = visibleCount;
                    noResultsCell.style.display = '';
                }
                return;
            }

            Array.from(row.cells).forEach(cell => {
                const sourceIndex = Number(cell.dataset.sourceIndex);
                cell.style.display = visibility[sourceIndex] === false ? 'none' : '';
            });
        });
    }

    window.KevDashboardDom = Object.freeze({
        renderTableError,
        addTextCell,
        addCveCell,
        addDateCell,
        addRansomwareCell,
        buildDetailRow,
        toggleDetailRow,
        applyColumnVisibility,
    });
})();
