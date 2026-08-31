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

    console.log('📋 Mapping columns for ' + tabId + '...');

    headers.forEach(function(h, i) {
        if (!h) return;
        var clean = h.trim();
        var lower = clean.toLowerCase();

        Object.keys(mapping).forEach(function(standardCol) {
            var expected = mapping[standardCol];
            if (clean === expected || lower === expected.toLowerCase()) {
                colMap[standardCol] = i;
                console.log('  ✓ ' + standardCol + ' → Column ' + i + ' ("' + clean + '")');
            }
        });
    });

    // Fuzzy match for DISTRICT
    if (colMap['DISTRICT'] === undefined) {
        headers.forEach(function(h, i) {
            if (!h) return;
            var clean = h.trim().toLowerCase();
            if (clean === 'জেলা' || clean === 'district' || clean === 'zila' || clean === 'jela') {
                colMap['DISTRICT'] = i;
                console.log('  ✓ DISTRICT → Column ' + i + ' ("' + h + '") [fuzzy]');
            }
        });
    }

    // Fuzzy match for UPAZILLA/THANA
    if (colMap['UPAZILLA/THANA'] === undefined) {
        headers.forEach(function(h, i) {
            if (!h) return;
            var clean = h.trim().toLowerCase();
            if (clean === 'উপজেলা' || clean === 'upazila' || clean === 'upazilla' ||
                clean === 'উপজেলা/থানা' || clean === 'upazilla/thana' || clean === 'upuzillathana') {
                colMap['UPAZILLA/THANA'] = i;
                console.log('  ✓ UPAZILLA/THANA → Column ' + i + ' ("' + h + '") [fuzzy]');
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

    console.log('🔄 Switching to tab: ' + tabId);
    currentTab = tabId;
    currentPage = 1;

    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.getElementById('heroTitle').textContent = TABS[tabId].title;

    var subjectFilter = document.getElementById('subjectFilter');
    if (subjectFilter) {
        subjectFilter.style.display = tabId === 'admin' ? 'none' : 'block';
    }

    var store = dataStore[tabId];
    if (store.allData.length === 0) {
        loadDataForTab(tabId);
    } else {
        useDataForTab(tabId);
    }
}

function useDataForTab(tabId) {
    var store = dataStore[tabId];
    window.allData = store.allData;
    window.filteredData = store.filteredData;
    populateDropdowns();
    updateStats();
    renderTable();
    renderDashboard();
}

async function loadDataForTab(tabId) {
    var tabConfig = TABS[tabId];
    isLoading = true;

    var btn = document.querySelector('.tab-btn[data-tab="' + tabId + '"]');
    if (btn) {
        btn.classList.add('loading');
        btn.textContent = '⏳ লোডিং...';
    }

    try {
        console.log('🔍 Fetching data from sheet: "' + tabConfig.sheetName + '"...');

        var encodedSheetName = encodeURIComponent(tabConfig.sheetName);
        var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + CONFIG.SPREADSHEET_ID + '/values/' + encodedSheetName + '?key=' + CONFIG.API_KEY;

        var response = await fetch(url);

        if (!response.ok) {
            var errorText = await response.text();
            console.error('❌ Error response:', errorText);
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }

        var data = await response.json();

        if (!data.values || data.values.length === 0) {
            throw new Error('No data found in sheet: ' + tabConfig.sheetName);
        }

        console.log('✅ Found ' + data.values.length + ' rows (including header)');

        processSheetData(data.values, tabId);

        if (btn) {
            btn.textContent = tabConfig.label;
            btn.classList.remove('loading');
            var count = dataStore[tabId].allData.length;
            btn.innerHTML = tabConfig.label + ' <span class="badge">' + count + '</span>';
        }

        useDataForTab(tabId);

    } catch (error) {
        console.error('❌ Failed to load ' + tabConfig.sheetName + ':', error);
        if (btn) {
            btn.textContent = '⚠️ ত্রুটি';
            btn.classList.remove('loading');
        }
        showError('"' + tabConfig.sheetName + '" লোড করতে ব্যর্থ: ' + error.message);
    }

    isLoading = false;
}

// ============================================
// PROCESS SHEET DATA
// ============================================
function processSheetData(values, tabId) {
    var headers = values[0];
    var rows = values.slice(1);

    console.log('📋 Processing ' + tabId + ' data...');
    console.log('📋 Headers found:', headers);

    var colMap = getColumnMapping(headers, tabId);

    var allData = rows.map(function(row, idx) {
        var obj = {};

        Object.keys(colMap).forEach(function(key) {
            var idx2 = colMap[key];
            var val = '';
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
        filteredData: allData.slice(0)
    };

    console.log('✅ ' + tabId + ': Processed ' + allData.length + ' rows');
    console.log('📊 Sample row:', allData[0]);
}

// ============================================
// POPULATE DROPDOWNS
// ============================================
function populateDropdowns() {
    var store = dataStore[currentTab];
    if (!store || store.allData.length === 0) return;

    var allData = store.allData;
    var tabConfig = TABS[currentTab];
    var filterFields = tabConfig.filterFields;

    var fieldMap = {
        'DIVISION': 'division',
        'DISTRICT': 'district',
        'UPAZILLA/THANA': 'upazila',
        'LEVEL': 'level',
        'POST-NAME': 'post',
        'SUBJECT': 'subject'
    };

    filterFields.forEach(function(field) {
        var id = fieldMap[field];
        if (!id) return;

        var values = [];
        var seen = {};
        allData.forEach(function(item) {
            var val = item[field];
            if (val && val.trim() && !seen[val]) {
                seen[val] = true;
                values.push(val);
            }
        });
        values.sort();

        var select = document.getElementById(id);
        if (select) {
            while (select.options.length > 1) {
                select.remove(1);
            }
            values.forEach(function(val) {
                var option = document.createElement('option');
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
    var store = dataStore[currentTab];
    if (!store) return;

    var allData = store.allData;
    var filteredData = store.filteredData;

    var total = allData.length;
    var filtered = filteredData.length;

    document.getElementById('total').textContent = total.toLocaleString('bn-BD');
    document.getElementById('heroCount').textContent = total.toLocaleString('bn-BD');
    document.getElementById('result').textContent = filtered.toLocaleString('bn-BD');

    var districts = new Set();
    var madrasas = new Set();
    filteredData.forEach(function(item) {
        var d = item['DISTRICT'];
        var m = item['MADRASHA-NAME'];
        if (d && d.trim()) districts.add(d);
        if (m && m.trim()) madrasas.add(m);
    });

    document.getElementById('districts').textContent = districts.size.toLocaleString('bn-BD');
    document.getElementById('madrasas').textContent = madrasas.size.toLocaleString('bn-BD');
    document.getElementById('heroDistrict').textContent = districts.size.toLocaleString('bn-BD');
    document.getElementById('heroMadrasa').textContent = madrasas.size.toLocaleString('bn-BD');
}

// ============================================
// RENDER TABLE
// ============================================
function renderTable() {
    var store = dataStore[currentTab];
    if (!store) return;

    var filteredData = store.filteredData;
    var start = (currentPage - 1) * pageSize;
    var end = Math.min(start + pageSize, filteredData.length);
    var pageData = filteredData.slice(start, end);

    var totalPages = Math.ceil(filteredData.length / pageSize) || 1;
    document.getElementById('range').textContent = filteredData.length ?
        '(' + (start + 1).toLocaleString('bn-BD') + '–' + end.toLocaleString('bn-BD') + ')' : '';
    document.getElementById('page').textContent =
        'পৃষ্ঠা ' + currentPage.toLocaleString('bn-BD') + ' / ' + totalPages.toLocaleString('bn-BD');
    document.getElementById('prev').disabled = currentPage <= 1;
    document.getElementById('next').disabled = currentPage >= totalPages;

    var tbody = document.getElementById('tbody');
    tbody.innerHTML = '';

    var columns = TABS[currentTab].displayColumns;
    pageData.forEach(function(row) {
        var tr = document.createElement('tr');
        columns.forEach(function(col) {
            var td = document.createElement('td');
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
    var store = dataStore[currentTab];
    if (!store) return;

    var filteredData = store.filteredData;
    var barConfigs = TABS[currentTab].dashboardBars;

    Object.keys(barConfigs).forEach(function(elementId) {
        var field = barConfigs[elementId];
        renderBars(elementId, field, 8, filteredData);
    });
}

function renderBars(elementId, field, limit, data) {
    limit = limit || 8;
    var counts = {};
    data.forEach(function(item) {
        var val = item[field];
        if (val && val.trim()) {
            counts[val] = (counts[val] || 0) + 1;
        }
    });

    var sorted = Object.entries(counts).sort(function(a, b) { return b[1] - a[1]; }).slice(0, limit);
    var max = sorted[0] ? sorted[0][1] : 1;

    var container = document.getElementById(elementId);
    if (!container) return;
    container.innerHTML = sorted.map(function(item) {
        var name = item[0];
        var count = item[1];
        return '<div class="bar">' +
            '<div class="barline">' +
            '<span>' + name + '</span>' +
            '<b>' + count.toLocaleString('bn-BD') + '</b>' +
            '</div>' +
            '<div class="track">' +
            '<div class="fill" style="width: ' + ((count / max) * 100) + '%"></div>' +
            '</div>' +
            '</div>';
    }).join('');
}

// ============================================
// APPLY FILTERS
// ============================================
function applyFilters() {
    var store = dataStore[currentTab];
    if (!store) return;

    var allData = store.allData;
    var searchText = document.getElementById('q').value.trim().toLowerCase();

    var filters = {};
    var tabConfig = TABS[currentTab];
    var fieldMap = {
        'DIVISION': 'division',
        'DISTRICT': 'district',
        'UPAZILLA/THANA': 'upazila',
        'LEVEL': 'level',
        'POST-NAME': 'post',
        'SUBJECT': 'subject'
    };

    tabConfig.filterFields.forEach(function(field) {
        var id = fieldMap[field];
        if (id) {
            filters[field] = document.getElementById(id).value;
        }
    });

    store.filteredData = allData.filter(function(item) {
        if (searchText) {
            var searchableFields = ['EIIN', 'MADRASHA-NAME', 'LEVEL', 'POST-NAME', 'DIVISION', 'DISTRICT', 'UPAZILLA/THANA'];
            if (item['SUBJECT'])
