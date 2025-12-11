// =========================================
// 1. GLOBAL VARIABLES & CONFIGURATION
// =========================================
let fullData = [];              // Repository of all rows
let fullDataCurrentView = [];   // Rows currently matching search/filter
let currentSort = { column: null, direction: null };
let currentPage = 1;
const rowsPerPage = 50;
let columnNames = [];

// Google Sheets CSV Link
const CSV_URL = "https://docs.google.com/spreadsheets/d/1iaKr-e3DG8S5fNR2ht1053DzqNSyV6dgbkj43_SMhdM/export?format=csv&gid=0";

// Initialize Icons
if (typeof feather !== 'undefined') {
    feather.replace();
}

// =========================================
// 2. DATA FETCHING & PARSING
// =========================================

// Initial Load
loadAndRender();

// Auto-refresh every 10 minutes
setInterval(refreshCSV, 10 * 60 * 1000);

async function loadCSV(path) {
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load CSV: " + response.status);
    return await response.text();
}

function parseCSV(csvText) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",").map(h => h.trim());
    const rows = lines.slice(1).map(line => {
        const values = [];
        let current = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"' && line[i + 1] === '"') { current += '"'; i++; }
            else if (char === '"') { inQuotes = !inQuotes; }
            else if (char === "," && !inQuotes) { values.push(current); current = ""; }
            else { current += char; }
        }
        values.push(current);
        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i] ? values[i].trim() : '');
        return obj;
    });
    return { headers, rows };
}

async function loadAndRender() {
    showSkeleton();
    try {
        const csvText = await loadCSV(CSV_URL);
        const { headers, rows } = parseCSV(csvText);
        fullData = rows;
        
        // Initial Render
        renderTableHeader(headers);
        applyFilters(); // This sets up the view and renders page 1
    } catch (err) {
        console.error("Error loading CSV:", err);
        document.getElementById("lexicon-tbody").innerHTML = `<tr><td colspan="8" class="text-center text-red-500 py-4">Error loading data. Please refresh.</td></tr>`;
    }
}

async function refreshCSV() {
    // Background refresh - doesn't show skeleton to avoid flickering
    try {
        const csvText = await loadCSV(CSV_URL);
        const { headers, rows } = parseCSV(csvText);
        fullData = rows;
        
        // Re-apply filters to current data
        applyFilters(false); // false = don't reset page if possible
    } catch (err) {
        console.error("Failed to refresh CSV:", err);
    }
}

// =========================================
// 3. CORE LOGIC: FILTERING & PAGINATION
// =========================================

/**
 * Filters the data based on search input and sorts it.
 * @param {boolean} resetPage - Whether to jump back to page 1 (default: true)
 */
function applyFilters(resetPage = true) {
    let filtered = [...fullData];

    // 1. General Search
    const searchInput = document.getElementById('general-search');
    const query = searchInput ? searchInput.value.toLowerCase() : "";
    
    if (query) {
        filtered = filtered.filter(row =>
            Object.values(row).some(val => val && val.toString().toLowerCase().includes(query))
        );
    }

    // 2. Column Search (if applicable)
    // (Add specific column logic here if you add inputs for them later)

    fullDataCurrentView = filtered;

    // 3. Reset Pagination
    if (resetPage) {
        currentPage = 1;
    }

    // 4. Update UI
    renderPage();
}

/**
 * Slices the filtered data and renders HTML rows.
 * DOES NOT reset currentPage (fixing the pagination bug).
 */
function renderPage() {
    const totalItems = fullDataCurrentView.length;
    const totalPages = Math.ceil(totalItems / rowsPerPage) || 1;

    // Safety bounds
    if (currentPage < 1) currentPage = 1;
    if (currentPage > totalPages) currentPage = totalPages;

    // Slice Data
    const start = (currentPage - 1) * rowsPerPage;
    const pageRows = fullDataCurrentView.slice(start, start + rowsPerPage);

    // Render Rows
    renderTableRows(pageRows);

    // Update Info Text
    const pageInfo = document.getElementById("page-info");
    if(pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

    // Handle Empty State
    if (totalItems === 0) {
        document.getElementById("lexicon-tbody").innerHTML = `
            <tr>
                <td colspan="${columnNames.length || 8}" class="px-4 py-8 text-center text-slate-400">
                    No results found
                </td>
            </tr>
        `;
    }
}

// =========================================
// 4. RENDERING FUNCTIONS (HTML GENERATION)
// =========================================

function showSkeleton() {
    const tbody = document.getElementById("lexicon-tbody");
    const thead = document.getElementById("lexicon-thead");
    if (!tbody || !thead) return;

    thead.innerHTML = `<tr>
        ${Array(5).fill('<th class="px-4 py-2 bg-gray-100 animate-pulse">Loading...</th>').join('')}
    </tr>`;

    tbody.innerHTML = "";
    for (let i = 0; i < 5; i++) {
        const tr = document.createElement("tr");
        tr.innerHTML = Array(5).fill('<td class="px-4 py-2"><div class="h-4 bg-gray-200 rounded animate-pulse"></div></td>').join("");
        tbody.appendChild(tr);
    }
}

function renderTableHeader(headers) {
    columnNames = headers; // Store globally
    const thead = document.getElementById("lexicon-thead");
    if (!thead) return;

    thead.innerHTML = "";
    const tr = document.createElement("tr");

    headers.forEach(h => {
        const displayName = h.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const th = document.createElement("th");
        th.className = "px-4 py-2 bg-gray-100 sticky top-0 z-10 border-b";
        th.style.minWidth = "150px";
        th.innerHTML = `
            <div class="flex items-center justify-between font-semibold text-gray-700">
                <span>${displayName}</span>
                <button data-col="${h}" class="sort-btn text-gray-400 hover:text-gray-700 ml-2 focus:outline-none">▼</button>
            </div>
        `;
        tr.appendChild(th);
    });
    thead.appendChild(tr);

    // Generate Summary/Stats Row
    generateSummaryRow(headers);
}

function renderTableRows(data) {
    const tbody = document.getElementById("lexicon-tbody");
    if (!tbody) return;
    tbody.innerHTML = "";
    
    data.forEach(row => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-slate-50 transition-colors";
        
        columnNames.forEach(col => {
            const td = document.createElement("td");
            td.textContent = row[col] || "-";
            td.className = "px-4 py-2 border-b text-sm text-gray-700";
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function generateSummaryRow(headers) {
    const thead = document.getElementById("lexicon-thead");
    
    // Clear old summary rows if they exist (keep header row 0)
    while (thead.rows.length > 1) {
        thead.deleteRow(1);
    }

    // 1. Chart Row (Hidden by default)
    const chartRow = document.createElement("tr");
    chartRow.className = "bg-gray-50 hidden";
    chartRow.dataset.chartRow = "true";

    headers.forEach(header => {
        const td = document.createElement("td");
        td.className = "px-4 py-2 border-b border-gray-200";
        const canvas = document.createElement("canvas");
        canvas.style.height = "100px";
        canvas.style.width = "100%";
        td.appendChild(canvas);
        chartRow.appendChild(td);

        // Compute Stats
        const colValues = fullData.map(row => row[header]);
        const counts = {};
        colValues.forEach(v => { const k = v ? v.trim() : "Null"; counts[k] = (counts[k] || 0) + 1; });
        
        // Render Chart (if Chart.js is loaded)
        if (typeof Chart !== 'undefined') {
            new Chart(canvas, {
                type: 'pie',
                data: {
                    labels: Object.keys(counts),
                    datasets: [{
                        data: Object.values(counts),
                        backgroundColor: Object.keys(counts).map(() => `hsl(${Math.random() * 360}, 70%, 80%)`)
                    }]
                },
                options: { 
                    plugins: { legend: { display: false } },
                    responsive: true, 
                    maintainAspectRatio: false 
                }
            });
        }
    });
    thead.appendChild(chartRow);

    // 2. Text Summary Row (Visible by default)
    const summaryRow = document.createElement("tr");
    summaryRow.dataset.summaryRow = "true";
    summaryRow.className = "bg-gray-50 text-xs text-gray-500";
    
    headers.forEach(header => {
        const td = document.createElement("td");
        td.className = "px-4 py-2 border-b border-gray-200 align-top";
        const colValues = fullData.map(r => r[header]);
        td.innerHTML = createColumnSummary(colValues);
        summaryRow.appendChild(td);
    });
    thead.appendChild(summaryRow);
}

function createColumnSummary(values) {
    const counts = {};
    let nullCount = 0;
    values.forEach(v => {
        if (!v || v === "-") nullCount++;
        else counts[v.toLowerCase()] = (counts[v.toLowerCase()] || 0) + 1;
    });

    const unique = Object.keys(counts).length;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]); // Descending

    if (unique === 0) return `<div>Empty</div>`;
    
    // Simple summary logic
    let html = `<div class="font-bold mb-1">Unique: ${unique}</div>`;
    
    // Top 3 items
    sorted.slice(0, 3).forEach(([key, count]) => {
        const pct = ((count / values.length) * 100).toFixed(1);
        const displayKey = key.length > 12 ? key.slice(0, 10) + "..." : key;
        html += `<div class="flex justify-between"><span>${displayKey}</span><span>${pct}%</span></div>`;
    });

    return html;
}

// =========================================
// 5. EVENT LISTENERS
// =========================================

// --- Search ---
const searchInput = document.getElementById('general-search');
if (searchInput) {
    searchInput.addEventListener('input', () => {
        applyFilters(true); // Reset to page 1 on search
    });
}

// --- Pagination ---
const prevBtn = document.getElementById("prev-page");
const nextBtn = document.getElementById("next-page");

if (prevBtn) {
    prevBtn.addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderPage();
        }
    });
}

if (nextBtn) {
    nextBtn.addEventListener("click", () => {
        const totalPages = Math.ceil(fullDataCurrentView.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderPage();
        }
    });
}

// --- Toggle Summary & Charts ---
document.getElementById("toggle-summary")?.addEventListener("click", () => {
    const row = document.querySelector('tr[data-summary-row]');
    if (row) row.style.display = row.style.display === "none" ? "" : "none";
});

document.getElementById("toggle-charts")?.addEventListener("click", () => {
    const rows = document.querySelectorAll('tr[data-chart-row]');
    rows.forEach(r => r.classList.toggle('hidden'));
});

// --- Sorting Popup Logic ---
const colPopup = document.createElement("div");
colPopup.className = "fixed hidden z-50 bg-white border border-gray-200 rounded shadow-xl text-sm p-2 w-40";
colPopup.innerHTML = `
    <button data-dir="asc" class="w-full text-left px-3 py-2 hover:bg-gray-100 rounded">Sort A-Z</button>
    <button data-dir="desc" class="w-full text-left px-3 py-2 hover:bg-gray-100 rounded">Sort Z-A</button>
`;
document.body.appendChild(colPopup);

document.addEventListener("click", (e) => {
    // Open Popup
    if (e.target.classList.contains("sort-btn")) {
        const rect = e.target.getBoundingClientRect();
        colPopup.style.left = `${rect.left}px`;
        colPopup.style.top = `${rect.bottom + window.scrollY}px`;
        colPopup.style.display = "block";
        colPopup.dataset.column = e.target.dataset.col;
    } 
    // Close Popup if clicked outside
    else if (!colPopup.contains(e.target)) {
        colPopup.style.display = "none";
    }
});

colPopup.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
        const col = colPopup.dataset.column;
        const dir = btn.dataset.dir;
        
        // Sort Full Data
        fullData.sort((a, b) => {
            const valA = (a[col] || "").toString().toLowerCase();
            const valB = (b[col] || "").toString().toLowerCase();
            if (valA < valB) return dir === "asc" ? -1 : 1;
            if (valA > valB) return dir === "asc" ? 1 : -1;
            return 0;
        });

        applyFilters(false); // Don't reset page, just re-render sorted data
        colPopup.style.display = "none";
    });
});

// --- Expand Modal Logic ---
const expandBtn = document.getElementById('expand-btn');
const expandModal = document.getElementById('expand-modal');
const expandContent = document.getElementById('expand-content');
const tableBlock = document.getElementById('table-container')?.parentElement; 

if (expandBtn && expandModal && tableBlock) {
    const originalParent = tableBlock.parentElement;
    const originalNextSibling = tableBlock.nextSibling;
    const originalClasses = tableBlock.className;

    expandBtn.addEventListener('click', () => {
        expandContent.appendChild(tableBlock);
        tableBlock.classList.remove('max-w-6xl', 'mt-24', 'mb-12');
        tableBlock.classList.add('w-full', 'h-full', 'flex', 'flex-col');
        
        document.getElementById('toggle-charts').classList.remove('hidden');
        expandModal.classList.remove('hidden');
        expandBtn.style.display = 'none';
    });

    expandModal.addEventListener('click', (e) => {
        if (e.target === expandModal) {
            // Revert
            expandModal.classList.add('hidden');
            tableBlock.className = originalClasses;
            document.getElementById('toggle-charts').classList.add('hidden');
            expandBtn.style.display = '';

            if (originalNextSibling) {
                originalParent.insertBefore(tableBlock, originalNextSibling);
            } else {
                originalParent.appendChild(tableBlock);
            }
        }
    });
}

// --- Download CSV Logic ---
const downloadModal = document.getElementById("download-modal");
const downloadBtn = document.getElementById("download-btn");

if (downloadBtn && downloadModal) {
    downloadBtn.addEventListener("click", () => {
        const container = document.getElementById("download-columns");
        container.innerHTML = "";
        
        // Generate Checkboxes
        columnNames.forEach((col, idx) => {
            const id = `dl-col-${idx}`;
            const label = col.replace(/_/g, ' ').toUpperCase();
            container.innerHTML += `
                <div class="flex items-center mb-1">
                    <input type="checkbox" id="${id}" value="${idx}" class="mr-2 dl-col-check" checked>
                    <label for="${id}" class="text-sm cursor-pointer select-none">${label}</label>
                </div>
            `;
        });
        downloadModal.classList.remove("hidden");
    });

    document.getElementById("download-cancel").addEventListener("click", () => {
        downloadModal.classList.add("hidden");
    });

    document.getElementById("download-confirm").addEventListener("click", () => {
        const onlyFiltered = document.getElementById("download-filtered").checked;
        const selectedIndices = Array.from(document.querySelectorAll(".dl-col-check:checked")).map(cb => parseInt(cb.value));
        
        const dataToExport = onlyFiltered ? fullDataCurrentView : fullData;
        const csvContent = generateCSV(dataToExport, selectedIndices);
        
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ibaloi_lexicon_export.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        downloadModal.classList.add("hidden");
    });
}

function generateCSV(data, colIndices) {
    if (!data.length) return "";
    const headers = colIndices.map(i => `"${columnNames[i].replace(/"/g, '""')}"`).join(",");
    const rows = data.map(row => 
        colIndices.map(i => {
            const val = (row[columnNames[i]] || "").toString();
            return `"${val.replace(/"/g, '""')}"`; // Escape CSV
        }).join(",")
    );
    return [headers, ...rows].join("\n");
}