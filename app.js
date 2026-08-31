// ============================================
// GOOGLE SHEETS CONFIGURATION
// ============================================
var CONFIG = {
    API_KEY: 'AIzaSyCQFgrkG6snidiKMwbYxveVv0ny7wNcn-E',
    SPREADSHEET_ID: '1O5swZSBsdhwv1GnvVGJB_chDZ8a4uAGQtO8UwKSZ1gc'
};

// ============================================
// TAB CONFIGURATION
// ============================================
var TABS = {
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
var dataStore = {
    'vacancy': { allData: [], filteredData: [] },
    'admin': { allData: [], filteredData: [] }
};
var currentTab = 'vacancy';
var currentPage = 1;
var pageSize = 25;
var isLoading = false;

// ============================================
// UTILITY FUNCTIONS
// ============================================
function getElement(id) {
    var el = document.getElementById(id);
    if (!el) {
        console.warn('Element not found: #' + id);
    }
    return el;
}

// ============================================
// COLUMN NAME MAPPING
// ============================================
function getColumnMapping(headers, tabId) {
    var tabConfig = TABS[tabId];
    var mapping = tabConfig.columnMapping;
    var colMap = {};

    console.log('📋 Mapping columns for ' + tabId + '...');

    for (var i = 0; i < headers.length; i++) {
        var h = headers[i];
        if (!h) continue;
        var clean = h.trim();
        var lower = clean.toLowerCase();

        for (var standardCol in mapping) {
            if (mapping.hasOwnProperty(standardCol)) {
                var expected = mapping[standardCol];
                if (clean === expected || lower === expected.toLowerCase()) {
                    colMap[standardCol] = i;
                    console.log('  ✓ ' + standardCol + ' → Column ' + i + ' ("' + clean + '")');
                }
            }
        }
    }

    // Fuzzy match for DISTRICT
    if (colMap['DISTRICT'] === undefined) {
        for (var i = 0; i < headers.length; i++) {
            var h = headers[i];
            if (!h) continue;
            var clean = h.trim().toLowerCase();
            if (clean === 'জেলা' || clean === 'district' || clean === 'zila' || clean === 'jela') {
                colMap['DISTRICT'] = i;
                console.log('  ✓ DISTRICT → Column ' + i + ' ("' + h + '") [fuzzy]');
            }
        }
    }

    // Fuzzy match for UPAZILLA/THANA
    if (colMap['UPAZILLA/THANA'] === undefined) {
        for (var i = 0; i < headers.length; i++) {
            var h = headers[i];
            if (!h) continue;
            var clean = h.trim().toLowerCase();
            if (clean === 'উপজেলা' || clean === 'upazila' || clean === 'upazilla' ||
                clean === 'উপজেলা/থানা' || clean === 'upazilla/thana' || clean === 'upuzillathana') {
                colMap['UPAZILLA/THANA'] = i;
                console.log('  ✓ UPAZILLA/THANA → Column ' + i + ' ("' + h + '") [fuzzy]');
            }
        }
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

    var buttons = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < buttons.length; i++) {
        var btn = buttons[i];
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }

    var heroTitle = getElement('heroTitle');
    if (heroTitle) heroTitle.textContent = TABS[tabId].title;

    var subjectFilter = getElement('subjectFilter');
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

    var allData = [];
    for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var obj = {};

        for (var key in colMap) {
            if (colMap.hasOwnProperty(key)) {
                var idx = colMap[key];
                var val = '';
                if (idx !== undefined && row && row[idx] !== undefined && row[idx] !== '') {
                    val = String(row[idx]);
                }
                obj[key] = val;
            }
        }

        if (!obj['SL']) {
            obj['SL'] = String(i + 1);
        }

        allData.push(obj);
    }

    dataStore[tabId] = {
        allData: allData,
        filteredData: allData.slice(0)
    };

    console.log('✅ ' + tabId + ': Processed ' + allData.length + ' rows');
    if (allData.length > 0) {
        console.log('📊 Sample row:', allData[0]);
    }
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

    for (var f = 0; f < filterFields.length; f++) {
        var field = filterFields[f];
        var id = fieldMap[field];
        if (!id) continue;

        var values = [];
        var seen = {};
        for (var i = 0; i < allData.length; i++) {
            var val = allData[i][field];
            if (val && val.trim() && !seen[val]) {
                seen[val] = true;
                values.push(val);
            }
        }
        values.sort();

        var select = getElement(id);
        if (select) {
            while (select.options.length > 1) {
                select.remove(1);
            }
            for (var v = 0; v < values.length; v++) {
                var option = document.createElement('option');
                option.value = values[v];
                option.textContent = values[v];
                select.appendChild(option);
            }
        }
    }
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

    var totalEl = getElement('total');
    var heroCountEl = getElement('heroCount');
    var resultEl = getElement('result');
    if (totalEl) totalEl.textContent = total.toLocaleString('bn-BD');
    if (heroCountEl) heroCountEl.textContent = total.toLocaleString('bn-BD');
    if (resultEl) resultEl.textContent = filtered.toLocaleString('bn-BD');

    var districts = new Set();
    var madrasas = new Set();
    for (var i = 0; i < filteredData.length; i++) {
        var d = filteredData[i]['DISTRICT'];
        var m = filteredData[i]['MADRASHA-NAME'];
        if (d && d.trim()) districts.add(d);
        if (m && m.trim()) madrasas.add(m);
    }

    var districtsEl = getElement('districts');
    var madrasasEl = getElement('madrasas');
    var heroDistrictEl = getElement('heroDistrict');
    var heroMadrasaEl = getElement('heroMadrasa');
    if (districtsEl) districtsEl.textContent = districts.size.toLocaleString('bn-BD');
    if (madrasasEl) madrasasEl.textContent = madrasas.size.toLocaleString('bn-BD');
    if (heroDistrictEl) heroDistrictEl.textContent = districts.size.toLocaleString('bn-BD');
    if (heroMadrasaEl) heroMadrasaEl.textContent = madrasas.size.toLocaleString('bn-BD');
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

    var rangeEl = getElement('range');
    var pageEl = getElement('page');
    var prevEl = getElement('prev');
    var nextEl = getElement('next');

    if (rangeEl) {
        rangeEl.textContent = filteredData.length ?
            '(' + (start + 1).toLocaleString('bn-BD') + '–' + end.toLocaleString('bn-BD') + ')' : '';
    }
    if (pageEl) {
        pageEl.textContent = 'পৃষ্ঠা ' + currentPage.toLocaleString('bn-BD') + ' / ' + totalPages.toLocaleString('bn-BD');
    }
    if (prevEl) prevEl.disabled = currentPage <= 1;
    if (nextEl) nextEl.disabled = currentPage >= totalPages;

    var tbody = getElement('tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    var columns = TABS[currentTab].displayColumns;
    for (var i = 0; i < pageData.length; i++) {
        var row = pageData[i];
        var tr = document.createElement('tr');
        for (var c = 0; c < columns.length; c++) {
            var col = columns[c];
            var td = document.createElement('td');
            td.textContent = row[col] || '—';
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
}

// ============================================
// RENDER DASHBOARD
// ============================================
function renderDashboard() {
    var store = dataStore[currentTab];
    if (!store) return;

    var filteredData = store.filteredData;
    var barConfigs = TABS[currentTab].dashboardBars;

    for (var elementId in barConfigs) {
        if (barConfigs.hasOwnProperty(elementId)) {
            var field = barConfigs[elementId];
            renderBars(elementId, field, 8, filteredData);
        }
    }
}

function renderBars(elementId, field, limit, data) {
    limit = limit || 8;
    var counts = {};
    for (var i = 0; i < data.length; i++) {
        var val = data[i][field];
        if (val && val.trim()) {
            counts[val] = (counts[val] || 0) + 1;
        }
    }

    var sorted = Object.entries(counts).sort(function(a, b) { return b[1] - a[1]; }).slice(0, limit);
    var max = sorted.length > 0 ? sorted[0][1] : 1;

    var container = getElement(elementId);
    if (!container) return;

    var html = '';
    for (var i = 0; i < sorted.length; i++) {
        var name = sorted[i][0];
        var count = sorted[i][1];
        var width = (count / max) * 100;
        html += '<div class="bar">' +
            '<div class="barline">' +
            '<span>' + name + '</span>' +
            '<b>' + count.toLocaleString('bn-BD') + '</b>' +
            '</div>' +
            '<div class="track">' +
            '<div class="fill" style="width: ' + width + '%;"></div>' +
            '</div>' +
            '</div>';
    }
    container.innerHTML = html;
}

// ============================================
// APPLY FILTERS
// ============================================
function applyFilters() {
    var store = dataStore[currentTab];
    if (!store) return;

    var allData = store.allData;
    var searchInput = getElement('q');
    var searchText = searchInput ? searchInput.value.trim().toLowerCase() : '';

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

    for (var f = 0; f < tabConfig.filterFields.length; f++) {
        var field = tabConfig.filterFields[f];
        var id = fieldMap[field];
        if (id) {
            var el = getElement(id);
            filters[field] = el ? el.value : '';
        }
    }

    store.filteredData = allData.filter(function(item) {
        if (searchText) {
            var searchableFields = ['EIIN', 'MADRASHA-NAME', 'LEVEL', 'POST-NAME', 'DIVISION', 'DISTRICT', 'UPAZILLA/THANA'];
            if (item['SUBJECT']) searchableFields.push('SUBJECT');

            var searchable = '';
            for (var s = 0; s < searchableFields.length; s++) {
                searchable += (item[searchableFields[s]] || '') + ' ';
            }
            searchable = searchable.toLowerCase();

            if (searchable.indexOf(searchText) === -1) return false;
        }

        for (var field in filters) {
            if (filters.hasOwnProperty(field)) {
                var value = filters[field];
                if (value && item[field] !== value) return false;
            }
        }

        return true;
    });

    currentPage = 1;
    updateStats();
    renderTable();
    renderDashboard();
}

// ============================================
// SHOW ERROR MESSAGE
// ============================================
function showError(message) {
    console.error('🚨 Error:', message);

    var totalEl = getElement('total');
    var heroCountEl = getElement('heroCount');
    if (totalEl) totalEl.textContent = 'Error';
    if (heroCountEl) heroCountEl.textContent = '⚠️';

    var tbody = getElement('tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;font-family:monospace;">' +
        '<strong style="color:#c53030;font-size:18px;">❌ ডাটা লোড করতে ব্যর্থ হয়েছে</strong><br>' +
        '<span style="color:#718096;font-size:14px;display:block;margin-top:10px;">' + message + '</span>' +
        '</td></tr>';
}

// ============================================
// RESET ALL FILTERS
// ============================================
function resetFilters() {
    var tabConfig = TABS[currentTab];
    var fieldMap = {
        'DIVISION': 'division',
        'DISTRICT': 'district',
        'UPAZILLA/THANA': 'upazila',
        'LEVEL': 'level',
        'POST-NAME': 'post',
        'SUBJECT': 'subject'
    };

    var qEl = getElement('q');
    if (qEl) qEl.value = '';

    for (var f = 0; f < tabConfig.filterFields.length; f++) {
        var field = tabConfig.filterFields[f];
        var id = fieldMap[field];
        if (id) {
            var el = getElement(id);
            if (el) el.value = '';
        }
    }

    applyFilters();
}

// ============================================
// LOAD ALL DATA
// ============================================
async function loadAllData() {
    console.log('🚀 Loading all tabs...');

    await loadDataForTab('vacancy');

    loadDataForTab('admin').then(function() {
        console.log('✅ All tabs loaded!');
        var adminBtn = document.querySelector('.tab-btn[data-tab="admin"]');
        if (adminBtn && dataStore.admin.allData.length > 0) {
            adminBtn.innerHTML = 'অধ্যক্ষ উপাধ্যক্ষ সুপার সহসুপার <span class="badge">' + dataStore.admin.allData.length + '</span>';
        }
    });
}

// ============================================
// INITIALIZE APP
// ============================================
async function init() {
    console.log('🚀 App starting...');

    var totalEl = getElement('total');
    var heroCountEl = getElement('heroCount');
    if (totalEl) totalEl.textContent = '⏳ লোডিং...';
    if (heroCountEl) heroCountEl.textContent = '⏳';

    // Setup tab switching
    var tabButtons = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < tabButtons.length; i++) {
        var btn = tabButtons[i];
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    }

    // Setup event listeners
    var qEl = getElement('q');
    if (qEl) qEl.addEventListener('input', applyFilters);

    var divisionEl = getElement('division');
    var districtEl = getElement('district');
    var upazilaEl = getElement('upazila');
    var levelEl = getElement('level');
    var postEl = getElement('post');
    var subjectEl = getElement('subject');

    if (divisionEl) divisionEl.addEventListener('change', applyFilters);
    if (districtEl) districtEl.addEventListener('change', applyFilters);
    if (upazilaEl) upazilaEl.addEventListener('change', applyFilters);
    if (levelEl) levelEl.addEventListener('change', applyFilters);
    if (postEl) postEl.addEventListener('change', applyFilters);
    if (subjectEl) subjectEl.addEventListener('change', applyFilters);

    var sizeEl = getElement('size');
    if (sizeEl) {
        sizeEl.addEventListener('change', function() {
            pageSize = parseInt(this.value);
            currentPage = 1;
            renderTable();
        });
    }

    var prevEl = getElement('prev');
    var nextEl = getElement('next');
    if (prevEl) {
        prevEl.addEventListener('click', function() {
            if (currentPage > 1) {
                currentPage--;
                renderTable();
            }
        });
    }
    if (nextEl) {
        nextEl.addEventListener('click', function() {
            var store = dataStore[currentTab];
            if (!store) return;
            var totalPages = Math.ceil(store.filteredData.length / pageSize) || 1;
            if (currentPage < totalPages) {
                currentPage++;
                renderTable();
            }
        });
    }

    var resetEl = getElement('reset');
    if (resetEl) resetEl.addEventListener('click', resetFilters);

    await loadAllData();

    console.log('✅ App initialized!');
}

// Start the app
init();
