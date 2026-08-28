// ============================================
// GOOGLE SHEETS CONFIGURATION
// ============================================
const CONFIG = {
    API_KEY: 'AIzaSyCQFgrkG6snidiKMwbYxveVv0ny7wNcn-E',
    SPREADSHEET_ID: '1O5swZSBsdhwv1GnvVGJB_chDZ8a4uAGQtO8UwKSZ1gc',
    SHEET_NAME: 'Madrasah_Vacancy_August_2026'
};

// ============================================
// FETCH DATA FROM GOOGLE SHEETS
// ============================================
async function loadDataFromSheet() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${CONFIG.SHEET_NAME}?key=${CONFIG.API_KEY}`;
    
    console.log('🔍 Fetching data from:', url);
    
    try {
        const response = await fetch(url);
        console.log('📡 Response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📊 Raw data received:', data);
        
        if (!data.values || data.values.length === 0) {
            throw new Error('No data found in sheet - check sheet name and permissions');
        }
        
        console.log(`✅ Found ${data.values.length} rows (including header)`);
        console.log('📋 Headers:', data.values[0]);
        console.log('📋 First data row:', data.values[1]);
        
        // Convert Google Sheets data to match expected format
        return convertSheetDataToMadrasaFormat(data.values);
    } catch (error) {
        console.error('❌ Failed to load data:', error);
        showError(error.message);
        return null;
    }
}

// ============================================
// CONVERT SHEET DATA TO REQUIRED FORMAT
// ============================================
function convertSheetDataToMadrasaFormat(values) {
    const headers = values[0];
    const rows = values.slice(1);
    
    // Find column indices (case insensitive)
    const getColIndex = (name) => {
        const idx = headers.findIndex(h => h.toLowerCase().trim() === name.toLowerCase().trim());
        console.log(`🔎 Column "${name}" found at index:`, idx);
        return idx !== -1 ? idx : null;
    };
    
    // Map each column - UPDATED: LAVEL → LEVEL
    const colMap = {
        'SL': getColIndex('SL'),
        'EIIN': getColIndex('EIIN'),
        'MADRASHA-NAME': getColIndex('MADRASHA-NAME'),
        'LEVEL': getColIndex('LEVEL'),  // Changed from LAVEL
        'POST-NAME': getColIndex('POST-NAME'),
        'SUBJECT': getColIndex('SUBJECT'),
        'DIVISION': getColIndex('DIVISION'),
        'DISTRICT': getColIndex('DISTRICT'),
        'UPAZILLA/THANA': getColIndex('UPAZILLA/THANA')
    };
    
    console.log('🗺️ Column mapping:', colMap);
    
    // Check if any required columns are missing
    const missingCols = Object.entries(colMap)
        .filter(([key, val]) => val === null)
        .map(([key]) => key);
    
    if (missingCols.length > 0) {
        console.warn('⚠️ Missing columns:', missingCols);
        // Try to map by position as fallback
        const fallbackMap = {
            'SL': 0,
            'EIIN': 1,
            'MADRASHA-NAME': 2,
            'LEVEL': 3,  // Changed from LAVEL
            'POST-NAME': 4,
            'SUBJECT': 5,
            'DIVISION': 6,
            'DISTRICT': 7,
            'UPAZILLA/THANA': 8
        };
        
        // Use fallback for missing columns
        Object.keys(colMap).forEach(key => {
            if (colMap[key] === null && fallbackMap[key] !== undefined) {
                colMap[key] = fallbackMap[key];
                console.log(`🔄 Using fallback for "${key}" at index ${fallbackMap[key]}`);
            }
        });
    }
    
    // Updated column names list
    const columnNames = ['SL', 'EIIN', 'MADRASHA-NAME', 'LEVEL', 'POST-NAME', 'SUBJECT', 'DIVISION', 'DISTRICT', 'UPAZILLA/THANA'];
    
    // Build dicts
    const dicts = {};
    columnNames.forEach(col => {
        const idx = colMap[col];
        dicts[col] = rows.map(row => (row && row[idx] !== undefined && row[idx] !== '') ? String(row[idx]) : '');
    });
    
    // Build rows array
    const rowData = rows.map((row, idx) => {
        return columnNames.map(col => {
            const idx2 = colMap[col];
            const val = (row && row[idx2] !== undefined && row[idx2] !== '') ? String(row[idx2]) : '';
            return col === 'SL' && !val ? String(idx + 1) : val;
        });
    });
    
    const result = {
        columns: columnNames,
        dicts: dicts,
        rows: rowData
    };
    
    console.log(`✅ Converted ${rowData.length} rows successfully`);
    console.log('📊 Sample row:', rowData[0]);
    console.log('📊 Dict sample (LEVEL):', dicts.LEVEL.slice(0, 5));
    
    return result;
}

// ============================================
// SHOW ERROR MESSAGE
// ============================================
function showError(message) {
    console.error('🚨 Showing error:', message);
    
    const heroCount = document.getElementById('heroCount');
    if (heroCount) heroCount.textContent = '⚠️';
    
    const total = document.getElementById('total');
    if (total) total.textContent = 'Error';
    
    const tbody = document.getElementById('tbody');
    if (tbody) {
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
                            <p><strong>Sheet Name:</strong> ${CONFIG.SHEET_NAME}</p>
                            <p style="color:#e53e3e;margin-top:10px;">
                                ⚠️ নিশ্চিত করুন:<br>
                                1. Sheet টি "Anyone with link can view" এ সেট করা আছে<br>
                                2. Sheet এর নাম ঠিক আছে (Case Sensitive)<br>
                                3. API Key টি Google Sheets API এর জন্য Enable করা আছে
                            </p>
                        </div>
                    </details>
                </td>
            </tr>
        `;
    }
}

// ============================================
// ORIGINAL APP LOGIC (MODIFIED)
// ============================================
(async function init() {
    console.log('🚀 App starting...');
    
    // Show loading state
    document.getElementById('total').textContent = '⏳ লোডিং...';
    document.getElementById('heroCount').textContent = '⏳';
    
    // Load data from Google Sheets
    const D = await loadDataFromSheet();
    
    if (!D) {
        console.error('❌ No data returned, app cannot start');
        return;
    }
    
    console.log('✅ Data loaded successfully, initializing app...');
    window.MADRASA_DATA = D;
    
    // ===== ORIGINAL CODE =====
    const C = D.columns;
    const R = D.rows;
    const dict = D.dicts;
    const ix = Object.fromEntries(C.map((c, i) => [c, i]));
    
    const v = (c, n) => dict[c][n];
    const $ = x => document.getElementById(x);
    
    let state = { rows: R, page: 1, size: 25 };
    
    $("total").textContent = R.length.toLocaleString("bn-BD");
    $("heroCount").textContent = R.length.toLocaleString("bn-BD");
    
    function unique(c) {
        return [...new Set(R.map(r => v(c, r[ix[c]])))].sort((a, b) => a.localeCompare(b));
    }
    
    function fill(id, c) {
        unique(c).forEach(x => {
            let o = document.createElement("option");
            o.value = x;
            o.textContent = x;
            $(id).append(o);
        });
    }
    
    // Updated: LEVEL instead of LAVEL
    fill("division", "DIVISION");
    fill("district", "DISTRICT");
    fill("upazila", "UPAZILLA/THANA");
    fill("level", "LEVEL");  // Changed from LAVEL
    fill("post", "POST-NAME");
    fill("subject", "SUBJECT");
    
    function apply() {
        let q = $("q").value.trim().toLowerCase();
        let fs = {
            "DIVISION": $("division").value,
            "DISTRICT": $("district").value,
            "UPAZILLA/THANA": $("upazila").value,
            "LEVEL": $("level").value,  // Changed from LAVEL
            "POST-NAME": $("post").value,
            "SUBJECT": $("subject").value
        };
        state.rows = R.filter(r => {
            if (q) {
                let h = [r[ix.EIIN], ...Object.keys(fs).map(c => v(c, r[ix[c]]))].join(" ").toLowerCase();
                if (!h.includes(q)) return false;
            }
            return Object.entries(fs).every(([c, x]) => !x || v(c, r[ix[c]]) === x);
        });
        state.page = 1;
        render();
    }
    
    function render() {
        let a = state.rows, s = state.size;
        let p = Math.max(1, Math.ceil(a.length / s));
        state.page = Math.min(state.page, p);
        let st = (state.page - 1) * s, en = Math.min(st + s, a.length);
        $("result").textContent = a.length.toLocaleString("bn-BD");
        $("districts").textContent = new Set(a.map(r => v("DISTRICT", r[ix.DISTRICT]))).size.toLocaleString("bn-BD");
        $("madrasas").textContent = new Set(a.map(r => v("MADRASHA-NAME", r[ix["MADRASHA-NAME"]]))).size.toLocaleString("bn-BD");
        $("range").textContent = a.length ? `(${(st + 1).toLocaleString("bn-BD")}–${en.toLocaleString("bn-BD")})` : "";
        $("page").textContent = `পৃষ্ঠা ${state.page.toLocaleString("bn-BD")} / ${p.toLocaleString("bn-BD")}`;
        $("prev").disabled = state.page <= 1;
        $("next").disabled = state.page >= p;
        let tb = $("tbody");
        tb.innerHTML = "";
        for (let i = st; i < en; i++) {
            let r = a[i], tr = document.createElement("tr");
            // Updated: LEVEL instead of LAVEL
            ["SL", "EIIN", "MADRASHA-NAME", "LEVEL", "POST-NAME", "SUBJECT", "DIVISION", "DISTRICT", "UPAZILLA/THANA"].forEach((c, j) => {
                let td = document.createElement("td");
                td.textContent = j < 2 ? r[ix[c]] : v(c, r[ix[c]]);
                tr.append(td);
            });
            tb.append(tr);
        }
    }
    
    function bars(id, c, n = 8) {
        let counts = {};
        state.rows.forEach(r => {
            let x = v(c, r[ix[c]]);
            counts[x] = (counts[x] || 0) + 1;
        });
        let top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n);
        let max = top[0]?.[1] || 1;
        $(id).innerHTML = top.map(([k, n]) =>
            `<div class="bar"><div class="barline"><span>${k}</span><b>${n.toLocaleString("bn-BD")}</b></div><div class="track"><div class="fill" style="width:${n / max * 100}%"></div></div></div>`
        ).join("");
    }
    
    function dashboard() {
        bars("districtBars", "DISTRICT", 8);
        bars("divisionBars", "DIVISION", 8);
        bars("subjectBars", "SUBJECT", 8);
    }
    
    ["q", "division", "district", "upazila", "level", "post", "subject"].forEach(id =>
        $(id).addEventListener(id === "q" ? "input" : "change", () => { apply(); dashboard(); })
    );
    
    $("size").onchange = () => { state.size = +$("size").value; state.page = 1; render(); };
    $("prev").onclick = () => { state.page--; render(); };
    $("next").onclick = () => { state.page++; render(); };
    $("reset").onclick = () => {
        ["q", "division", "district", "upazila", "level", "post", "subject"].forEach(id => $(id).value = "");
        apply();
        dashboard();
    };
    
    dashboard();
    render();
    console.log('✅ App initialized successfully!');
})();
