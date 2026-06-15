import fs from 'fs';
import path from 'path';

const SCRIPT_FILES = [
  'app/static/js/dashboard-config.js',
  'app/static/js/dashboard-date.js',
  'app/static/js/dashboard-toast.js',
  'app/static/js/dashboard-dom.js',
  'app/static/js/dashboard-table.js',
  'app/static/js/dashboard.js',
];

function createStorageMock() {
  let store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
  };
}

function createBaseDom() {
  document.body.innerHTML = `
    <div id="main-status"></div>
    <div class="triage-bar" role="group">
      <button type="button" class="triage-chip" data-status="past" aria-pressed="false"><span class="chip-count" data-count-for="past">—</span></button>
      <button type="button" class="triage-chip" data-status="soon" aria-pressed="false"><span class="chip-count" data-count-for="soon">—</span></button>
      <button type="button" class="triage-chip" data-status="ransomware" aria-pressed="false"><span class="chip-count" data-count-for="ransomware">—</span></button>
      <button type="button" class="triage-chip" data-status="recent" aria-pressed="false"><span class="chip-count" data-count-for="recent">—</span></button>
      <button type="button" class="triage-clear" id="triage-clear" hidden>Clear filters</button>
    </div>
    <select id="view-selector">
      <option value="recent">Recently Added</option>
      <option value="high">High Priority</option>
      <option value="all">All</option>
    </select>
    <div id="view-desc"></div>
    <input id="main-search" />
    <select id="main-per-page">
      <option value="1">1</option>
      <option value="25">25</option>
      <option value="50">50</option>
      <option value="100">100</option>
      <option value="all">All</option>
    </select>
    <details class="column-settings"><summary>Columns</summary><div class="column-options"><div id="column-options-list"></div><button id="reset-columns" type="button">Reset</button></div></details>
    <button id="main-export-filtered">Export</button>
    <div id="main-pagination"></div>
    <table id="main-table">
      <thead><tr>
        <th>CVE ID</th><th>Name</th><th>Vendor</th><th>Product</th><th>Date Added</th><th>Due Date</th><th>Ransomware</th>
      </tr></thead>
      <tbody id="main-table-body"></tbody>
    </table>
  `;
}

function loadDashboardScripts() {
  SCRIPT_FILES.forEach(file => {
    const full = path.resolve(file);
    const content = fs.readFileSync(full, 'utf8');
    window.eval(content);
  });
}

function dispatchDomReady() {
  document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));
}

async function waitForTick() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForCondition(predicate, timeoutMs = 2000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('Timed out waiting for condition');
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const DATE_ADDED_3 = daysAgo(3);
const DATE_ADDED_2 = daysAgo(2);
const DATE_ADDED_1 = daysAgo(1);

function makeDataset() {
  return {
    vulnerabilities: [
      {
        cveID: 'CVE-2026-0003',
        vulnerabilityName: 'Vuln 3',
        vendorProject: 'Vendor C',
        product: 'Product C',
        dateAdded: DATE_ADDED_3,
        dueDate: '2026-02-20',
        knownRansomwareCampaignUse: 'Known',
        shortDescription: 'Desc 3',
        requiredAction: 'Patch 3',
        notes: '',
        cwes: [],
      },
      {
        cveID: 'CVE-2026-0001',
        vulnerabilityName: 'Vuln 1',
        vendorProject: 'Vendor A',
        product: 'Product A',
        dateAdded: DATE_ADDED_2,
        dueDate: '2026-02-05',
        knownRansomwareCampaignUse: 'Known',
        shortDescription: 'Desc 1',
        requiredAction: 'Patch 1',
        notes: '',
        cwes: [],
      },
      {
        cveID: 'CVE-2026-0002',
        vulnerabilityName: 'Vuln 2',
        vendorProject: 'Vendor B',
        product: 'Product B',
        dateAdded: DATE_ADDED_1,
        dueDate: '2026-02-10',
        knownRansomwareCampaignUse: 'Unknown',
        shortDescription: 'Desc 2',
        requiredAction: 'Patch 2',
        notes: '',
        cwes: [],
      },
    ],
  };
}

beforeAll(() => {
  Object.defineProperty(window, 'localStorage', {
    value: createStorageMock(),
    configurable: true,
    writable: true,
  });
  createBaseDom();
  loadDashboardScripts();
});

beforeEach(() => {
  window.localStorage.clear();
  createBaseDom();

  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(makeDataset()),
  });

  global.navigator.clipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('default load uses recently added view sorted by date added descending', async () => {
  window.localStorage.setItem(
    'kevDashboardSettingsV1',
    JSON.stringify({ view: 'high', perPage: '1' }),
  );
  dispatchDomReady();
  await waitForCondition(() => document.querySelectorAll('#main-table-body tr.data-row').length > 0);

  const visibleRowsPage1 = Array.from(document.querySelectorAll('#main-table-body tr.data-row'))
    .filter(row => row.style.display !== 'none');

  expect(visibleRowsPage1.length).toBe(1);
  expect(document.getElementById('view-selector').value).toBe('recent');
  expect(visibleRowsPage1[0].dataset.dateAdded).toBe(DATE_ADDED_1);

  const pageTwoButton = Array.from(document.querySelectorAll('#main-pagination button'))
    .find(button => button.textContent.trim() === '2');
  expect(pageTwoButton).toBeTruthy();
  pageTwoButton.click();
  await waitForTick();

  const visibleRowsPage2 = Array.from(document.querySelectorAll('#main-table-body tr.data-row'))
    .filter(row => row.style.display !== 'none');
  expect(visibleRowsPage2.length).toBe(1);
  expect(visibleRowsPage2[0].dataset.dateAdded).toBe(DATE_ADDED_2);
});

test('switching to high priority sorts by due date ascending', async () => {
  window.localStorage.setItem(
    'kevDashboardSettingsV1',
    JSON.stringify({ perPage: '1' }),
  );
  dispatchDomReady();
  await waitForCondition(() => document.querySelectorAll('#main-table-body tr.data-row').length > 0);

  const viewSelector = document.getElementById('view-selector');
  viewSelector.value = 'high';
  viewSelector.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitForTick();

  const visibleRowsPage1 = Array.from(document.querySelectorAll('#main-table-body tr.data-row'))
    .filter(row => row.style.display !== 'none');

  expect(visibleRowsPage1.length).toBe(1);
  expect(visibleRowsPage1[0].dataset.ransomware).toBe('Known');
  expect(visibleRowsPage1[0].dataset.dueDate).toBe('2026-02-05');

  const pageTwoButton = Array.from(document.querySelectorAll('#main-pagination button'))
    .find(button => button.textContent.trim() === '2');
  expect(pageTwoButton).toBeTruthy();
  pageTwoButton.click();
  await waitForTick();

  const visibleRowsPage2 = Array.from(document.querySelectorAll('#main-table-body tr.data-row'))
    .filter(row => row.style.display !== 'none');
  expect(visibleRowsPage2.length).toBe(1);
  expect(visibleRowsPage2[0].dataset.ransomware).toBe('Known');
  expect(visibleRowsPage2[0].dataset.dueDate).toBe('2026-02-20');
});

test('column toggle can be reset to defaults', async () => {
  dispatchDomReady();
  await waitForCondition(() => document.querySelectorAll('.column-toggle').length > 0);

  const vendorToggle = document.querySelector('.column-toggle[data-col="2"]');
  expect(vendorToggle).toBeTruthy();

  vendorToggle.checked = false;
  vendorToggle.dispatchEvent(new window.Event('change', { bubbles: true }));

  const vendorHeader = document.querySelector('#main-table thead th:nth-child(3)');
  expect(vendorHeader.style.display).toBe('none');

  document.getElementById('reset-columns').click();
  expect(vendorHeader.style.display).toBe('');
});

test('clicking CVE copies value and shows toast', async () => {
  dispatchDomReady();
  await waitForCondition(() => Array.from(document.querySelectorAll('#main-table-body tr.data-row'))
    .some(row => row.style.display !== 'none'));

  const visibleFirstRow = Array.from(document.querySelectorAll('#main-table-body tr.data-row'))
    .find(row => row.style.display !== 'none');
  const cve = visibleFirstRow.querySelector('.cve-copy');
  expect(cve).toBeTruthy();

  cve.click();
  await waitForTick();

  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('CVE-2026-0002');
  const toast = document.getElementById('copy-toast');
  expect(toast).toBeTruthy();
  expect(toast.classList.contains('visible')).toBe(true);
});

test('view filters interact with pagination controls', async () => {
  dispatchDomReady();
  await waitForCondition(() => document.querySelectorAll('#main-table-body tr.data-row').length > 0);

  const viewSelector = document.getElementById('view-selector');
  const perPage = document.getElementById('main-per-page');

  perPage.value = '25';
  perPage.dispatchEvent(new window.Event('change', { bubbles: true }));

  viewSelector.value = 'high';
  viewSelector.dispatchEvent(new window.Event('change', { bubbles: true }));
  await waitForTick();

  const visibleRows = Array.from(document.querySelectorAll('#main-table-body tr.data-row'))
    .filter(row => row.style.display !== 'none');

  expect(visibleRows.length).toBe(2);
  expect(visibleRows.every(r => r.dataset.ransomware === 'Known')).toBe(true);
});

test('shows no-results row when filters return nothing', async () => {
  dispatchDomReady();
  await waitForCondition(() => document.querySelectorAll('#main-table-body tr.data-row').length > 0);

  const searchInput = document.getElementById('main-search');
  searchInput.value = 'no-match-value';
  searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  await waitForTick();

  const visibleRows = Array.from(document.querySelectorAll('#main-table-body tr.data-row'))
    .filter(row => row.style.display !== 'none');
  expect(visibleRows.length).toBe(0);

  const emptyStateRow = document.querySelector('#main-table-body tr.no-results-row');
  expect(emptyStateRow).toBeTruthy();
  expect(emptyStateRow.style.display).toBe('');
  expect(emptyStateRow.textContent).toContain('No vulnerabilities match');
});

test('saved column order is applied on load', async () => {
  window.localStorage.setItem(
    'kevDashboardSettingsV1',
    JSON.stringify({ columnOrder: ['vendor', 'cve', 'name', 'product', 'dateAdded', 'dueDate', 'ransomware'] }),
  );
  dispatchDomReady();
  await waitForCondition(() => document.querySelectorAll('#main-table-body tr.data-row').length > 0);

  const reorderedHeaders = Array.from(document.querySelectorAll('#main-table thead th'))
    .map(h => h.textContent.replace(/[▲▼]/g, '').trim());
  expect(reorderedHeaders[0]).toBe('Vendor');
});

test('CSV export uses clean headers even when a column is sorted', async () => {
  dispatchDomReady();
  await waitForCondition(() => document.querySelectorAll('#main-table-body tr.data-row').length > 0);

  // Sort by the CVE column so a sort indicator (▲) is appended to its header text.
  const cveHeader = document.querySelector('#main-table thead th[data-col-key="cve"]');
  expect(cveHeader).toBeTruthy();
  cveHeader.click();
  await waitForTick();
  expect(cveHeader.textContent).toContain('▲');

  // Capture the generated CSV blob instead of triggering a real download.
  const originalCreate = window.URL.createObjectURL;
  const originalRevoke = window.URL.revokeObjectURL;
  const originalClick = window.HTMLAnchorElement.prototype.click;
  let capturedBlob = null;
  window.URL.createObjectURL = vi.fn(blob => { capturedBlob = blob; return 'blob:mock'; });
  window.URL.revokeObjectURL = vi.fn();
  window.HTMLAnchorElement.prototype.click = vi.fn();

  try {
    document.getElementById('main-export-filtered').click();
    await waitForTick();

    expect(capturedBlob).toBeTruthy();
    const headerLine = (await capturedBlob.text()).split('\n')[0];
    expect(headerLine).toContain('"CVE ID"');
    expect(headerLine).not.toContain('▲');
    expect(headerLine).not.toContain('▼');
  } finally {
    window.URL.createObjectURL = originalCreate;
    window.URL.revokeObjectURL = originalRevoke;
    window.HTMLAnchorElement.prototype.click = originalClick;
  }
});

test('triage chips show live counts and filter rows by status', async () => {
  // All three fixtures are recent and past-due; two are ransomware-known.
  window.localStorage.setItem(
    'kevDashboardSettingsV1',
    JSON.stringify({ perPage: '25' }),
  );
  dispatchDomReady();
  await waitForCondition(() => document.querySelectorAll('#main-table-body tr.data-row').length > 0);

  const countFor = status =>
    document.querySelector(`.triage-chip[data-status="${status}"] .chip-count`).textContent;
  expect(countFor('ransomware')).toBe('2');
  expect(countFor('past')).toBe('3');
  expect(countFor('recent')).toBe('3');
  expect(countFor('soon')).toBe('0');

  // Activating the ransomware chip narrows to the two Known rows.
  const ransomwareChip = document.querySelector('.triage-chip[data-status="ransomware"]');
  ransomwareChip.click();
  await waitForTick();

  expect(ransomwareChip.getAttribute('aria-pressed')).toBe('true');
  expect(document.getElementById('triage-clear').hidden).toBe(false);
  let visible = Array.from(document.querySelectorAll('#main-table-body tr.data-row'))
    .filter(row => row.style.display !== 'none');
  expect(visible.length).toBe(2);
  expect(visible.every(r => r.dataset.ransomware === 'Known')).toBe(true);

  // Clearing restores the full set.
  document.getElementById('triage-clear').click();
  await waitForTick();
  visible = Array.from(document.querySelectorAll('#main-table-body tr.data-row'))
    .filter(row => row.style.display !== 'none');
  expect(visible.length).toBe(3);
  expect(ransomwareChip.getAttribute('aria-pressed')).toBe('false');
});

test('column settings menu closes when clicking outside', async () => {
  dispatchDomReady();
  await waitForCondition(() => document.querySelectorAll('.column-toggle').length > 0);

  const columnSettings = document.querySelector('.column-settings');
  expect(columnSettings).toBeTruthy();

  columnSettings.open = true;
  expect(columnSettings.open).toBe(true);

  document.body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  await waitForTick();

  expect(columnSettings.open).toBe(false);
});
