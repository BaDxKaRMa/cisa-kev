const fs = require('fs');
const path = require('path');

const SCRIPT_FILES = [
  'app/static/js/dashboard-config.js',
  'app/static/js/dashboard-date.js',
  'app/static/js/dashboard-toast.js',
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

function makeDataset() {
  return {
    vulnerabilities: [
      {
        cveID: 'CVE-2026-0003',
        vulnerabilityName: 'Vuln 3',
        vendorProject: 'Vendor C',
        product: 'Product C',
        dateAdded: '2026-02-01',
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
        dateAdded: '2026-02-02',
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
        dateAdded: '2026-02-03',
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

test('switching to high priority sorts by due date ascending', async () => {
  window.localStorage.setItem(
    'kevDashboardSettingsV1',
    JSON.stringify({ view: 'high', perPage: '1' }),
  );
  dispatchDomReady();
  await waitForCondition(() => document.querySelectorAll('#main-table-body tr.data-row').length > 0);

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
  await waitForCondition(() => document.querySelector('.cve-copy') !== null);

  const cve = document.querySelector('.cve-copy');
  expect(cve).toBeTruthy();

  cve.click();
  await waitForTick();

  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('CVE-2026-0003');
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
