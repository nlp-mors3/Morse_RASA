let fullData = [];          // all rows from CSV
let currentPage = 1;
const rowsPerPage = 50;
let currentSort = { column: null, direction: null };

function parseCSV(csvText) {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",");

    const rows = lines.slice(1).map(line => {
        const values = line.split(",");
        let obj = {};
        headers.forEach((h, i) => obj[h] = values[i]);
        return obj;
    });

    return { headers, rows };
}

function renderTableHeader(headers) {
    const thead = document.getElementById("lexicon-thead");
    thead.innerHTML = "";

    const tr = document.createElement("tr");

    headers.forEach((header, index) => {
        const th = document.createElement("th");

        th.innerHTML = `
            ${header}
            <button class="sort-btn" data-col="${header}">▼</button>
        `;

        tr.appendChild(th);
    });

    thead.appendChild(tr);
}

const popup = document.createElement("div");
popup.classList.add("sort-popup");
popup.innerHTML = `
    <div data-dir="asc">Sort Ascending</div>
    <div data-dir="desc">Sort Descending</div>
`;
document.body.appendChild(popup);

document.addEventListener("click", e => {
    if (e.target.classList.contains("sort-btn")) {
        let rect = e.target.getBoundingClientRect();
        popup.style.left = rect.left + "px";
        popup.style.top = rect.bottom + "px";
        popup.style.display = "block";
        popup.dataset.column = e.target.dataset.col;
    } else if (e.target.parentElement === popup) {
        popup.style.display = "none";
        sortByColumn(popup.dataset.column, e.target.dataset.dir);
    } else {
        popup.style.display = "none";
    }
});

function sortByColumn(column, direction) {
    fullData.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];

        return direction === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
    });

    currentSort = { column, direction };
    renderPage();
}

function renderTableRows(rows) {
    const tbody = document.getElementById("lexicon-tbody");
    tbody.innerHTML = "";

    rows.forEach(row => {
        const tr = document.createElement("tr");

        for (let col in row) {
            const td = document.createElement("td");
            td.textContent = row[col];
            tr.appendChild(td);
        }

        tbody.appendChild(tr);
    });
}

function renderPage() {
    let start = (currentPage - 1) * rowsPerPage;
    let pageRows = fullData.slice(start, start + rowsPerPage);

    renderTableRows(pageRows);

    document.getElementById("page-info").textContent =
        `Page ${currentPage} of ${Math.ceil(fullData.length / rowsPerPage)}`;
}

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

document.addEventListener("DOMContentLoaded", () => {
    // Example CSV placeholder (replace this later with your server response)
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
