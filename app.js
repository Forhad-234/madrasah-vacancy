// ============================================
// GOOGLE SHEETS CONFIGURATION
// ============================================
const CONFIG = {
    API_KEY: 'AIzaSyCQFgrkG6snidiKMwbYxveVv0ny7wNcn-E',
    SPREADSHEET_ID: '1O5swZSBsdhwv1GnvVGJB_chDZ8a4uAGQtO8UwKSZ1gc'
};

// ============================================
// FETCH DATA FROM GOOGLE SHEETS
// ============================================
async function loadDataFromSheet() {
    console.log('🔍 Getting sheet metadata...');
    
    const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}?key=${CONFIG.API_KEY}`;
    
    try {
        const metaResponse = await fetch(metadataUrl);
        const metaData = await metaResponse.json();
        console.log('📋 Sheet metadata:', metaData);
        
        let sheetTitle = metaData.sheets?.[0]?.properties?.title || 'Sheet1';
        
        const yourSheet = metaData.sheets?.find(s => 
            s.properties.title.includes('Madrasah') || 
            s.properties.title.includes('Vacancy')
        );
        if (yourSheet) {
            sheetTitle = yourSheet.properties.title;
        }
        
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
        console.log('📋 First data row:', data.values[1]);
        
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
    
    console.log('📋 Processing headers:', headers);
    console.log('📋 Header count:', headers.length);
    
    // Find column indices with BENGALI column names
    const getColIndex = (englishName, bengaliName) => {
        // Try English first
        let idx = headers.findIndex(h => {
            if (!h) return false;
            return h.trim() === englishName;
        });
        
        // Try Bengali
        if (idx === -1) {
            idx = headers.findIndex(h => {
                if (!h) return false;
                return h.trim() === bengaliName;
            });
        }
        
        // Try case insensitive
        if (idx === -1) {
            idx = headers.findIndex(h => {
                if (!h) return false;
                return h.toLowerCase().trim() === englishName.toLowerCase().trim();
            });
        }
        
        console.log(`🔎 Column "${englishName}" / "${bengaliName}" found at index:`, idx);
        return idx !== -1 ? idx : null;
    };
    
    // Map each column with BENGALI headers
    const colMap = {
        'SL': getColIndex('SL', 'SL'),
        'EIIN': getColIndex('EIIN', 'EIIN'),
        'MADRASHA-NAME': getColIndex('MADRASHA-NAME', 'মাদ্রাসার নাম'),
        'LEVEL': getColIndex('LEVEL', 'লেভেল'),
        'POST-NAME': getColIndex('POST-NAME', 'পদ'),
        'SUBJECT': getColIndex('SUBJECT', 'বিষয়'),
        'DIVISION': getColIndex('DIVISION', 'বিভাগ'),
        'DISTRICT': getColIndex('DISTRICT', 'জেলা'),
        'UPAZILLA/THANA': getColIndex('UPAZILLA/THANA', 'উপজেলা/থানা')
    };
    
    console.log('🗺️ Column mapping:', colMap);
    
    const columnNames = ['SL', 'EIIN', 'MADRASHA-NAME', 'LEVEL', 'POST-NAME', 'SUBJECT', 'DIVISION', 'DISTRICT', 'UPAZILLA/THANA'];
    
    // Build rows array
    const rowData = rows.map((row, idx) => {
        return columnNames.map(col => {
            const idx2 = colMap[col];
            let val = '';
            if (idx2 !== null && row && row[idx2] !== undefined && row[idx2] !== '') {
                val = String(row[idx2]);
            }
            // If SL column doesn't exist or is empty, use row index + 1
            if (col === 'SL' && !val) {
                val = String(idx + 1);
            }
            return val;
        });
    });
    
    // Build dicts
    const dicts = {};
    columnNames.forEach((col, colIndex) => {
        dicts[col] = rowData.map(row => row[colIndex] || '');
    });
    
    console.log('📊 Dicts built:', Object.keys(dicts));
    console.log('📊 Sample dict (MADRASHA-NAME):', dicts['MADRASHA-NAME']?.slice(0, 3));
    console.log('📊 Sample dict (LEVEL):', dicts['LEVEL']?.slice(0, 3));
    console.log('📊 Sample dict (POST-NAME):', dicts['POST-NAME']?.slice(0, 3));
    console.log('📊 Sample dict (DIVISION):', dicts['DIVISION']?.slice(0, 3));
    
    const result = {
        columns: columnNames,
        dicts: dicts,
        rows: rowData
    };
    
    console.log(`✅ Converted ${rowData.length} rows successfully`);
    console.log('📊 Sample row:', rowData[0]);
    
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
                            <p style="color:#e53e3e;margin-top:10px;">
                                ⚠️ নিশ্চিত করুন:<br>
                                1. Sheet টি "Anyone with link can view" এ সেট করা আছে<br>
                                2. Google Sheets API টি Enable করা আছে
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
    const totalEl = document.getElementById('total');
    const heroCountEl = document.getElementById('heroCount');
    if (totalEl) totalEl.textContent = '⏳ লোডিং...';
    if (heroCountEl) heroCountEl.textContent = '⏳';
    
    // Load data from Google Sheets
    const D = await loadDataFromSheet();
    
    if (!D) {
        console.error('❌ No data returned, app cannot start');
        return;
    }
    
    console.log('✅ Data loaded successfully, initializing app...');
    console.log('📊 Data structure:', {
        columns: D.columns,
        rowsCount: D.rows.length,
        dictsKeys: Object.keys(D.dicts),
        sampleRow: D.rows[0]
    });
    
    window.MADRASA_DATA = D;
    
    // ===== ORIGINAL CODE =====
    const C = D.columns;
    const R = D.rows;
    const dict = D.dicts;
    const ix = Object.fromEntries(C.map((c, i) => [c, i]));
    
    console.log('🔑 Index mapping:', ix);
    
    const v = (c, n) => {
        const val = dict[c]?.[n];
        return val || '';
    };
    const $ = x => document.getElementById(x);
    
    let state = { rows: R, page: 1, size: 25 };
    
    $("total").textContent = R.length.toLocaleString("bn-BD");
    $("heroCount").textContent = R.length.toLocaleString("bn-BD");
    
    function unique(c) {
        const values = R.map(r => v(c, r[ix[c]]));
        const uniqueValues = [...new Set(values)].filter(x => x).sort((a, b) => a.localeCompare(b));
        console.log(`📊 Unique values for ${c}:`, uniqueValues.slice(0, 5));
        return uniqueValues;
    }
    
    function fill(id, c) {
        unique(c).forEach(x => {
            let o = document.createElement("option");
            o.value = x;
            o.textContent = x;
            $(id).append(o);
        });
    }
    
    fill("division", "DIVISION");
    fill("district", "DISTRICT");
    fill("upazila", "UPAZILLA/THANA");
    fill("level", "LEVEL");
    fill("post", "POST-NAME");
    fill("subject", "SUBJECT");
    
    function apply() {
        let q = $("q").value.trim().toLowerCase();
        let fs = {
            "DIVISION": $("division").value,
            "DISTRICT": $("district").value,
            "UPAZILLA/THANA": $("upazila").value,
            "LEVEL": $("level").value,
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
            ["SL", "EIIN", "MADRASHA-NAME", "LEVEL", "POST-NAME", "SUBJECT", "DIVISION", "DISTRICT", "UPAZILLA/THANA"].forEach((c, j) => {
                let td = document.createElement("td");
                if (j < 2) {
                    td.textContent = r[ix[c]] || '';
                } else {
                    const val = v(c, r[ix[c]]);
                    td.textContent = val || '';
                }
                tr.append(td);
            });
            tb.append(tr);
        }
    }
    
    function bars(id, c, n = 8) {
        let counts = {};
        state.rows.forEach(r => {
            let x = v(c, r[ix[c]]);
            if (x) {
                counts[x] = (counts[x] || 0) + 1;
            }
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
