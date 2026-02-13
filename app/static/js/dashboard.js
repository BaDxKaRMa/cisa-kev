// CISA KEV Dashboard bootstrap

(function() {
    const DATE = window.KevDashboardDate || {};
    const DOM = window.KevDashboardDom || {};
    const TABLE = window.KevDashboardTable || {};

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

                    if (DOM.addCveCell) DOM.addCveCell(row, vulnerability.cveID, 'cve');
                    if (DOM.addTextCell) DOM.addTextCell(row, vulnerability.vulnerabilityName, 'name');
                    if (DOM.addTextCell) DOM.addTextCell(row, vulnerability.vendorProject, 'vendor');
                    if (DOM.addTextCell) DOM.addTextCell(row, vulnerability.product, 'product');
                    if (DOM.addDateCell) {
                        DOM.addDateCell(
                            row,
                            dateAdded,
                            DATE.describeDateAdded ? DATE.describeDateAdded(dateAdded) : '',
                            'dateAdded'
                        );
                        DOM.addDateCell(
                            row,
                            dueDate,
                            DATE.describeDueDate ? DATE.describeDueDate(dueDate) : '',
                            'dueDate'
                        );
                    }
                    if (DOM.addRansomwareCell) DOM.addRansomwareCell(row, ransomwareUse, 'ransomware');

                    const detailsRow = DOM.buildDetailRow ? DOM.buildDetailRow(vulnerability, rowId) : null;

                    row.addEventListener('click', function(event) {
                        if (!detailsRow || event.target.closest('a')) return;
                        if (DOM.toggleDetailRow) DOM.toggleDetailRow(row, detailsRow);
                    });

                    row.addEventListener('keydown', function(event) {
                        if (!detailsRow) return;
                        if (event.key !== 'Enter' && event.key !== ' ') return;
                        event.preventDefault();
                        if (DOM.toggleDetailRow) DOM.toggleDetailRow(row, detailsRow);
                    });

                    tbody.appendChild(row);
                    if (detailsRow) tbody.appendChild(detailsRow);
                });

                if (TABLE.initMainTableControls) TABLE.initMainTableControls();
                if (TABLE.highlightDueDates) TABLE.highlightDueDates();
            })
            .catch(error => {
                console.error(error);
                if (DOM.renderTableError) {
                    DOM.renderTableError('Unable to load KEV data. Please refresh or try again later.');
                }
            });
    });
})();
