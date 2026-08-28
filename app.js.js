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
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        
        if (!data.values || data.values.length === 0) {
            throw new Error('No data found in sheet');
        }
        
        // Convert Google Sheets data to match expected format
        return convertSheetDataToMadrasaFormat(data.values);
    } catch (error) {
        console.error('Failed to load data:', error);
        showError(error.message);
        return null;
    }
}

// ============================================
// CONVERT SHEET DATA TO REQUIRED FORMAT
// ============================================
function convertSheetDataToMadrasaFormat(values) {
    const headers = values[0]; // First row = column headers
    const rows = values.slice(1); // Rest = data rows
    
    // Column indices (case insensitive)
    const colIndex = (name) => {
        const lowerName = name.toLowerCase();
        return headers.findIndex(h => h.toLowerCase() === lowerName);
    };
    
    // Map to expected columns
    const map = {
        'SL': colIndex('SL') !== -1 ? colIndex('SL') : 0,
        'EIIN': colIndex('EIIN') !== -1 ? colIndex('EIIN') : 1,
        'MADRASHA-NAME': colIndex('MADRASHA-NAME') !== -1 ? colIndex('MADRASHA-NAME') : 2,
        'LAVEL': colIndex('LAVEL') !== -1 ? colIndex('LAVEL') : 3,
        'POST-NAME': colIndex('POST-NAME') !== -1 ? colIndex('POST-NAME') : 4,
        'SUBJECT': colIndex('SUBJECT') !== -1 ? colIndex('SUBJECT') : 5,
        'DIVISION': colIndex('DIVISION') !== -1 ? colIndex('DIVISION') : 6,
        'DISTRICT': colIndex('DISTRICT') !== -1 ? colIndex('DISTRICT') : 7,
        'UPAZILLA/THANA': colIndex('UPAZILLA/THANA') !== -1 ? colIndex('UPAZILLA/THANA') : 8
    };
    
    const columnNames = ['SL', 'EIIN', 'MADRASHA-NAME', 'LAVEL', 'POST-NAME', 'SUBJECT', 'DIVISION', 'DISTRICT', 'UPAZILLA/THANA'];
    
    // Build dicts (for lookup by index)
    const dicts = {};
    columnNames.forEach(col => {
        dicts[col] = rows.map(row => row[map[col]] || '');
    });
    
    // Build rows array (each row as array of values)
    const rowData = rows.map((row, idx) => {
        return columnNames.map(col => {
            const val = row[map[col]] || '';
            // For SL, use index if empty
            if (col === 'SL' && !val) return String(idx + 1);
            return val;
        });
    });
    
    return {
        columns: columnNames,
        dicts: dicts,
        rows: rowData
    };
}

// ============================================
// SHOW ERROR MESSAGE
// ============================================
function showError(message) {
    const heroCount = document.getElementById('heroCount');
    if (heroCount) heroCount.textContent = '⚠️';
    const total = document.getElementById('total');
    if (total) total.textContent = 'Error';
    
    // Show error in table
    const tbody = document.getElementById('tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align:center;padding:40px;color:#c53030;">
                    <strong>❌ ডাটা লোড করতে ব্যর্থ হয়েছে</strong><br>
                    <span style="font-size:13px;color:#718096;">${message}</span><br>
                    <span style="font-size:12px;color:#a0aec0;margin-top:10px;display:block;">
                        অনুগ্রহ করে নিশ্চিত করুন যে Google Sheet-টি পাবলিক (Anyone with link can view)
                    </span>
                </td>
            </tr>
        `;
    }
}

// ============================================
// ORIGINAL APP LOGIC (MODIFIED TO USE ASYNC DATA)
// ============================================
(async function init() {
    // Show loading state
    document.getElementById('total').textContent = '⏳';
    document.getElementById('heroCount').textContent = '⏳';
    
    // Load data from Google Sheets
    const D = await loadDataFromSheet();
    
    if (!D) return; // Error already shown
    
    // Store in window for other functions to access
    window.MADRASA_DATA = D;
    
    // ===== ORIGINAL CODE (unchanged below) =====
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
    
    fill("division", "DIVISION");
    fill("district", "DISTRICT");
    fill("upazila", "UPAZILLA/THANA");
    fill("level", "LAVEL");
    fill("post", "POST-NAME");
    fill("subject", "SUBJECT");
    
    function apply() {
        let q = $("q").value.trim().toLowerCase();
        let fs = {
            "DIVISION": $("division").value,
            "DISTRICT": $("district").value,
            "UPAZILLA/THANA": $("upazila").value,
            "LAVEL": $("level").value,
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
            ["SL", "EIIN", "MADRASHA-NAME", "LAVEL", "POST-NAME", "SUBJECT", "DIVISION", "DISTRICT", "UPAZILLA/THANA"].forEach((c, j) => {
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
})();