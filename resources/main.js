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
    Article: '#1e3963',
    Audiovisual: '#3498db',
    Award: '#85b9de',
    Book: '#2f855a',
    BookChapter: '#f59e0b',
    Collection: '#e11d48',
    ComputationalNotebook: '#6d28d9',
    ConferencePaper: '#0f766e',
    ConferenceProceeding: '#b45309',
    DataPaper: '#475569',
    Dataset: '#0369a1',
    Dissertation: '#15803d',
    Event: '#7c3aed',
    Image: '#0284c7',
    InteractiveResource: '#059669',
    Journal: '#d97706',
    JournalArticle: '#dc2626',
    Model: '#9333ea',
    Other: '#0891b2',
    OutputManagementPlan: '#65a30d',
    PeerReview: '#ca8a04',
    PhysicalObject: '#c2410c',
    Poster: '#be185d',
    Preprint: '#4f46e5',
    Presentation: '#0d9488',
    Project: '#16a34a',
    Report: '#ea580c',
    Software: '#db2777',
    Sound: '#8b5cf6',
    Standard: '#2563eb',
    StudyRegistration: '#10b981',
    Text: '#f97316',
    Workflow: '#a855f7'
};


/* ==========================================================================
   DOM element IDs
   ========================================================================== */

const DOM_IDS = {
    grid: 'myGrid',
    organisationSelect: 'orgSelect',
    gridTab: 'grid-tab',

    downloadCsvButton: 'downloadCsvBtn',
    downloadXlsxButton: 'downloadXlsxBtn',
    downloadCsvLabel: 'downloadCsvBtnLabel',
    downloadXlsxLabel: 'downloadXlsxBtnLabel',

    lastUpdate: 'lastUpdate',

    resourceTypeBarChart: 'resourceTypeBarChart',
    resourceTypePieChart: 'resourceTypePieChart',
    publicationYearBarChart: 'publicationYearBarChart'
};


/* ==========================================================================
   Chart state
   ========================================================================== */

const chartInstances = {
    resourceTypeBar: null,
    resourceTypePie: null,
    publicationYearBar: null
};


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

    destroyChart('publicationYearBar');

    chartInstances.publicationYearBar =
        createBarChart(
            publicationYearCanvas,
            publicationYears.labels,
            publicationYears.values,
            PUBLICATION_YEAR_COLOR
        );


    /*
     * Resource type bar chart
     */

    destroyChart('resourceTypeBar');

    chartInstances.resourceTypeBar =
        createBarChart(
            resourceTypeBarCanvas,
            resourceTypes.labels,
            resourceTypes.values,
            resourceTypeColors
        );


    /*
     * Resource type doughnut chart
     */

    destroyChart('resourceTypePie');

    chartInstances.resourceTypePie =
        createDoughnutChart(
            resourceTypePieCanvas,
            resourceTypes.labels,
            resourceTypes.values,
            resourceTypeColors
        );
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

        updateCharts(rows);
        setDownloadLabels(slug);

    } catch (error) {
        gridApi.setGridOption(
            'rowData',
            []
        );

        updateCharts([]);

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

function populateOrganisationSelect(
    select,
    organisations
) {
    const fragment =
        document.createDocumentFragment();

    for (const organisation of organisations) {
        const option =
            document.createElement('option');

        option.value =
            organisation.slug;

        option.textContent =
            `${organisation.name_en} ` +
            `(${organisation.slug})`;

        fragment.appendChild(option);
    }

    select.appendChild(fragment);
}


function findInitialSlug(organisations) {
    const hashSlug =
        window.location.hash.slice(1);

    const slugExists =
        organisations.some(
            ({ slug }) => slug === hashSlug
        );

    if (hashSlug && slugExists) {
        return hashSlug;
    }

    return organisations[0]?.slug || null;
}


function selectOrganisation(
    select,
    slug,
    { updateHistory = false } = {}
) {
    select.value = slug;

    loadOrganisationData(slug);

    if (updateHistory) {
        window.history.pushState(
            null,
            '',
            `#${slug}`
        );
    }
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


function setupOrganisationNavigation(
    select,
    organisations
) {
    /*
     * Organisation changed through dropdown
     */

    select.addEventListener(
        'change',
        () => {
            selectOrganisation(
                select,
                select.value,
                { updateHistory: true }
            );
        }
    );


    /*
     * Browser back/forward navigation
     */

    window.addEventListener(
        'hashchange',
        () => {
            const hashSlug =
                window.location.hash.slice(1);

            const slugExists =
                organisations.some(
                    ({ slug }) =>
                        slug === hashSlug
                );

            if (
                hashSlug &&
                slugExists &&
                select.value !== hashSlug
            ) {
                selectOrganisation(
                    select,
                    hashSlug
                );
            }
        }
    );
}


function setupDownloadButton(
    buttonId,
    select,
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
            const slug = select.value;
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
    const select =
        getElement(
            DOM_IDS.organisationSelect
        );

    if (!select) {
        return;
    }

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

        populateOrganisationSelect(
            select,
            organisations
        );

        setupGridTabResize();

        setupOrganisationNavigation(
            select,
            organisations
        );

        setupDownloadButton(
            DOM_IDS.downloadCsvButton,
            select,
            'csv'
        );

        setupDownloadButton(
            DOM_IDS.downloadXlsxButton,
            select,
            'xlsx'
        );


        /*
         * Select initial organisation
         */

        const initialSlug =
            findInitialSlug(
                organisations
            );

        if (!initialSlug) {
            return;
        }

        select.value = initialSlug;

        loadOrganisationData(
            initialSlug
        );


        /*
         * Make sure the URL contains the selected org
         */

        if (
            window.location.hash !==
            `#${initialSlug}`
        ) {
            window.history.replaceState(
                null,
                '',
                `#${initialSlug}`
            );
        }

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