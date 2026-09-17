const GITHUB_REPO = 'snd-sweden/roagg-output';

// Row Data Interface

// Grid API: Access to Grid API methods
let gridApi;
let resourceTypeBarChart;
let resourceTypePieChart;
let publicationYearBarChart;

// Grid Options: Contains all of the grid configurations
const gridOptions = {
    pagination: true,
    scrollbars: true,
    rowSelection: {
        mode: 'multiRow',
        copySelectedRows: true
    },
    // Data to be displayed
    rowData: [], 
    // Columns to be displayed (Should match rowData properties)
    columnDefs: [
        { field: "doi",
            cellRenderer: params => {
                if (!params.value) return '';
                return `<a href="https://doi.org/${params.value}" target="_blank" rel="noopener noreferrer">${params.value}</a>`;
            } 
        },
        { field: "dataCiteClientName", filter: true, floatingFilter: true  },
        { field: "publicationYear", filter: true, floatingFilter: true  },
        { field: "resourceType", filter: true, floatingFilter: true  },
        { field: "title", filter: true, floatingFilter: true  },
        { field: "publisher", filter: true, floatingFilter: true  },
        { field: "isPublisher", filter: true, floatingFilter: true  },
        { field: "isLatestVersion", filter: true, floatingFilter: true  },
        { field: "isConceptDoi", filter: true, floatingFilter: true  },
        { field: "createdAt" },
        { field: "updatedAt" },
        { field: "inDataCite", filter: true, floatingFilter: true },
        { field: "inOpenAire", filter: true, floatingFilter: true },
        { field: "inOpenAlex", filter: true, floatingFilter: true  }
    ],
    defaultColDef: {
        flex: 1,
    }
};
// Create Grid: Create new grid within the #myGrid div, using the Grid Options object
gridApi = agGrid.createGrid(document.querySelector("#myGrid"), gridOptions);


// Read a CSV string and convert it to a JSON array using PapaParse
function csvStringToJsonArray(csv) {
    return Papa.parse(csv, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false
    }).data;
}

// Fetch a text file (csv or tsv) from the server
function fetchTextFile(path) {
    return fetch(path).then(r => {
        if (!r.ok) throw new Error('Failed to fetch ' + path);
        return r.text();
    });
}

function downloadCsvFile(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadXlsxFile(csv, filename) {
    const rows = Papa.parse(csv, {
        skipEmptyLines: true
    }).data;

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, filename);
}

function getResourceTypeCounts(rows) {
    const counts = new Map();

    rows.forEach(row => {
        const rawValue = row.resourceType;
        const key = (typeof rawValue === 'string' && rawValue.trim() !== '') ? rawValue.trim() : 'Unknown';
        counts.set(key, (counts.get(key) || 0) + 1);
    });

    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function getPublicationYearCounts(rows) {
    const counts = new Map();

    rows.forEach(row => {
        const rawValue = row.publicationYear;
        const key = (typeof rawValue === 'string' || typeof rawValue === 'number')
            ? String(rawValue).trim()
            : '';
        const normalizedKey = key !== '' ? key : 'Unknown';
        counts.set(normalizedKey, (counts.get(normalizedKey) || 0) + 1);
    });

    return [...counts.entries()].sort((a, b) => {
        const aNum = Number(a[0]);
        const bNum = Number(b[0]);
        const aIsNumber = Number.isFinite(aNum);
        const bIsNumber = Number.isFinite(bNum);

        if (aIsNumber && bIsNumber) return aNum - bNum;
        if (aIsNumber) return -1;
        if (bIsNumber) return 1;
        return a[0].localeCompare(b[0]);
    });
}

function paletteFor(length) {
    const base = [
        '#1e3963', '#3498db', '#85b9de', '#2f855a', '#f59e0b', '#e11d48',
        '#6d28d9', '#0f766e', '#b45309', '#475569', '#0369a1', '#15803d'
    ];
    const colors = [];

    for (let i = 0; i < length; i += 1) {
        colors.push(base[i % base.length]);
    }

    return colors;
}

function updateResourceTypeCharts(rows) {
    const barCanvas = document.getElementById('resourceTypeBarChart');
    const pieCanvas = document.getElementById('resourceTypePieChart');
    const publicationYearCanvas = document.getElementById('publicationYearBarChart');

    if (!barCanvas || !pieCanvas || !publicationYearCanvas || typeof Chart === 'undefined') {
        return;
    }

    const publicationYearCounts = getPublicationYearCounts(rows);
    const publicationYearLabels = publicationYearCounts.map(item => item[0]);
    const publicationYearValues = publicationYearCounts.map(item => item[1]);

    if (publicationYearBarChart) {
        publicationYearBarChart.destroy();
    }
    publicationYearBarChart = new Chart(publicationYearCanvas, {
        type: 'bar',
        data: {
            labels: publicationYearLabels,
            datasets: [{
                label: 'Outputs',
                data: publicationYearValues,
                backgroundColor: '#1e3963',
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });

    const counts = getResourceTypeCounts(rows);
    const labels = counts.map(item => item[0]);
    const values = counts.map(item => item[1]);
    const colors = paletteFor(labels.length);

    if (resourceTypeBarChart) {
        resourceTypeBarChart.destroy();
    }
    resourceTypeBarChart = new Chart(barCanvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Outputs',
                data: values,
                backgroundColor: colors,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });

    if (resourceTypePieChart) {
        resourceTypePieChart.destroy();
    }
    resourceTypePieChart = new Chart(pieCanvas, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 1,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Load organisations.tsv and populate dropdown
    fetchTextFile('resources/organisations.tsv').then(tsv => {
        const orgs = csvStringToJsonArray(tsv);
        // sort orgs by name_en using Swedish locale
        orgs.sort((a, b) => a.name_en.localeCompare(b.name_en, 'sv-SE'));
        const select = document.getElementById('orgSelect');
        const downloadBtn = document.getElementById('downloadCsvBtn');
        const downloadXlsxBtn = document.getElementById('downloadXlsxBtn');
        const gridTab = document.getElementById('grid-tab');

        if (gridTab) {
            gridTab.addEventListener('shown.bs.tab', function() {
                if (gridApi) {
                    gridApi.sizeColumnsToFit();
                }
            });
        }

        orgs.forEach(org => {
            const opt = document.createElement('option');
            opt.value = org.slug;
            opt.textContent = org.name_en + ' (' + org.slug + ')';
            select.appendChild(opt);
        });
        // Check if there's a hash in the URL and select that org
        let initialSlug = null;
        if (window.location.hash) {
            const hashSlug = window.location.hash.substring(1); // Remove the '#'
            // Check if this slug exists in our orgs
            const foundOrg = orgs.find(org => org.slug === hashSlug);
            if (foundOrg) {
                initialSlug = hashSlug;
            }
        }
        
        // If no valid hash, select the first org
        if (!initialSlug && orgs.length > 0) {
            initialSlug = orgs[0].slug;
        }
        
        if (initialSlug) {
            select.value = initialSlug;
            loadOrgCsv(initialSlug);
            // Set the hash without triggering a reload
            if (window.location.hash !== '#' + initialSlug) {
                window.history.replaceState(null, '', '#' + initialSlug);
            }
        }
        
        select.addEventListener('change', function() {
            const slug = this.value;
            loadOrgCsv(slug);
            // Update the URL hash
            window.history.pushState(null, '', '#' + slug);
        });
        
        // Handle browser back/forward navigation
        window.addEventListener('hashchange', function() {
            const hashSlug = window.location.hash.substring(1);
            if (hashSlug && select.value !== hashSlug) {
                const foundOrg = orgs.find(org => org.slug === hashSlug);
                if (foundOrg) {
                    select.value = hashSlug;
                    loadOrgCsv(hashSlug);
                }
            }
        });

        // Download CSV button functionality
        downloadBtn.addEventListener('click', function() {
            const slug = select.value;
            const path = `outputs/${slug}.csv`;
            fetchTextFile(path)
                .then(csv => {
                    downloadCsvFile(csv, `${slug}.csv`);
                })
                .catch(err => {
                    alert('Could not download CSV for ' + slug + ': ' + err.message);
                }
            );
        });

        downloadXlsxBtn.addEventListener('click', function() {
            const slug = select.value;
            const path = `outputs/${slug}.csv`;
            fetchTextFile(path)
                .then(csv => {
                    downloadXlsxFile(csv, `${slug}.xlsx`);
                })
                .catch(err => {
                    alert('Could not download XLSX for ' + slug + ': ' + err.message);
                }
            );
        });
    });
});

function loadLastUpdated(slug) {
    // GitHub Pages doesn't reliably expose a Last-Modified header, so we ask the
    // GitHub API for the last commit that touched this org's CSV instead.
    const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/commits?path=outputs/${slug}.csv&per_page=1`;
    fetch(apiUrl)
        .then(r => {
            if (!r.ok) throw new Error('Failed to fetch commit info');
            return r.json();
        })
        .then(commits => {
            const date = commits[0] && new Date(commits[0].commit.committer.date);
            document.getElementById('lastUpdate').textContent =
                date && !Number.isNaN(date.getTime())
                    ? date.toISOString().split('T')[0]
                    : 'Unknown';
        })
        .catch(() => {
            document.getElementById('lastUpdate').textContent = 'Unknown';
        });
}

function loadOrgCsv(slug) {
    const path = `outputs/${slug}.csv`;
    fetchTextFile(`${path}?v=${Date.now()}`) // Cache busting
        .then(csv => {
            const jsonArray = csvStringToJsonArray(csv);
            gridApi.setGridOption('rowData', jsonArray);
            updateResourceTypeCharts(jsonArray);
            document.getElementById('downloadCsvBtnLabel').textContent = `Download ${slug}.csv`;
            document.getElementById('downloadXlsxBtnLabel').textContent = `Download ${slug}.xlsx`;
        })
        .catch(err => {
            gridApi.setGridOption('rowData', []);
            updateResourceTypeCharts([]);
            alert('Could not load CSV "' + slug + '.csv": ' + err.message);
        });
    loadLastUpdated(slug);
}


