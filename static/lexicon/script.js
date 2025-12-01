let fullData = [];              // all rows from CSV
let fullDataCurrentView = [];   // filtered rows
let currentSort = { column: null, direction: null };
let currentPage = 1;
const rowsPerPage = 50;
let columnNames = [];

async function loadCSV(path) {
    showSkeleton();
    const response = await fetch(path, { cache: "no-store" });
    if (!response.ok) {
        throw new Error("Could not load CSV: " + response.status);
    }
    return await response.text();
}

setInterval(refreshCSV, 10 * 60 * 1000);

async function refreshCSV() {
    showSkeleton();
    try {
        const csvText = await loadCSV("https://docs.google.com/spreadsheets/d/1iaKr-e3DG8S5fNR2ht1053DzqNSyV6dgbkj43_SMhdM/export?format=csv&gid=0");
        const { headers, rows } = parseCSV(csvText);
        console.log(csvText);
        fullData = rows;

        // Apply current search filter
        const searchInput = document.getElementById('general-search');
        const query = searchInput.value.toLowerCase();
        fullDataCurrentView = query
            ? fullData.filter(row => Object.values(row).some(val => val && val.toString().toLowerCase().includes(query)))
            : fullData;

        if (query && fullDataCurrentView.length === 0) {
            document.getElementById("lexicon-tbody").innerHTML = `
        <tr>
            <td class="px-4 py-2 text-center text-gray-500" colspan="8">
                No results found
            </td>
        </tr>
        `;
            return; // skip renderPage
        }

        // Re-render table
        showSkeleton();
        renderTableHeader(headers);
        renderPage();
    } catch (err) {
        console.error("Failed to refresh CSV:", err);
    }
}



feather.replace();

showSkeleton();

// Usage:
loadCSV("https://docs.google.com/spreadsheets/d/1iaKr-e3DG8S5fNR2ht1053DzqNSyV6dgbkj43_SMhdM/export?format=csv&gid=0")
    .then(csvText => {
        const { headers, rows } = parseCSV(csvText);
        fullData = rows;
        renderTableHeader(headers);
        renderPage();
    })
    .catch(err => console.error(err));

function showSkeleton() {
    const tbody = document.getElementById("lexicon-tbody");
    const thead = document.getElementById("lexicon-thead");

    // Skeleton header
    thead.innerHTML = `<tr>
        <th class="px-4 py-2 bg-gray-100 animate-pulse">Loading...</th>
        <th class="px-4 py-2 bg-gray-100 animate-pulse">Loading...</th>
        <th class="px-4 py-2 bg-gray-100 animate-pulse">Loading...</th>
        <th class="px-4 py-2 bg-gray-100 animate-pulse">Loading...</th>
        <th class="px-4 py-2 bg-gray-100 animate-pulse">Loading...</th>
        <th class="px-4 py-2 bg-gray-100 animate-pulse">Loading...</th>
        <th class="px-4 py-2 bg-gray-100 animate-pulse">Loading...</th>
        <th class="px-4 py-2 bg-gray-100 animate-pulse">Loading...</th>
    </tr>`;

    tbody.innerHTML = "";
    for (let i = 0; i < 5; i++) {
        const tr = document.createElement("tr");
        tr.innerHTML = Array(8).fill('<td class="px-4 py-2"><div class="h-4 bg-gray-200 rounded animate-pulse"></div></td>').join("");
        tbody.appendChild(tr);
    }
}

function truncateText(str, maxLength = 10) {
    if (!str) return "";
    return str.length > maxLength ? str.slice(0, 10) + "..." : str;
}

// --- Parse CSV ---
function parseCSV(csvText) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",");
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
        headers.forEach((h, i) => obj[h] = values[i] ?? '');
        return obj;
    });
    return { headers, rows };
}

// --- Format Header ---
function formatHeader(header) {
    return header.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

// --- Render Table Header ---
function renderTableHeader(headers) {
    columnNames = [];
    const thead = document.getElementById("lexicon-thead");
    thead.innerHTML = "";

    const tr = document.createElement("tr");
    headers.forEach(h => {
        const displayName = formatHeader(h);
        columnNames.push(h);
        const th = document.createElement("th");
        th.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${displayName}</span>
                <button data-col="${h}" class="sort-btn text-gray-500 hover:text-gray-700 ml-2 text-sm">▼</button>
            </div>
        `;
        th.className = "px-4 py-2 bg-gray-100 sticky top-0";
        th.style.minWidth = "150px"; // or any desired width
        tr.appendChild(th);
    });
    thead.appendChild(tr);

    // Add summary row under header
    generateSummaryRow(headers);
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function createColumnSummary(values) {
    const counts = {};
    let nullCount = 0;

    for (const v of values) {
        if (v === undefined || v === null || v === "" || v === "-") {
            nullCount++;
        } else {
            const key = v.toString().trim().toLowerCase();
            counts[key] = (counts[key] || 0) + 1;
        }
    }

    const unique = Object.keys(counts).length;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    let summaryHTML = "";

    if (unique === 0) {
        summaryHTML = `<div class="flex justify-between"><span>Null</span><span>${nullCount}</span></div>`;
    } else if (unique === 2) {
        summaryHTML = sorted.map(([value, count]) =>
            `<div class="flex justify-between"><span>${capitalize(value)}</span><span>${count}</span></div>`
        ).join("");
    } else if (unique < 20) {
        const total = values.length - nullCount;
        summaryHTML = sorted.map(([value, count]) =>
            `<div class="flex justify-between"><span>${truncateText(value.toUpperCase())}</span><span>${(count / total * 100).toFixed(1)}%</span></div>`
        ).join("");
    } else {
        // Top 3 most frequent
        summaryHTML = `<div>Most Frequent:</div>`;
        sorted.slice(0, 3).forEach(([value, count]) => {
            summaryHTML += `<div class="flex justify-between"><span>&nbsp;&nbsp;&nbsp;${truncateText(value)}</span><span>${count}</span></div>`;
        });
        summaryHTML += `<div class="flex justify-between"><span>${"Unique"}</span><span>${unique}</span></div>`;
    }

    if (nullCount > 0 && unique !== 0) {
        summaryHTML += `<div class="flex justify-between"><span>Null</span><span>${nullCount}</span></div>`;
    }

    return summaryHTML;
}


function generateSummaryRow(headers) {
    const thead = document.getElementById("lexicon-thead");

    // Remove previous summary/chart rows if exist
    while (thead.rows.length > 1) {
        thead.deleteRow(1);
    }

    // ------------------------
    // Chart Row (hidden by default)
    // ------------------------
    const chartRow = document.createElement("tr");
    chartRow.className = "bg-gray-50 text-gray-600 text-xs hidden"; // hidden by default
    chartRow.dataset.chartRow = "true"; // optional identifier

    headers.forEach(header => {
        const td = document.createElement("td");
        td.className = "px-4 py-2 border-t border-gray-200";

        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100px"; // adjust as needed
        td.appendChild(canvas);
        chartRow.appendChild(td);

        // Prepare chart data
        const colValues = fullData.map(row => row[header]);
        const counts = {};
        colValues.forEach(v => {
            const key = v ? v.toString().trim() : "Null";
            counts[key] = (counts[key] || 0) + 1;
        });

        const labels = Object.keys(counts);
        const data = Object.values(counts);

        new Chart(canvas, {
            type: 'pie',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: labels.map(() => `hsl(${Math.random() * 360}, 70%, 60%)`),
                    borderColor: '#fff',
                    borderWidth: 1
                }]
            },
            options: {
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const label = ctx.label || '';
                                const value = ctx.raw || 0;
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${pct}%)`;
                            }
                        }
                    }
                },
                responsive: true,
                maintainAspectRatio: false
            }
        });
    });

    thead.appendChild(chartRow);


    // ------------------------
    // Summary Text Row
    // ------------------------
    const summaryRow = document.createElement("tr");
    summaryRow.dataset.summaryRow = "true";
    summaryRow.className = "bg-gray-50 text-gray-600 text-xs min-h-[50px]";
    summaryRow.style.verticalAlign = "top";

    headers.forEach(header => {
        const td = document.createElement("td");
        td.className = "px-4 py-2 border-t border-gray-200";

        // Get all values for this column
        const colValues = fullData.map(row => row[header]);

        td.innerHTML = `<span class="font-medium block break-words">${createColumnSummary(colValues)}</span>`;
        summaryRow.appendChild(td);
    });

    thead.appendChild(summaryRow);

}

const toggleSummaryBtn = document.getElementById("toggle-summary");
let summaryVisible = true;

toggleSummaryBtn.addEventListener("click", () => {
    const summaryRow = document.querySelector('thead tr[data-summary-row]');
    if (!summaryRow) return;

    summaryRow.style.display = summaryVisible ? "none" : "";
    summaryVisible = !summaryVisible;
});


const toggleChartsBtn = document.getElementById("toggle-charts");

let chartsVisible = true; // default visible when expanded

toggleChartsBtn.addEventListener('click', () => {
    document.querySelectorAll('thead tr[data-chart-row]').forEach(r => {
        r.style.display = chartsVisible ? "none" : "";
    });
    chartsVisible = !chartsVisible;
});

// --- Render Table Rows ---
function renderTableRows(data) {
    const tbody = document.getElementById("lexicon-tbody");
    tbody.innerHTML = "";
    data.forEach(row => {
        const tr = document.createElement("tr");
        Object.keys(row).forEach(col => {
            const td = document.createElement("td");
            td.textContent = row[col] || "-";
            td.className = "px-4 py-2 border-b";
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

// --- Render Page ---
function renderPage() {
    // Start from the full data
    let filteredData = fullData;

    // --- General Search ---
    const generalQuery = document.getElementById('general-search').value.toLowerCase();
    if (generalQuery) {
        filteredData = filteredData.filter(row =>
            Object.values(row).some(val => val && val.toString().toLowerCase().includes(generalQuery))
        );
    }

    // --- Per-Column Search ---
    const columnInputs = document.querySelectorAll('.column-search'); // add class to your per-col inputs
    columnInputs.forEach(input => {
        const colName = input.dataset.col; // set data-col attribute with the column key
        const query = input.value.toLowerCase();
        if (query) {
            filteredData = filteredData.filter(row =>
                row[colName] && row[colName].toString().toLowerCase().includes(query)
            );
        }
    });

    // Update current view
    fullDataCurrentView = filteredData;
    data = filteredData;
    // Reset to first page
    currentPage = 1;


    // Render current page
    const start = (currentPage - 1) * rowsPerPage;
    const pageRows = fullDataCurrentView.slice(start, start + rowsPerPage);
    renderTableRows(pageRows);

    // Update page info
    document.getElementById("page-info").textContent =
        `Page ${currentPage} of ${Math.max(1, Math.ceil(fullDataCurrentView.length / rowsPerPage))}`;

    // Handle "no results"
    if (!fullDataCurrentView.length) {
        document.getElementById('table-body').innerHTML = `
            <tr><td colspan="${Object.keys(fullData[0]).length}" class="text-center py-4 text-slate-400">No results found</td></tr>
        `;
    }

    // --- 3. PAGE INFO ---
    const totalPages = Math.ceil(data.length / rowsPerPage);
    document.getElementById("page-info").textContent =
        `Page ${currentPage} of ${totalPages || 1}`;
}


// --- Pagination ---
document.getElementById("prev-page").onclick = () => { if (currentPage > 1) { currentPage--; renderPage(); } };
document.getElementById("next-page").onclick = () => {
    const dataLength = fullDataCurrentView.length ? fullDataCurrentView.length : fullData.length;
    if (currentPage < Math.ceil(dataLength / rowsPerPage)) { currentPage++; renderPage(); }
};

// --- General Search ---
document.getElementById('general-search').addEventListener('input', e => {
    refreshCSV();
    const q = e.target.value.toLowerCase();
    if (q === "") {
        // No search query → show full table
        fullDataCurrentView = [...fullData];
    } else {
        fullDataCurrentView = fullData.filter(row =>
            Object.values(row).some(val => val && val.toString().toLowerCase().includes(q))
        );
    }
    currentPage = 1;
    renderPage();
});

async function loadCSV(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error("Could not load CSV: " + response.status);
    }
    return await response.text();
}

loadCSV("https://docs.google.com/spreadsheets/d/1iaKr-e3DG8S5fNR2ht1053DzqNSyV6dgbkj43_SMhdM/export?format=csv&gid=0")
    .then(csvText => {
        const { headers, rows } = parseCSV(csvText);
        fullData = rows;
        renderTableHeader(headers);
        renderPage();
    })
    .catch(err => console.error(err));


// Create popup once
const colPopup = document.createElement("div");
colPopup.className = "absolute hidden z-50 bg-white border border-gray-300 rounded-md shadow-lg text-sm p-2";
colPopup.innerHTML = `
    <button data-dir="asc" class="w-full mb-1 bg-gray-100 hover:bg-gray-200 py-1">Sort Ascending</button>
    <button data-dir="desc" class="w-full bg-gray-100 hover:bg-gray-200 py-1">Sort Descending</button>
`;
document.body.appendChild(colPopup);

// Show popup when sort/search button clicked
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("sort-btn")) {
        const rect = e.target.getBoundingClientRect();
        colPopup.style.left = `${rect.left}px`;
        colPopup.style.top = `${rect.bottom + window.scrollY}px`;
        colPopup.style.display = "block";
        colPopup.dataset.column = e.target.dataset.col;
    } else if (!colPopup.contains(e.target)) {
        colPopup.style.display = "none";
    }
});

// Column search input
// Column search input
//colPopup.querySelector("input").addEventListener("input", (e) => {
//    refreshCSV()
//    const col = colPopup.dataset.column;
//    const query = e.target.value.toLowerCase();
//    fullDataCurrentView = fullData.filter(row => {
//        const val = row[col];
//        return val && val.toString().toLowerCase().includes(query);
//    });
//    currentPage = 1;
//    renderPage();
//});
//
//
//// Press enter in input triggers search
//colPopup.querySelector("input").addEventListener("keydown", e => {
//    if (e.key === "Enter") e.target.dispatchEvent(new Event("input"));
//});

// Sort buttons
colPopup.querySelectorAll("button[data-dir]").forEach(btn => {
    btn.addEventListener("click", () => {
        const col = colPopup.dataset.column;
        const dir = btn.dataset.dir;
        sortByColumn(col, dir);
    });
});

function sortByColumn(column, direction) {
    fullData.sort((a, b) => {
        let valA = a[column] ?? "";
        let valB = b[column] ?? "";

        if (!isNaN(valA) && !isNaN(valB)) return direction === "asc" ? valA - valB : valB - valA;

        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();

        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
    });

    currentSort = { column, direction };
    renderPage();
    generateSummaryRow(Object.keys(fullData[0])); // update summary
}


const expandBtn = document.getElementById('expand-btn');
const expandModal = document.getElementById('expand-modal');
const expandContent = document.getElementById('expand-content');
const tableContainerParent = document.querySelector('main .w-full'); // original parent container
const tableBlock = document.getElementById('table-container').parentElement; // div containing search, table, download, pagination

let originalClasses = tableBlock.className;
let originalParent = tableBlock.parentElement;
let originalNextSibling = tableBlock.nextSibling; // in case we want to reinsert exactly

expandBtn.addEventListener('click', () => {
    expandContent.appendChild(tableBlock);
    tableBlock.classList.add('w-full', 'flex-1', 'overflow-auto');
    tableBlock.classList.remove('max-w-6xl', 'mt-24', 'mb-12');
    toggleChartsBtn.classList.remove('hidden');
    expandBtn.style.display = 'none';
    expandModal.classList.remove('hidden');
    document.querySelectorAll('thead tr[data-chart-row]').forEach(r => r.classList.remove('hidden'));
    //chartsVisible = true;
});

expandModal.addEventListener('click', (e) => {
    if (e.target.id === 'expand-modal') {
        // Hide modal
        expandModal.classList.add('hidden');

        tableBlock.className = originalClasses;
        toggleChartsBtn.classList.add('hidden');
        if (originalNextSibling) {
            originalParent.insertBefore(tableBlock, originalNextSibling);
        } else {
            originalParent.appendChild(tableBlock);
        }
        document.querySelectorAll('thead tr[data-chart-row]').forEach(r => r.classList.add('hidden'));
        // Restore expand button
        expandBtn.style.display = '';
        //chartsVisible = false;
    }
});

document.getElementById("download-btn").addEventListener("click", () => {
    populateDownloadColumns();
    document.getElementById("download-modal").classList.remove("hidden");
});

document.getElementById("download-cancel").addEventListener("click", () => {
    document.getElementById("download-modal").classList.add("hidden");
});


function populateDownloadColumns() {
    const container = document.getElementById("download-columns");
    container.innerHTML = "";

    columnNames.forEach((col, idx) => {
        const id = `dl-col-${idx}`;
        col = formatHeader(col);
        container.innerHTML += `
            <div class="flex items-center mb-1">
                <input type="checkbox" id="${id}" class="mr-2 dl-col" checked>
                <label for="${id}">${col}</label>
            </div>
        `;
    });
}

document.getElementById("download-confirm").addEventListener("click", () => {
    const filteredOnly = document.getElementById("download-filtered").checked;

    const selectedCols = [...document.querySelectorAll(".dl-col")]
        .map((ch, i) => ch.checked ? i : null)
        .filter(v => v !== null);

    const exportData = filteredOnly ? fullDataCurrentView : fullData;

    const csv = generateCSV(exportData, selectedCols);
    downloadFile(csv, "lexicon_export.csv");

    document.getElementById("download-modal").classList.add("hidden");
});

function escapeCSV(value) {
    if (value == null) return "";
    const v = value.toString();
    return /[",\n]/.test(v)
        ? `"${v.replace(/"/g, '""')}"`
        : v;
}


function generateCSV(data, columns) {
    if (!data || data.length === 0) return "";

    // Header row
    const header = columns.map(i => escapeCSV(columnNames[i])).join(",");

    // Data rows
    const rows = data.map(row =>
        columns.map(i => escapeCSV(row[columnNames[i]] ?? "")).join(",")
    );

    return [header, ...rows].join("\n");
}

function downloadFile(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
