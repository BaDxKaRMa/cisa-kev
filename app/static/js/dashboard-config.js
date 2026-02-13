(function() {
    const COLUMNS = Object.freeze([
        Object.freeze({ key: 'cve', label: 'CVE ID', index: 0, exportable: true }),
        Object.freeze({ key: 'name', label: 'Name', index: 1, exportable: true }),
        Object.freeze({ key: 'vendor', label: 'Vendor', index: 2, exportable: true }),
        Object.freeze({ key: 'product', label: 'Product', index: 3, exportable: true }),
        Object.freeze({ key: 'dateAdded', label: 'Date Added', index: 4, exportable: true }),
        Object.freeze({ key: 'dueDate', label: 'Due Date', index: 5, exportable: true }),
        Object.freeze({ key: 'ransomware', label: 'Ransomware', index: 6, exportable: true }),
    ]);

    const COLUMN_INDEX = Object.freeze(
        COLUMNS.reduce((acc, column) => {
            acc[column.key] = column.index;
            return acc;
        }, {})
    );

    const DEFAULT_COLUMN_VISIBILITY = Object.freeze(
        COLUMNS.reduce((acc, column) => {
            acc[column.index] = true;
            return acc;
        }, {})
    );

    window.KevDashboardConfig = Object.freeze({
        settingsKey: 'kevDashboardSettingsV1',
        columns: COLUMNS,
        columnIndex: COLUMN_INDEX,
        defaultColumnVisibility: DEFAULT_COLUMN_VISIBILITY,
    });
})();
