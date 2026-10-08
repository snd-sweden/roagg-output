const GITHUB_REPO = 'snd-sweden/roagg-output';
const ORGANISATIONS_PATH = 'resources/organisations.tsv';
const OUTPUTS_DIRECTORY = 'outputs';
const UNKNOWN_VALUE = 'Unknown';

const GENERIC_RESOURCE_TYPE_COLOR = '#9ca3af';
const PUBLICATION_YEAR_COLOR = '#1e3963';


/* ==========================================================================
   Resource type colors
   ========================================================================== */

const RESOURCE_TYPE_COLORS = {
    // Articles / established publications – blue
    Article: '#0000ff',
    JournalArticle: '#163ccf',
    Journal: '#315fdb',
    Book: '#234f9e',
    BookChapter: '#5278e8',

    // Conference contributions – light blue / cyan
    ConferencePaper: '#5ae0f3',
    ConferenceProceeding: '#29bcd3',
    Presentation: '#71cbdc',
    Poster: '#3da8c2',

    // Preprints and other text publications – purple
    Preprint: '#9e41d8',
    Text: '#ea8ef6',
    Dissertation: '#7651c9',
    Report: '#b568d8',
    Standard: '#6853a6',
    PeerReview: '#d17cdb',

    // Data – red
    Dataset: '#fd312d',
    DataPaper: '#d94a52',
    StudyRegistration: '#e46767',
    OutputManagementPlan: '#c93b72',

    // Audio / video / images – red and coral tones
    Audiovisual: '#f59a57',
    Sound: '#ef765f',
    Image: '#f3b078',
    InteractiveResource: '#e98672',

    // Software – yellow
    Software: '#f5eb58',

    // Models / notebooks / workflows – green
    Model: '#258c53',
    ComputationalNotebook: '#48b86b',
    Workflow: '#79c65a',

    // Other outputs – orange / yellow / green
    Award: '#f6c445',
    Collection: '#f28c28',
    Event: '#d9ad32',
    PhysicalObject: '#a6bd43',
    Project: '#56a96b',
    Other: '#e5a63b'
};


/* ==========================================================================
   DOM element IDs
   ========================================================================== */

const DOM_IDS = {
    grid: 'myGrid',
    listView: 'orgListView',
    detailView: 'orgDetailView',
    tableBody: 'orgTableBody',
    title: 'orgTitle',
    gridTab: 'grid-tab',

    downloadCsvButton: 'downloadCsvBtn',
    downloadXlsxButton: 'downloadXlsxBtn',
    downloadCsvLabel: 'downloadCsvBtnLabel',
    downloadXlsxLabel: 'downloadXlsxBtnLabel',

    lastUpdate: 'lastUpdate',

    resourceTypeBarChart: 'resourceTypeBarChart',
    resourceTypePieChart: 'resourceTypePieChart',
    publicationYearBarChart: 'publicationYearBarChart',
    yearRangePanel: 'yearRangePanel',
    yearFrom: 'yearFrom',
    yearTo: 'yearTo',
    yearRangeLabel: 'yearRangeLabel',
    yearRangeFill: 'yearRangeFill',
    yearFromValue: 'yearFromValue',
    yearToValue: 'yearToValue'
};


/* ==========================================================================
   Chart state
   ========================================================================== */

const chartInstances = {
    resourceTypeBar: null,
    resourceTypePie: null,
    publicationYearBar: null
};

let statisticsRows = [];
let yearRangeInitialized = false;


/* ==========================================================================
   Grid configuration
   ========================================================================== */

const gridOptions = {
    pagination: true,
    scrollbars: true,

    rowSelection: {
        mode: 'multiRow',
        copySelectedRows: true
    },

    rowData: [],

    columnDefs: [
        {
            field: 'doi',
            cellRenderer: ({ value }) => {
                if (!value) {
                    return '';
                }

                return `
                    <a
                        href="https://doi.org/${value}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        ${value}
                    </a>
                `;
            }
        },

        {
            field: 'dataCiteClientName',
            filter: true,
            floatingFilter: true
        },
        {
            field: 'publicationYear',
            filter: true,
            floatingFilter: true
        },
        {
            field: 'resourceType',
            filter: true,
            floatingFilter: true
        },
        {
            field: 'title',
            filter: true,
            floatingFilter: true
        },
        {
            field: 'publisher',
            filter: true,
            floatingFilter: true
        },
        {
            field: 'isPublisher',
            filter: true,
            floatingFilter: true
        },
        {
            field: 'isLatestVersion',
            filter: true,
            floatingFilter: true
        },
        {
            field: 'isConceptDoi',
            filter: true,
            floatingFilter: true
        },
        {
            field: 'createdAt'
        },
        {
            field: 'updatedAt'
        },
        {
            field: 'inDataCite',
            filter: true,
            floatingFilter: true
        },
        {
            field: 'inOpenAire',
            filter: true,
            floatingFilter: true
        },
        {
            field: 'inOpenAlex',
            filter: true,
            floatingFilter: true
        }
    ],

    defaultColDef: {
        flex: 1
    }
};


const gridElement = document.getElementById(DOM_IDS.grid);
const gridApi = agGrid.createGrid(gridElement, gridOptions);


/* ==========================================================================
   General utilities
   ========================================================================== */

function getElement(id) {
    return document.getElementById(id);
}


function outputPath(slug) {
    return `${OUTPUTS_DIRECTORY}/${slug}.csv`;
}


function normalizeString(value) {
    return typeof value === 'string'
        ? value.trim()
        : '';
}


/* ==========================================================================
   File loading and parsing
   ========================================================================== */

function parseDelimitedText(text) {
    return Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false
    }).data;
}


async function fetchTextFile(path) {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`Failed to fetch ${path}`);
    }

    return response.text();
}


/* ==========================================================================
   Downloads
   ========================================================================== */

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;

    document.body.appendChild(link);

    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}


function downloadCsvFile(csv, filename) {
    const blob = new Blob(
        [csv],
        { type: 'text/csv' }
    );

    downloadBlob(blob, filename);
}


function downloadXlsxFile(csv, filename) {
    const rows = Papa.parse(csv, {
        skipEmptyLines: true
    }).data;

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        'Data'
    );

    XLSX.writeFile(
        workbook,
        filename
    );
}


/* ==========================================================================
   Data normalization
   ========================================================================== */

function normalizeResourceType(value) {
    return normalizeString(value) || UNKNOWN_VALUE;
}


function normalizePublicationYear(value) {
    if (
        typeof value !== 'string' &&
        typeof value !== 'number'
    ) {
        return UNKNOWN_VALUE;
    }

    return String(value).trim() || UNKNOWN_VALUE;
}


/* ==========================================================================
   Data aggregation
   ========================================================================== */

function countBy(rows, getKey) {
    const counts = new Map();

    for (const row of rows) {
        const key = getKey(row);

        counts.set(
            key,
            (counts.get(key) || 0) + 1
        );
    }

    return [...counts.entries()];
}


function getResourceTypeCounts(rows) {
    return countBy(
        rows,
        row => normalizeResourceType(row.resourceType)
    ).sort(
        (a, b) => b[1] - a[1]
    );
}


function getPublicationYearCounts(rows) {
    return countBy(
        rows,
        row => normalizePublicationYear(row.publicationYear)
    ).sort(
        ([yearA], [yearB]) =>
            comparePublicationYears(yearA, yearB)
    );
}


function comparePublicationYears(yearA, yearB) {
    const numberA = Number(yearA);
    const numberB = Number(yearB);

    const aIsNumber = Number.isFinite(numberA);
    const bIsNumber = Number.isFinite(numberB);

    if (aIsNumber && bIsNumber) {
        return numberA - numberB;
    }

    if (aIsNumber) {
        return -1;
    }

    if (bIsNumber) {
        return 1;
    }

    return yearA.localeCompare(yearB);
}


function splitCounts(counts) {
    return {
        labels: counts.map(
            ([label]) => label
        ),

        values: counts.map(
            ([, count]) => count
        )
    };
}


/* ==========================================================================
   Resource type colors
   ========================================================================== */

function getResourceTypeColor(resourceType) {
    return (
        RESOURCE_TYPE_COLORS[resourceType] ||
        GENERIC_RESOURCE_TYPE_COLOR
    );
}


/* ==========================================================================
   Charts
   ========================================================================== */

function destroyChart(chartKey) {
    chartInstances[chartKey]?.destroy();
    chartInstances[chartKey] = null;
}


function createBarChart(
    canvas,
    labels,
    values,
    backgroundColor
) {
    return new Chart(canvas, {
        type: 'bar',

        data: {
            labels,

            datasets: [
                {
                    label: 'Outputs',
                    data: values,
                    backgroundColor,
                    borderWidth: 0
                }
            ]
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
}


function createDoughnutChart(
    canvas,
    labels,
    values,
    backgroundColor
) {
    return new Chart(canvas, {
        type: 'doughnut',

        data: {
            labels,

            datasets: [
                {
                    data: values,
                    backgroundColor,
                    borderWidth: 1,
                    borderColor: '#ffffff'
                }
            ]
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


function getNumericPublicationYear(row) {
    const year = Number(normalizePublicationYear(row.publicationYear));
    return Number.isInteger(year) ? year : null;
}

function filterRowsByYearRange(rows) {
    const from = Number(getElement(DOM_IDS.yearFrom)?.value);
    const to = Number(getElement(DOM_IDS.yearTo)?.value);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return rows;
    return rows.filter(row => {
        const year = getNumericPublicationYear(row);
        return year !== null && year >= from && year <= to;
    });
}

function updateYearRangeUi() {
    const fromInput = getElement(DOM_IDS.yearFrom);
    const toInput = getElement(DOM_IDS.yearTo);
    if (!fromInput || !toInput) return;

    let from = Number(fromInput.value);
    let to = Number(toInput.value);
    if (from > to) [from, to] = [to, from];

    getElement(DOM_IDS.yearFromValue).textContent = from;
    getElement(DOM_IDS.yearToValue).textContent = to;
    getElement(DOM_IDS.yearRangeLabel).textContent = `${from}–${to}`;

    const min = Number(fromInput.min);
    const max = Number(fromInput.max);
    const span = Math.max(1, max - min);
    const left = ((from - min) / span) * 100;
    const right = ((to - min) / span) * 100;
    const fill = getElement(DOM_IDS.yearRangeFill);
    fill.style.left = `${left}%`;
    fill.style.width = `${right - left}%`;
}

function handleYearRangeChange(event) {
    const fromInput = getElement(DOM_IDS.yearFrom);
    const toInput = getElement(DOM_IDS.yearTo);
    if (event.target === fromInput && Number(fromInput.value) > Number(toInput.value)) {
        fromInput.value = toInput.value;
    } else if (event.target === toInput && Number(toInput.value) < Number(fromInput.value)) {
        toInput.value = fromInput.value;
    }
    updateYearRangeUi();
    updateCharts(filterRowsByYearRange(statisticsRows));
}

function setupYearRange(rows) {
    statisticsRows = rows;
    const years = rows.map(getNumericPublicationYear).filter(year => year !== null);
    const panel = getElement(DOM_IDS.yearRangePanel);
    if (!panel) return;

    if (!years.length) {
        panel.hidden = true;
        updateCharts([]);
        return;
    }

    const min = Math.min(...years);
    const max = Math.max(...years);
    const fromInput = getElement(DOM_IDS.yearFrom);
    const toInput = getElement(DOM_IDS.yearTo);
    for (const input of [fromInput, toInput]) {
        input.min = min;
        input.max = max;
        input.step = 1;
    }
    fromInput.value = min;
    toInput.value = max;
    panel.hidden = false;

    if (!yearRangeInitialized) {
        fromInput.addEventListener('input', handleYearRangeChange);
        toInput.addEventListener('input', handleYearRangeChange);
        yearRangeInitialized = true;
    }
    updateYearRangeUi();
    updateCharts(filterRowsByYearRange(rows));
}

function updateCharts(rows) {
    if (typeof Chart === 'undefined') {
        return;
    }

    const resourceTypeBarCanvas =
        getElement(DOM_IDS.resourceTypeBarChart);

    const resourceTypePieCanvas =
        getElement(DOM_IDS.resourceTypePieChart);

    const publicationYearCanvas =
        getElement(DOM_IDS.publicationYearBarChart);

    if (
        !resourceTypeBarCanvas ||
        !resourceTypePieCanvas ||
        !publicationYearCanvas
    ) {
        return;
    }


    /*
     * Prepare publication year data
     */

    const publicationYears = splitCounts(
        getPublicationYearCounts(rows)
    );


    /*
     * Prepare resource type data
     */

    const resourceTypes = splitCounts(
        getResourceTypeCounts(rows)
    );

    const resourceTypeColors =
        resourceTypes.labels.map(
            getResourceTypeColor
        );


    /*
     * Publication year bar chart
     */

    renderChart(
        'publicationYearBar',
        () => createBarChart(
            publicationYearCanvas,
            publicationYears.labels,
            publicationYears.values,
            PUBLICATION_YEAR_COLOR
        ),
        publicationYears.labels,
        publicationYears.values,
        PUBLICATION_YEAR_COLOR
    );

    renderChart(
        'resourceTypeBar',
        () => createBarChart(
            resourceTypeBarCanvas,
            resourceTypes.labels,
            resourceTypes.values,
            resourceTypeColors
        ),
        resourceTypes.labels,
        resourceTypes.values,
        resourceTypeColors
    );

    renderChart(
        'resourceTypePie',
        () => createDoughnutChart(
            resourceTypePieCanvas,
            resourceTypes.labels,
            resourceTypes.values,
            resourceTypeColors
        ),
        resourceTypes.labels,
        resourceTypes.values,
        resourceTypeColors
    );
}


function renderChart(key, create, labels, values, colors) {
    const chart = chartInstances[key];

    if (!chart) {
        chartInstances[key] = create();
        return;
    }

    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update('none');
}


/* ==========================================================================
   UI updates
   ========================================================================== */

function setDownloadLabels(slug) {
    const csvLabel =
        getElement(DOM_IDS.downloadCsvLabel);

    const xlsxLabel =
        getElement(DOM_IDS.downloadXlsxLabel);

    if (csvLabel) {
        csvLabel.textContent =
            `Download ${slug}.csv`;
    }

    if (xlsxLabel) {
        xlsxLabel.textContent =
            `Download ${slug}.xlsx`;
    }
}


function setLastUpdated(value) {
    const element =
        getElement(DOM_IDS.lastUpdate);

    if (element) {
        element.textContent = value;
    }
}


/* ==========================================================================
   Last updated information
   ========================================================================== */

async function loadLastUpdated(slug) {
    const apiUrl =
        `https://api.github.com/repos/${GITHUB_REPO}` +
        `/commits?path=${outputPath(slug)}&per_page=1`;

    try {
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(
                'Failed to fetch commit info'
            );
        }

        const commits =
            await response.json();

        const commitDate =
            commits[0]?.commit?.committer?.date;

        const date =
            commitDate
                ? new Date(commitDate)
                : null;

        const formattedDate =
            date &&
            !Number.isNaN(date.getTime())
                ? date.toISOString().split('T')[0]
                : UNKNOWN_VALUE;

        setLastUpdated(formattedDate);

    } catch {
        setLastUpdated(UNKNOWN_VALUE);
    }
}


/* ==========================================================================
   Organisation data
   ========================================================================== */

async function loadOrganisationData(slug) {
    const path = outputPath(slug);

    try {
        /*
         * Timestamp prevents the browser from returning
         * a cached version of the CSV.
         */
        const csv = await fetchTextFile(
            `${path}?v=${Date.now()}`
        );

        const rows =
            parseDelimitedText(csv);

        gridApi.setGridOption(
            'rowData',
            rows
        );

        setupYearRange(rows);
        setDownloadLabels(slug);

    } catch (error) {
        gridApi.setGridOption(
            'rowData',
            []
        );

        setupYearRange([]);

        alert(
            `Could not load CSV "${slug}.csv": ` +
            error.message
        );
    }

    /*
     * GitHub commit information is independent from
     * the CSV request, so it does not need to block it.
     */
    loadLastUpdated(slug);
}


/* ==========================================================================
   Organisation selector
   ========================================================================== */

let currentSlug = null;


function populateOrganisationTable(organisations) {
    const tbody = getElement(DOM_IDS.tableBody);

    for (const organisation of organisations) {
        const row = document.createElement('tr');
        const nameCell = document.createElement('td');
        const slugCell = document.createElement('td');
        const link = document.createElement('a');

        link.href = `#${organisation.slug}`;
        link.textContent = organisation.name_en;
        nameCell.appendChild(link);
        slugCell.textContent = organisation.slug;

        row.append(nameCell, slugCell);
        tbody.appendChild(row);
    }
}


function showOrganisationFromHash(organisations) {
    const hashSlug =
        decodeURIComponent(window.location.hash.slice(1));

    const organisation =
        organisations.find(({ slug }) => slug === hashSlug);

    const listView = getElement(DOM_IDS.listView);
    const detailView = getElement(DOM_IDS.detailView);

    if (!organisation) {
        currentSlug = null;
        detailView.hidden = true;
        listView.hidden = false;
        return;
    }

    listView.hidden = true;
    detailView.hidden = false;

    getElement(DOM_IDS.title).textContent =
        `${organisation.name_en} (${organisation.slug})`;

    if (currentSlug !== organisation.slug) {
        currentSlug = organisation.slug;
        loadOrganisationData(organisation.slug);
    }

    gridApi.sizeColumnsToFit();
}


/* ==========================================================================
   Event handlers
   ========================================================================== */

function setupGridTabResize() {
    const gridTab =
        getElement(DOM_IDS.gridTab);

    gridTab?.addEventListener(
        'shown.bs.tab',
        () => {
            gridApi.sizeColumnsToFit();
        }
    );
}


function setupOrganisationNavigation(organisations) {
    window.addEventListener(
        'hashchange',
        () => showOrganisationFromHash(organisations)
    );
}


function setupDownloadButton(
    buttonId,
    format
) {
    const button =
        getElement(buttonId);

    if (!button) {
        return;
    }

    button.addEventListener(
        'click',
        async () => {
            const slug = currentSlug;

            if (!slug) {
                return;
            }

            const path = outputPath(slug);

            try {
                const csv =
                    await fetchTextFile(path);

                if (format === 'csv') {
                    downloadCsvFile(
                        csv,
                        `${slug}.csv`
                    );

                    return;
                }

                downloadXlsxFile(
                    csv,
                    `${slug}.xlsx`
                );

            } catch (error) {
                alert(
                    `Could not download ` +
                    `${format.toUpperCase()} ` +
                    `for ${slug}: ${error.message}`
                );
            }
        }
    );
}


/* ==========================================================================
   Application initialization
   ========================================================================== */

async function initializeApp() {
    try {
        /*
         * Load organisations
         */

        const tsv =
            await fetchTextFile(
                ORGANISATIONS_PATH
            );

        const organisations =
            parseDelimitedText(tsv)
                .sort(
                    (a, b) =>
                        a.name_en.localeCompare(
                            b.name_en,
                            'sv-SE'
                        )
                );


        /*
         * Build UI
         */

        populateOrganisationTable(organisations);

        setupGridTabResize();

        setupOrganisationNavigation(organisations);

        setupDownloadButton(
            DOM_IDS.downloadCsvButton,
            'csv'
        );

        setupDownloadButton(
            DOM_IDS.downloadXlsxButton,
            'xlsx'
        );

        showOrganisationFromHash(organisations);

    } catch (error) {
        console.error(
            'Could not initialize application:',
            error
        );
    }
}


document.addEventListener(
    'DOMContentLoaded',
    initializeApp
);