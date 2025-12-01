let fullData = [];              // all CSV rows
let fullDataCurrentView = [];   // filtered rows after general or column search
let currentSort = { column: null, direction: null };
let currentPage = 1;
const rowsPerPage = 50;


function parseCSV(csvText) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",");

    const rows = lines.slice(1).map(line => {
        const values = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"' && line[i + 1] === '"') {
                // Escaped quote inside a quoted value
                current += '"';
                i++; // skip the next quote
            } else if (char === '"') {
                inQuotes = !inQuotes; // toggle quote state
            } else if (char === "," && !inQuotes) {
                values.push(current);
                current = "";
            } else {
                current += char;
            }
        }
        values.push(current);

        const obj = {};
        headers.forEach((h, i) => obj[h] = values[i] ?? null);
        return obj;
    });

    return { headers, rows };
}

function formatHeader(header) {
    return header
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}


function renderTableHeader(headers) {
    const thead = document.getElementById("lexicon-thead");
    thead.innerHTML = "";

    const headerRow = document.createElement("tr");

    headers.forEach((header) => {
        const displayName = formatHeader(header);
        const th = document.createElement("th");
        th.className = "px-4 py-2 text-left bg-gray-100 sticky top-0 z-10";

        th.innerHTML = `
        <div class="flex items-center justify-between">
            <span>${displayName}</span>
            <button data-col="${header}" class="sort-btn text-gray-500 hover:text-gray-700 ml-2 text-sm">▼</button>
        </div>
    `;

        headerRow.appendChild(th);
    });


    thead.appendChild(headerRow);

    // ADD SUMMARY ROW BELOW HEADER
    generateSummaryRow(headers);
}

/* ============================================================
   COLUMN SUMMARY ANALYZER
   ============================================================ */

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

    let summary = "";

    if (unique === 0) {
        summary = `Null Values: ${nullCount}`;
    } else if (unique === 2) {
        summary = sorted.map(([value, count]) =>
            `${capitalize(value)}: ${count}`
        ).join("<br>");
    } else if (unique < 20) {
        const total = values.length - nullCount;
        summary = sorted.map(([value, count]) =>
            `${value.toUpperCase()} ${(count / total * 100).toFixed(1)}%`
        ).join("<br>");
    } else {
        const [topVal, topCount] = sorted[0];
        summary = `Most frequent: "${topVal}" (${topCount})<br>Unique: ${unique}`;
    }

    if (nullCount > 0) {
        summary += `<br>Null Values: ${nullCount}`;
    }

    return summary;
}




// Capitalize helper
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/* ============================================================
   INSERT SUMMARY ROW UNDER HEADER
   ============================================================ */

function generateSummaryRow(headers) {
    const thead = document.getElementById("lexicon-thead");

    // remove previous summary row if present
    if (thead.rows.length > 1) thead.deleteRow(1);

    const summaryRow = document.createElement("tr");
    summaryRow.className = "bg-gray-50 text-gray-600 text-xs"; // Tailwind styling

    headers.forEach(header => {
        const td = document.createElement("td");
        td.className = "px-4 py-2 border-t border-gray-200"; // padding and border
        const colValues = fullData.map(row => row[header]);

        td.innerHTML = createColumnSummary(colValues);
        td.innerHTML = `<span class="font-medium">${createColumnSummary(colValues)}</span>`;
        summaryRow.appendChild(td);
    });

    thead.appendChild(summaryRow);
}

/* ============================================================
   SORTING
   ============================================================ */

const popup = document.createElement("div");
popup.className = "absolute hidden z-50 bg-white border border-gray-300 rounded-md shadow-lg divide-y divide-gray-200 text-sm p-2";
popup.innerHTML = `
    <input type="text" data-col-search class="px-3 py-1 w-full border-b border-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-400 mb-2" placeholder="Search this column..." />
    <div data-dir="asc" class="px-4 py-2 hover:bg-gray-100 cursor-pointer">Sort Ascending</div>
    <div data-dir="desc" class="px-4 py-2 hover:bg-gray-100 cursor-pointer">Sort Descending</div>
`;
document.body.appendChild(popup);

// Open popup when clicking sort/search button
document.addEventListener("click", e => {
    if (e.target.classList.contains("sort-btn")) {
        const rect = e.target.getBoundingClientRect();
        popup.style.left = `${rect.left}px`;
        popup.style.top = `${rect.bottom + window.scrollY}px`;
        popup.style.display = "block";
        popup.dataset.column = e.target.dataset.col;
    } else if (!popup.contains(e.target)) {
        popup.style.display = "none";
    }
});

popup.addEventListener('input', e => {
    if (e.target.dataset.colSearch !== undefined) {
        const col = popup.dataset.column;
        const query = e.target.value.toLowerCase();
        fullDataCurrentView = fullData.filter(row => row[col] && row[col].toString().toLowerCase().includes(query));
        currentPage = 1;
        renderPage();
    }
});

// Allow "Enter" key to trigger search
popup.querySelector('[data-col-search]').addEventListener('keydown', e => {
    if(e.key === 'Enter') e.target.dispatchEvent(new Event('input'));
});

popup.querySelectorAll('div[data-dir]').forEach(btn => {
    btn.addEventListener('click', e => {
        const col = popup.dataset.column;
        const dir = e.target.dataset.dir;

        fullDataCurrentView.sort((a, b) => {
            let valA = a[col] ?? '';
            let valB = b[col] ?? '';

            if (!isNaN(valA) && !isNaN(valB)) return dir === 'asc' ? valA - valB : valB - valA;

            valA = String(valA).toLowerCase();
            valB = String(valB).toLowerCase();
            if (valA < valB) return dir === 'asc' ? -1 : 1;
            if (valA > valB) return dir === 'asc' ? 1 : -1;
            return 0;
        });

        currentSort = { column: col, direction: dir };
        renderPage();
    });
});

document.getElementById('general-search').addEventListener('input', e => {
    const query = e.target.value.toLowerCase();
    fullDataCurrentView = fullData.filter(row =>
        Object.values(row).some(val => val && val.toString().toLowerCase().includes(query))
    );
    currentPage = 1;
    renderPage();
});



popup.querySelector('[data-col-search]').addEventListener('keydown', e => {
    if(e.key === 'Enter') e.target.dispatchEvent(new Event('input'));
});
document.getElementById('general-search').addEventListener('keydown', e => {
    if(e.key === 'Enter') e.target.dispatchEvent(new Event('input'));
});


// Helper to render any subset
function renderPageData(data) {
    fullDataCurrentView = data; // store current filtered view
    currentPage = 1;
    renderPage();
}


function sortByColumn(column, direction) {
    fullData.sort((a, b) => {
        let valA = a[column] ?? "";  // handle null/undefined
        let valB = b[column] ?? "";

        // If numbers, compare numerically
        if (!isNaN(valA) && !isNaN(valB)) {
            return direction === "asc" ? valA - valB : valB - valA;
        }

        // Otherwise, compare as strings
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();

        if (valA < valB) return direction === "asc" ? -1 : 1;
        if (valA > valB) return direction === "asc" ? 1 : -1;
        return 0;
    });

    currentSort = { column, direction };
    renderPage();
    generateSummaryRow(Object.keys(fullData[0]));
}

/* ============================================================
   TABLE RENDERING
   ============================================================ */
function renderTableRows(rows) {
    const tbody = document.getElementById("lexicon-tbody");
    tbody.innerHTML = "";

    rows.forEach(row => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-gray-50";

        Object.keys(row).forEach(col => {
            const td = document.createElement("td");
            td.className = "px-4 py-2 border-b border-gray-200";
            td.textContent = row[col] || '-';
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

function renderPage() {
    const start = (currentPage - 1) * rowsPerPage;
    const pageRows = fullDataCurrentView.length ? 
                     fullDataCurrentView.slice(start, start + rowsPerPage) : 
                     fullData.slice(start, start + rowsPerPage);

    renderTableRows(pageRows);

    document.getElementById("page-info").textContent =
        `Page ${currentPage} of ${Math.ceil((fullDataCurrentView.length || fullData.length) / rowsPerPage)}`;
}



function renderPage() {
    let start = (currentPage - 1) * rowsPerPage;
    let pageRows = fullData.slice(start, start + rowsPerPage);

    renderTableRows(pageRows);

    // Update current view
    fullDataCurrentView = pageRows;

    document.getElementById("page-info").textContent =
        `Page ${currentPage} of ${Math.ceil(fullData.length / rowsPerPage)}`;
}


/* ============================================================
   PAGINATION
   ============================================================ */

document.getElementById("prev-page").onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        renderPage();
    }
};

document.getElementById("next-page").onclick = () => {
    if (currentPage < Math.ceil(fullData.length / rowsPerPage)) {
        currentPage++;
        renderPage();
    }
};

/* ============================================================
   INITIAL LOAD
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    let csvText = `
Word,Meaning,POS,Sentiment,Words,Meanings,POSs,Sentiments
tibay,strength,noun,positive,tibay,strength,noun,positive
lungkot,sadness,noun,negative,lungkot,sadness,noun,negative
alaga,care,verb,positive,alaga,care,verb,positive`;

    let { headers, rows } = parseCSV(csvText);

    fullData = rows;
    renderTableHeader(headers);
    renderPage();
});

async function loadCSV(path) {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error("Could not load CSV: " + response.status);
    }
    return await response.text();
}

// Usage:
loadCSV("https://docs.google.com/spreadsheets/d/1iaKr-e3DG8S5fNR2ht1053DzqNSyV6dgbkj43_SMhdM/export?format=csv&gid=0")
    .then(csvText => {
        const { headers, rows } = parseCSV(csvText);
        fullData = rows;
        renderTableHeader(headers);
        renderPage();
    })
    .catch(err => console.error(err));

document.getElementById('expand-btn').addEventListener('click', () => {
    const modal = document.getElementById('expand-modal');
    const content = document.getElementById('expand-content');

    // render full table without paging
    content.innerHTML = renderTableHTML(fullDataCurrentView || fullData, true);
    feather.replace();
    modal.classList.remove('hidden');
});

document.getElementById('expand-modal').addEventListener('click', () => {
    const modal = document.getElementById('expand-modal');
    feather.replace();
    modal.classList.add('hidden');
});

// Helper to render table HTML
function renderTableHTML(data, includeHeader=false) {
    let html = `<table class="table-auto border-collapse w-full">`;
    if(includeHeader && data.length) {
        html += '<thead class="bg-gray-100 sticky top-0 z-10">';
        html += '<tr>';
        Object.keys(data[0]).forEach(col => {
            html += `<th class="px-4 py-2 border">${formatHeader(col)}</th>`;
        });
        html += '</tr></thead>';
    }
    html += '<tbody>';
    data.forEach(row => {
        html += '<tr>';
        Object.values(row).forEach(cell => html += `<td class="px-4 py-2 border">${cell||''}</td>`);
        html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
}


document.getElementById('download-btn').addEventListener('click', () => {
    const container = document.getElementById('download-columns');
    container.innerHTML = '';
    Object.keys(fullData[0]).forEach(col => {
        const id = 'col-' + col;
        container.innerHTML += `
            <div>
                <input type="checkbox" id="${id}" checked/>
                <label for="${id}">${formatHeader(col)}</label>
            </div>
        `;
    });
    document.getElementById('download-modal').classList.remove('hidden');
});

document.getElementById('download-cancel').addEventListener('click', () => {
    document.getElementById('download-modal').classList.add('hidden');
});

// Confirm download
document.getElementById('download-confirm').addEventListener('click', () => {
    const selectedCols = Object.keys(fullData[0]).filter(col => document.getElementById('col-' + col).checked);
    const dataToDownload = document.getElementById('download-filtered').checked ? fullDataCurrentView || fullData : fullData;

    let csv = selectedCols.join(',') + '\n';
    dataToDownload.forEach(row => {
        csv += selectedCols.map(col => `"${row[col] || ''}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'lexicon.csv';
    link.click();
    document.getElementById('download-modal').classList.add('hidden');
});

