// ============================================
// GOOGLE SHEETS CONFIGURATION
// ============================================
const CONFIG = {
    API_KEY: 'AIzaSyCQFgrkG6snidiKMwbYxveVv0ny7wNcn-E',
    SPREADSHEET_ID: '1O5swZSBsdhwv1GnvVGJB_chDZ8a4uAGQtO8UwKSZ1gc'
};

// ============================================
// GLOBAL DATA STORE
// ============================================
let allData = [];
let filteredData = [];
let currentPage = 1;
let pageSize = 25;

// ============================================
// FETCH DATA FROM GOOGLE SHEETS
// ============================================
async function loadDataFromSheet() {
    console.log('🔍 Fetching data from Google Sheets...');
    
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}?key=${CONFIG.API_KEY}`;
    
    try {
        const metaResponse = await fetch(metadataUrl);
        const metaData = await metaResponse.json();
        console.log('📋 Sheet metadata:', metaData);
        
        let sheetTitle = metaData.sheets?.[0]?.properties?.title || 'Sheet1';
        console.log(`📄 Using sheet name: "${sheetTitle}"`);
        
        const encodedSheetName = encodeURIComponent(sheetTitle);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodedSheetName}?key=${CONFIG.API_KEY}`;
        console.log('🔍 Fetching data from:', url);
        
        const response = await fetch(url);
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error response:', errorText);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📊 Data received:', data);
        
        if (!data.values || data.values.length === 0) {
            throw new Error('No data found in sheet');
        }
        
        console.log(`✅ Found ${data.values.length} rows (including header)`);
        console.log('📋 Headers:', data.values[0]);
        
        // Log first 3 rows of data
        console.log('📋 First data row:', data.values[1]);
        console.log('📋 Second data row:', data.values[2]);
        console.log('📋 Third data row:', data.values[3]);
        
        // Process the data
        processSheetData(data.values);
        
    } catch (error) {
        console.error('❌ Failed to load data:', error);
        showError(error.message);
    }
}

// ============================================
// PROCESS SHEET DATA
// ============================================
function processSheetData(values) {
    const headers = values[0];
    const rows = values.slice(1);
    
    console.log('📋 Processing headers...');
    
    // Log each header with its index
    console.log('📋 HEADER MAPPING:');
    headers.forEach((h, i) => {
        console.log(`  Column ${i}: "${h}"`);
    });
    
    // ============================================
    // CRITICAL: Define column mapping
    // ============================================
    const colMap = {};
    
    // Try to find each column by name (case insensitive)
    headers.forEach((h, i) => {
        if (!h) return;
        const clean = h.trim();
        const lower = clean.toLowerCase();
        
        if (lower === 'sl' || lower === 's/l') colMap['SL'] = i;
        else if (lower === 'eiin' || lower === 'ein') colMap['EIIN'] = i;
        else if (lower === 'মাদ্রাসার নাম' || lower === 'madrasha-name' || lower === 'madrasha name') colMap['MADRASHA-NAME'] = i;
        else if (lower === 'লেভেল' || lower === 'level') colMap['LEVEL'] = i;
        else if (lower === 'পদ' || lower === 'post-name' || lower === 'post name') colMap['POST-NAME'] = i;
        else if (lower === 'বিষয়' || lower === 'subject') colMap['SUBJECT'] = i;
        else if (lower === 'বিভাগ' || lower === 'division') colMap['DIVISION'] = i;
        else if (lower === 'জেলা' || lower === 'district') colMap['DISTRICT'] = i;
        else if (lower === 'উপজেলা/থানা' || lower === 'upazilla/thana' || lower === 'upuzillathana') colMap['UPAZILLA/THANA'] = i;
    });
    
    console.log('🗺️ Final Column Mapping:', colMap);
    
    // Build data array
    allData = rows.map((row, idx) => {
        const obj = {};
        Object.keys(colMap).forEach(key => {
            const idx2 = colMap[key];
            let val = '';
            if (idx2 !== undefined && row && row[idx2] !== undefined && row[idx2] !== '') {
                val = String(row[idx2]);
            }
            // If SL is empty, use index + 1
            if (key === 'SL' && !val) {
                val = String(idx + 1);
            }
            obj[key] = val;
        });
        return obj;
    });
    
    console.log('✅ Processed', allData.length, 'rows');
    console.log('📊 Sample row (first record):', allData[0]);
    console.log('📊 Sample MADRASHA-NAME:', allData[0]?.['MADRASHA-NAME']);
    console.log('📊 Sample LEVEL:', allData[0]?.['LEVEL']);
    console.log('📊 Sample DIVISION:', allData[0]?.['DIVISION']);
    console.log('📊 Sample DISTRICT:', allData[0]?.['DISTRICT']);
    console.log('📊 Sample POST-NAME:', allData[0]?.['POST-NAME']);
    console.log('📊 Sample SUBJECT:', allData[0]?.['SUBJECT']);
    
    // Check if data is empty
    const hasData = allData.some(item => item['MADRASHA-NAME'] || item['LEVEL']);
    console.log('📊 Has meaningful data?', hasData);
    
    // Initialize filtered data
    filteredData = [...allData];
    
    // Populate dropdowns
    populateDropdowns();
    
    // Update UI
    updateStats();
    renderTable();
    renderDashboard();
}

// ============================================
// POPULATE DROPDOWNS
// ============================================
function populateDropdowns() {
    const fields = {
        'division': 'DIVISION',
        'district': 'DISTRICT',
        'upazila': 'UPAZILLA/THANA',
        'level': 'LEVEL',
        'post': 'POST-NAME',
        'subject': 'SUBJECT'
    };
    
    Object.keys(fields).forEach(id => {
        const field = fields[id];
        const values = [...new Set(allData.map(item => item[field]).filter(v => v && v.trim()))].sort();
        
        console.log(`📊 ${field} has ${values.length} unique values`);
        if (values.length > 0) {
            console.log(`📊 First 5 ${field} values:`, values.slice(0, 5));
        } else {
            console.log(`⚠️ WARNING: No values found for ${field}!`);
            console.log(`   Check if column "${field}" exists in your sheet`);
        }
        
        const select = document.getElementById(id);
        if (select) {
            // Clear existing options (keep first one)
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
    const total = allData.length;
    const filtered = filteredData.length;
    
    document.getElementById('total').textContent = total.toLocaleString('bn-BD');
    document.getElementById('heroCount').textContent = total.toLocaleString('bn-BD');
    document.getElementById('result').textContent = filtered.toLocaleString('bn-BD');
    
    const districts = new Set(filteredData.map(item => item['DISTRICT']).filter(v => v && v.trim()));
    const madrasas = new Set(filteredData.map(item => item['MADRASHA-NAME']).filter(v => v && v.trim()));
    
    document.getElementById('districts').textContent = districts.size.toLocaleString('bn-BD');
    document.getElementById('madrasas').textContent = madrasas.size.toLocaleString('bn-BD');
}

// ============================================
// RENDER TABLE
// ============================================
function renderTable() {
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
    
    pageData.forEach(row => {
        const tr = document.createElement('tr');
        const columns = ['SL', 'EIIN', 'MADRASHA-NAME', 'LEVEL', 'POST-NAME', 'SUBJECT', 'DIVISION', 'DISTRICT', 'UPAZILLA/THANA'];
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
    renderBars('districtBars', 'DISTRICT', 8);
    renderBars('divisionBars', 'DIVISION', 8);
    renderBars('subjectBars', 'SUBJECT', 8);
}

function renderBars(elementId, field, limit = 8) {
    const counts = {};
    filteredData.forEach(item => {
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
    const searchText = document.getElementById('q').value.trim().toLowerCase();
    const filters = {
        'DIVISION': document.getElementById('division').value,
        'DISTRICT': document.getElementById('district').value,
        'UPAZILLA/THANA': document.getElementById('upazila').value,
        'LEVEL': document.getElementById('level').value,
        'POST-NAME': document.getElementById('post').value,
        'SUBJECT': document.getElementById('subject').value
    };
    
    filteredData = allData.filter(item => {
        if (searchText) {
            const searchable = [
                item['EIIN'],
                item['MADRASHA-NAME'],
                item['LEVEL'],
                item['POST-NAME'],
                item['SUBJECT'],
                item['DIVISION'],
                item['DISTRICT'],
                item['UPAZILLA/THANA']
            ].join(' ').toLowerCase();
            if (!searchable.includes(searchText)) return false;
        }
        
        for (const [field, value] of Object.entries(filters)) {
            if (value && item[field] !== value) return false;
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
    
    document.getElementById('total').textContent = 'Error';
    document.getElementById('heroCount').textContent = '⚠️';
    
    const tbody = document.getElementById('tbody');
    tbody.innerHTML = `
        <tr>
            <td colspan="9" style="text-align:center;padding:40px;font-family:monospace;">
                <strong style="color:#c53030;font-size:18px;">❌ ডাটা লোড করতে ব্যর্থ হয়েছে</strong><br>
                <span style="color:#718096;font-size:14px;display:block;margin-top:10px;">
                    ${message}
                </span>
            </td>
        </tr>
    `;
}

// ============================================
// RESET ALL FILTERS
// ============================================
function resetFilters() {
    ['q', 'division', 'district', 'upazila', 'level', 'post', 'subject'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    applyFilters();
}

// ============================================
// INITIALIZE APP
// ============================================
async function init() {
    console.log('🚀 App starting...');
    
    document.getElementById('total').textContent = '⏳ লোডিং...';
    document.getElementById('heroCount').textContent = '⏳';
    
    document.getElementById('q').addEventListener('input', applyFilters);
    document.getElementById('division').addEventListener('change', applyFilters);
    document.getElementById('district').addEventListener('change', applyFilters);
    document.getElementById('upazila').addEventListener('change', applyFilters);
    document.getElementById('level').addEventListener('change', applyFilters);
    document.getElementById('post').addEventListener('change', applyFilters);
    document.getElementById('subject').addEventListener('change', applyFilters);
    
    document.getElementById('size').addEventListener('change', function() {
        pageSize = parseInt(this.value);
        currentPage = 1;
        renderTable();
    });
    
    document.getElementById('prev').addEventListener('click', function() {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });
    
    document.getElementById('next').addEventListener('click', function() {
        const totalPages = Math.ceil(filteredData.length / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });
    
    document.getElementById('reset').addEventListener('click', resetFilters);
    
    await loadDataFromSheet();
    
    console.log('✅ App initialized!');
}

// Start the app
init();
