// ============================================
// GOOGLE SHEETS CONFIGURATION
// ============================================
const CONFIG = {
    API_KEY: 'AIzaSyCQFgrkG6snidiKMwbYxveVv0ny7wNcn-E',
    SPREADSHEET_ID: '1O5swZSBsdhwv1GnvVGJB_chDZ8a4uAGQtO8UwKSZ1gc'
};

// ============================================
// TAB CONFIGURATION
// ============================================
const TABS = {
    'vacancy': {
        sheetName: 'Madrasah Vacancy',
        label: 'শিক্ষক শূন্যপদ',
        title: 'শিক্ষক শূন্যপদ',
        columnMapping: {
            'SL': 'SL',
            'EIIN': 'EIN',
            'MADRASHA-NAME': 'MADRASA-MAME',
            'LEVEL': 'LEVEL',
            'POST-NAME': 'POST-NAME',
            'SUBJECT': 'SUBJECT',
            'DIVISION': 'DIVISION',
            'DISTRICT': 'DISTRICT',
            'UPAZILLA/THANA': 'UPAZILLA/TAHMA'
        },
        displayColumns: ['SL', 'EIIN', 'MADRASHA-NAME', 'LEVEL', 'POST-NAME', 'SUBJECT', 'DIVISION', 'DISTRICT', 'UPAZILLA/THANA'],
        dashboardBars: {
            'districtBars': 'DISTRICT',
            'divisionBars': 'DIVISION',
            'postBars': 'POST-NAME'
        },
        filterFields: ['DIVISION', 'DISTRICT', 'UPAZILLA/THANA', 'LEVEL', 'POST-NAME', 'SUBJECT']
    },
    'admin': {
        sheetName: 'অধ্যক্ষ উপাধ্যক্ষ সুপার সহসুপার',
        label: 'অধ্যক্ষ উপাধ্যক্ষ সুপার সহসুপার',
        title: 'অধ্যক্ষ, উপাধ্যক্ষ, সুপার, সহসুপার পদ',
        columnMapping: {
            'SL': 'INSTITUTE_ID',
            'EIIN': 'EIN',
            'MADRASHA-NAME': 'MADRASHA-NAME',
            'LEVEL': 'LEVEL',
            'POST-NAME': 'POST-NAME',
            'DIVISION': 'DIVISION',
            'DISTRICT': 'ZILA',
            'UPAZILLA/THANA': 'UPAZILA'
        },
        displayColumns: ['SL', 'EIIN', 'MADRASHA-NAME', 'LEVEL', 'POST-NAME', 'DIVISION', 'DISTRICT', 'UPAZILLA/THANA'],
        dashboardBars: {
            'districtBars': 'DISTRICT',
            'divisionBars': 'DIVISION',
            'postBars': 'POST-NAME'
        },
        filterFields: ['DIVISION', 'DISTRICT', 'UPAZILLA/THANA', 'LEVEL', 'POST-NAME']
    }
};

// ============================================
// GLOBAL DATA STORE
// ============================================
let dataStore = {
    'vacancy': { allData: [], filteredData: [] },
    'admin': { allData: [], filteredData: [] }
};
let currentTab = 'vacancy';
let currentPage = 1;
let pageSize = 25;
let isLoading = false;

// ============================================
// COLUMN NAME MAPPING
// ============================================
function getColumnMapping(headers, tabId) {
    const tabConfig = TABS[tabId];
    const mapping = tabConfig.columnMapping;
    const colMap = {};

    console.log(`📋 Mapping columns for ${tabId}...`);

    headers.forEach((h, i) => {
        if (!h) return;
        const clean = h.trim();
        const lower = clean.toLowerCase();

        Object.keys(mapping).forEach(standardCol => {
            const expected = mapping[standardCol];
            if (clean === expected || lower === expected.toLowerCase()) {
                colMap[standardCol] = i;
                console.log(`  ✓ ${standardCol} → Column ${i} ("${clean}")`);
            }
        });
    });

    // Fuzzy match for DISTRICT
    if (colMap['DISTRICT'] === undefined) {
        headers.forEach((h, i) => {
            if (!h) return;
            const clean = h.trim().toLowerCase();
            if (clean === 'জেলা' || clean === 'district' || clean === 'zila' || clean === 'jela') {
                colMap['DISTRICT'] = i;
                console.log(`  ✓ DISTRICT → Column ${i} ("${h}") [fuzzy]`);
            }
        });
    }

    // Fuzzy match for UPAZILLA/THANA
    if (colMap['UPAZILLA/THANA'] === undefined) {
        headers.forEach((h, i) => {
            if (!h) return;
            const clean = h.trim().toLowerCase();
            if (clean === 'উপজেলা' || clean === 'upazila' || clean === 'upazilla' ||
                clean === 'উপজেলা/থানা' || clean === 'upazilla/thana' || clean === 'upuzillathana') {
                colMap['UPAZILLA/THANA'] = i;
                console.log(`  ✓ UPAZILLA/THANA → Column ${i} ("${h}") [fuzzy]`);
            }
        });
    }

    console.log('🗺️ Final Column Mapping:', colMap);
    return colMap;
}

// ============================================
// TAB SWITCHING
// ============================================
function switchTab(tabId) {
    if (isLoading) return;
    if (tabId === currentTab) return;

    console.log(`🔄 Switching to tab: ${tabId}`);
    currentTab = tabId;
    currentPage = 1;

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.getElementById('heroTitle').textContent = TABS[tabId].title;

    // Hide subject filter for admin tab
    const subjectFilter = document.getElementById('subjectFilter');
    if (subjectFilter) {
        subjectFilter.style.display = tabId === 'admin' ? 'none' : 'block';
    }

    const store = dataStore[tabId];
    if (store.allData.length === 0) {
        loadDataForTab(tabId);
    } else {
        useDataForTab(tabId);
    }
}

function useDataForTab(tabId) {
    const store = dataStore[tabId];
    window.allData = store.allData;
    window.filteredData = store.filteredData;
    populateDropdowns();
    updateStats();
    renderTable();
    renderDashboard();
}

async function loadDataForTab(tabId) {
    const tabConfig = TABS[tabId];
    isLoading = true;

    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) {
        btn.classList.add('loading');
        btn.textContent = '⏳ লোডিং...';
    }

    try {
        console.log(`🔍 Fetching data from sheet: "${tabConfig.sheetName}"...`);

        const encodedSheetName = encodeURIComponent(tabConfig.sheetName);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodedSheetName}?key=${CONFIG.API_KEY}`;

        const response = await fetch(url);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.values || data.values.length === 0) {
            throw new Error(`No data found in sheet: ${tabConfig.sheetName}`);
        }

        console.log(`✅ Found ${data.values.length} rows (including header)`);

        processSheetData(data.values, tabId);

        if (btn) {
            btn.textContent = tabConfig.label;
            btn.classList.remove('loading');
            // Update badge
            const count = dataStore[tabId].allData.length;
            btn.innerHTML = `${tabConfig.label} <span class="badge">${count}</span>`;
        }

        useDataForTab(tabId);

    } catch (error) {
        console.error(`❌ Failed to load ${tabConfig.sheetName}:`, error);
        if (btn) {
            btn.textContent = '⚠️ ত্রুটি';
            btn.classList.remove('loading');
        }
        showError(`"${tabConfig.sheetName}" লোড করতে ব্যর্থ: ${error.message}`);
    }

    isLoading = false;
}

// ============================================
// PROCESS SHEET DATA
// ============================================
function processSheetData(values, tabId) {
    const headers = values[0];
    const rows = values.slice(1);

    console.log(`📋 Processing ${tabId} data...`);
    console.log('📋 Headers found:', headers);

    const colMap = getColumnMapping(headers, tabId);

    const allData = rows.map((row, idx) => {
        const obj = {};

        Object.keys(colMap).forEach(key => {
            const idx2 = colMap[key];
            let val = '';
            if (idx2 !== undefined && row && row[idx2] !== undefined && row[idx2] !== '') {
                val = String(row[idx2]);
            }
            obj[key] = val;
        });

        if (!obj['SL']) {
            obj['SL'] = String(idx + 1);
        }

        return obj;
    });

    dataStore[tabId] = {
        allData: allData,
        filteredData: [...allData]
    };

    console.log(`✅ ${tabId}: Processed ${allData.length} rows`);
    console.log(`📊 Sample row:`, allData[0]);
}

// ============================================
// POPULATE DROPDOWNS
// ============================================
function populateDropdowns() {
    const store = dataStore[currentTab];
    if (!store || store.allData.length === 0) return;

    const allData = store.allData;
    const tabConfig = TABS[currentTab];
    const filterFields = tabConfig.filterFields;

    const fieldMap = {
        'DIVISION': 'division',
        'DISTRICT': 'district',
        'UPAZILLA/THANA': 'upazila',
        'LEVEL': 'level',
        'POST-NAME': 'post',
        'SUBJECT': 'subject'
    };

    filterFields.forEach(field => {
        const id = fieldMap[field];
        if (!id) return;

        const values = [...new Set(allData.map(item => item[field]).filter(v => v && v.trim()))].sort();

        const select = document.getElementById(id);
        if (select) {
            while (select.options.length > 1) {
                select.remove(1);
            }
            values.forEach(val => {
                const option = document.createElement('option');
                option.value = val;
                option.textContent = val;
                select.appendChild(option);
            });
        }
    });
}

// ============================================
// UPDATE STATS
// ============================================
function updateStats() {
    const store = dataStore[currentTab];
    if (!store) return;

    const allData = store.allData;
    const filteredData = store.filteredData;

    const total = allData.length;
    const filtered = filteredData.length;

    document.getElementById('total').textContent = total.toLocaleString('bn-BD');
    document.getElementById('heroCount').textContent = total.toLocaleString('bn-BD');
    document.getElementById('result').textContent = filtered.toLocaleString('bn-BD');

    const districts = new Set(filteredData.map(item => item['DISTRICT']).filter(v => v && v.trim()));
    const madrasas = new Set(filteredData.map(item => item['MADRASHA-NAME']).filter(v => v && v.trim()));

    document.getElementById('districts').textContent = districts.size.toLocaleString('bn-BD');
    document.getElementById('madrasas').textContent = madrasas.size.toLocaleString('bn-BD');
    document.getElementById('heroDistrict').textContent = districts.size.toLocaleString('bn-BD');
    document.getElementById('heroMadrasa').textContent = madrasas.size.toLocaleString('bn-BD');
}

// ============================================
// RENDER TABLE
// ============================================
function renderTable() {
    const store = dataStore[currentTab];
    if (!store) return;

    const filteredData = store.filteredData;
    const start = (currentPage - 1) * pageSize;
    const end = Math.min(start + pageSize, filteredData.length);
    const pageData = filteredData.slice(start, end);

    const totalPages = Math.ceil(filteredData.length / pageSize);
    document.getElementById('range').textContent = filteredData.length ?
        `(${(start + 1).toLocaleString('bn-BD')}–${end.toLocaleString('bn-BD')})` : '';
    document.getElementById('page').textContent =
        `পৃষ্ঠা ${currentPage.toLocaleString('bn-BD')} / ${totalPages.toLocaleString('bn-BD')}`;
    document.getElementById('prev').disabled = currentPage <= 1;
    document.getElementById('next').disabled = currentPage >= totalPages;

    const tbody = document.getElementById('tbody');
    tbody.innerHTML = '';

    const columns = TABS[currentTab].displayColumns;
    pageData.forEach(row => {
        const tr = document.createElement('tr');
        columns.forEach(col => {
            const td = document.createElement('td');
            td.textContent = row[col] || '—';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// ============================================
// RENDER DASHBOARD
// ============================================
function renderDashboard() {
    const store = dataStore[currentTab];
    if (!store) return;

    const filteredData = store.filteredData;
    const barConfigs = TABS[currentTab].dashboardBars;

    Object.keys(barConfigs).forEach(elementId => {
        const field = barConfigs[elementId];
        renderBars(elementId, field, 8, filteredData);
    });
}

function renderBars(elementId, field, limit = 8, data) {
    const counts = {};
    data.forEach(item => {
        const val = item[field];
        if (val && val.trim()) {
            counts[val] = (counts[val] || 0) + 1;
        }
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit);
    const max = sorted[0]?.[1] || 1;

    const container = document.getElementById(elementId);
    container.innerHTML = sorted.map(([name, count]) => `
        <div class="bar">
            <div class="barline">
                <span>${name}</span>
                <b>${count.toLocaleString('bn-BD')}</b>
            </div>
            <div class="track">
                <div class="fill" style="width: ${(count / max) * 100}%"></div>
            </div>
        </div>
    `).join('');
}

// ============================================
// APPLY FILTERS
// ============================================
function applyFilters() {
    const store = dataStore[currentTab];
    if (!store) return;

    const allData = store.allData;
    const searchText = document.getElementById('q').value.trim().toLowerCase();

    const filters = {};
    const tabConfig = TABS[currentTab];
    const fieldMap = {
        'DIVISION': 'division',
        'DISTRICT': 'district',
        'UPAZILLA/THANA': 'upazila',
        'LEVEL': 'level',
        'POST-NAME': 'post',
        'SUBJECT': 'subject'
    };

    tabConfig.filterFields.forEach(field => {
        const id = fieldMap[field];
        if (id) {
            filters[field] = document.getElementById(id).value;
        }
    });

    store.filteredData = allData.filter(item => {
        if (searchText) {
            const searchableFields = ['EIIN', 'MADRASHA-NAME', 'LEVEL', 'POST-NAME', 'DIVISION', 'DISTRICT', 'UPAZILLA/THANA'];
            if (item['SUBJECT']) searchableFields.push('SUBJECT');

            const searchable = searchableFields
                .map(field => item[field] || '')
                .join(' ')
                .toLowerCase();

            if (!searchable.includes(searchText)) return false;
        }

        for (const [field, value] of Object.entries(filters)) {
            if (value && item[field]
