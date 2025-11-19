// Row Data Interface

// Grid API: Access to Grid API methods
let gridApi;

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

document.addEventListener('DOMContentLoaded', function() {
    // Load organisations.tsv and populate dropdown
    fetchTextFile('resources/organisations.tsv').then(tsv => {
        const orgs = csvStringToJsonArray(tsv);
        // sort orgs by name_en using Swedish locale
        orgs.sort((a, b) => a.name_en.localeCompare(b.name_en, 'sv-SE'));
        const select = document.getElementById('orgSelect');
        const downloadBtn = document.getElementById('downloadCsvBtn');
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
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${slug}.csv`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                })
                .catch(err => {
                    alert('Could not download CSV for ' + slug + ': ' + err.message);
                }
            );
        });
    });
});

function loadOrgCsv(slug) {
    const path = `outputs/${slug}.csv`;
    fetchTextFile(path)
        .then(csv => {
            const jsonArray = csvStringToJsonArray(csv);
            gridApi.setGridOption('rowData', jsonArray);
            document.getElementById('downloadCsvBtnLabel').textContent = `Download ${slug}.csv`;
        })
        .catch(err => {
            gridApi.setGridOption('rowData', []);
            alert('Could not load CSV "' + slug + '.csv": ' + err.message);
        });
}

