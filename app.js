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
    
    // First, get the sheet metadata to find the correct sheet name
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}?key=${CONFIG.API_KEY}`;
    
    try {
        const metaResponse = await fetch(metadataUrl);
        const metaData = await metaResponse.json();
        console.log('📋 Sheet metadata:', metaData);
        
        // Get the first sheet title
        let sheetTitle = metaData.sheets?.[0]?.properties?.title || 'Sheet1';
        console.log(`📄 Using sheet name: "${sheetTitle}"`);
        
        // Fetch the actual data
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
        console.log('📋 First data row:', data.values[1]);
        
        // Store the data globally
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
    
    console.log('📋 Processing data...');
    console.log('📋 Headers found:', headers);
    
    // Show all headers with their indices
    headers.forEach((h, i) => {
        console.log(`  Column ${i}: "${h}"`);
    });
    
    // Map column indices - TRY BOTH ENGLISH AND BENGALI
    const getColIndex = (names) => {
        for (const name of names) {
            const idx = headers.findIndex(h => {
                if (!h) return false;
                return h.trim() === name;
            });
            if (idx !== -1) return idx;
        }
        // Try case insensitive
        for (const name of names) {
            const idx = headers.findIndex(h => {
                if (!h) return false;
                return h.toLowerCase().trim() === name.toLowerCase().trim();
            });
            if (idx !== -1) return idx;
        }
        return -1;
    };
    
    // Map each column with multiple possible names
    const colMap = {
        'SL': getColIndex(['SL', 'S/L', 'Serial']),
        'EIIN': getColIndex(['EIIN', 'EIN', 'Eiin']),
        'MADRASHA-NAME': getColIndex(['মাদ্রাসার নাম', 'MADRASHA-NAME', 'Madrasha Name', 'NAME']),
        'LEVEL': getColIndex(['লেভেল', 'LEVEL', 'Level', 'LAVEL']),
        'POST-NAME': getColIndex(['পদ', 'POST-NAME', 'Post Name', 'POST']),
        'SUBJECT': getColIndex(['বিষয়', 'SUBJECT', 'Subject']),
        'DIVISION': getColIndex(['বিভাগ', 'DIVISION', 'Division']),
        'DISTRICT': getColIndex(['জেলা', 'DISTRICT', 'District']),
        'UPAZILLA/THANA': getColIndex(['উপজেলা/থানা', 'UPAZILLA/THANA', 'Upazilla', 'Thana', 'UPUZILLATHANA'])
    };
    
    console.log('🗺️ Column mapping:', colMap);
    
    // Build data array
    allData = rows.map((row, idx) => {
        const obj = {};
        Object.keys(colMap).forEach(key => {
            const idx2 = colMap[key];
            let val = '';
            if (idx2 !== -1 && row && row[idx2] !== undefined && row[idx2] !== '') {
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
    console.log('📊 Sample row:', allData[0]);
    console.log('📊 Sample MADRASHA-NAME:', allData[0]?.['MADRASHA-NAME']);
    console.log('📊 Sample LEVEL:', allData[0]?.['LEVEL']);
    console.log('📊 Sample DIVISION:', allData[0]?.['DIVISION']);
    
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
    
    // Unique districts and madrasas
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
    
    // Update pagination info
    const totalPages = Math.ceil(filteredData.length / pageSize);
    document.getElementById('range').textContent = filteredData.length ? 
        `(${(start + 1).toLocaleString('bn-BD')}–${end.toLocaleString('bn-BD')})` : '';
    document.getElementById('page').textContent = 
        `পৃষ্ঠা ${currentPage.toLocaleString('bn-BD')} / ${totalPages.toLocaleString('bn-BD')}`;
    document.getElementById('prev').disabled = currentPage <= 1;
    document.getElementById('next').disabled = currentPage >= totalPages;
    
    // Render table rows
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
        // Search filter
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
        
        // Dropdown filters
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
                <details style="margin-top:15px;text-align:left;max-width:600px;margin-left:auto;margin-right:auto;">
                    <summary style="cursor:pointer;color:#4299e1;">🔧 Technical Details</summary>
                    <div style="background:#f7fafc;padding:15px;border-radius:8px;margin-top:10px;font-size:12px;overflow:auto;">
                        <p><strong>API Key:</strong> ${CONFIG.API_KEY.slice(0, 10)}...${CONFIG.API_KEY.slice(-5)}</p>
                        <p><strong>Sheet ID:</strong> ${CONFIG.SPREADSHEET_ID}</p>
                        <p style="color:#e53e3e;margin-top:10px;">
                            ⚠️ নিশ্চিত করুন:<br>
                            1. Sheet টি "Anyone with link can view" এ সেট করা আছে<br>
                            2. Google Sheets API টি Enable করা আছে<br>
                            3. আপনার শীটের কলামের নাম ঠিক আছে
                        </p>
                    </div>
                </details>
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
    
    // Show loading state
    document.getElementById('total').textContent = '⏳ লোডিং...';
    document.getElementById('heroCount').textContent = '⏳';
    
    // Set up event listeners
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
    
    // Load data
    await loadDataFromSheet();
    
    console.log('✅ App initialized!');
}

// Start the app
init();
