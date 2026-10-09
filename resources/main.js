const { createApp, nextTick, markRaw } = Vue;

const CONFIG = {
  githubRepo: 'snd-sweden/roagg-output',
  organisationsPath: 'resources/organisations.tsv',
  outputsDirectory: 'outputs',
  unknownValue: 'Unknown'
};

const COLORS = {
  publicationYear: '#1e3963',
  genericResourceType: '#9ca3af',
  resourceTypes: {
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
  }
};

const GRID_OPTIONS = {
  pagination: true,
  rowSelection: { mode: 'multiRow', copySelectedRows: true },
  rowData: [],
  defaultColDef: { flex: 1 },
  columnDefs: [
    {
      field: 'doi',
      cellRenderer: ({ value }) => value
        ? `<a href="https://doi.org/${encodeURIComponent(value)}" target="_blank" rel="noopener noreferrer">${value}</a>`
        : ''
    },
    ...[
      'dataCiteClientName', 'publicationYear', 'resourceType', 'title', 'publisher',
      'isPublisher', 'isLatestVersion', 'isConceptDoi', 'inDataCite', 'inOpenAire', 'inOpenAlex'
    ].map(field => ({ field, filter: true, floatingFilter: true })),
    { field: 'createdAt' },
    { field: 'updatedAt' }
  ]
};

function outputPath(slug) {
  return `${CONFIG.outputsDirectory}/${slug}.csv`;
}

async function fetchText(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Failed to fetch ${path}`);
  return response.text();
}

function parseDelimited(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true, dynamicTyping: false }).data;
}

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

function countBy(rows, keyFn) {
  const counts = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()];
}

function publicationYear(row) {
  const raw = row.publicationYear;
  if (typeof raw !== 'string' && typeof raw !== 'number') return CONFIG.unknownValue;
  return String(raw).trim() || CONFIG.unknownValue;
}

function numericPublicationYear(row) {
  const year = Number(publicationYear(row));
  return Number.isInteger(year) ? year : null;
}

function dataCiteClientName(row) {
  return typeof row.dataCiteClientName === 'string' && row.dataCiteClientName.trim()
    ? row.dataCiteClientName.trim()
    : CONFIG.unknownValue;
}

const CLIENT_PALETTE = ['#1e3963', '#56a96b', '#e5a63b', '#c8553d', '#6c8ebf', '#8e6bbf', '#3fa7a3', '#d98cb3', '#7a8b3c', '#b07a4f'];

function resourceType(row) {
  return typeof row.resourceType === 'string' && row.resourceType.trim()
    ? row.resourceType.trim()
    : CONFIG.unknownValue;
}

function updateChart(chart, labels, values, colors) {
  chart.data.labels = labels;
  chart.data.datasets[0].data = values;
  chart.data.datasets[0].backgroundColor = colors;
  chart.update('none');
}

createApp({
  data() {
    return {
      organisations: [],
      currentOrganisation: null,
      rows: [],
      activeTab: 'grid',
      minYear: null,
      maxYear: null,
      yearFrom: null,
      yearTo: null,
      lastUpdated: CONFIG.unknownValue,
      loading: false,
      error: '',
      gridApi: null,
      charts: {
        publicationYear: null,
        resourceTypeBar: null,
        dataCiteClientPie: null
      }
    };
  },

  computed: {
    hasYearRange() {
      return Number.isInteger(this.minYear) && Number.isInteger(this.maxYear);
    },

    filteredRows() {
      if (!this.hasYearRange) return [];
      return this.rows.filter(row => {
        const year = numericPublicationYear(row);
        return year !== null && year >= this.yearFrom && year <= this.yearTo;
      });
    },

    sourceCounts() {
      const sources = [
        ['inDataCite', 'DataCite'], ['inOpenAire', 'OpenAIRE'],
        ['inOpenAlex', 'OpenAlex'],
      ];
      const total = this.filteredRows.length;
      return sources.map(([field, label]) => {
        const count = this.filteredRows.filter(row => ['1', 'true'].includes(String(row[field] ?? '').trim().toLowerCase())).length;
        return { field, label, count, percent: total ? Math.round((count / total) * 1000) / 10 : 0 };
      });
    },

    yearRangeFillStyle() {
      if (!this.hasYearRange) return {};
      const span = Math.max(1, this.maxYear - this.minYear);
      const left = ((this.yearFrom - this.minYear) / span) * 100;
      const right = ((this.yearTo - this.minYear) / span) * 100;
      return { left: `${left}%`, width: `${right - left}%` };
    }
  },

  watch: {
    activeTab(tab) {
      nextTick(() => {
        if (tab === 'grid') this.gridApi?.sizeColumnsToFit();
        if (tab === 'statistics') this.renderCharts();
      });
    },

    // Watch the slider values directly. This is more reliable than watching
    // the computed filteredRows array and refreshes the charts on every move.
    yearFrom() {
      this.refreshCharts();
    },

    yearTo() {
      this.refreshCharts();
    }
  },

  methods: {
    async initialize() {
      try {
        const tsv = await fetchText(CONFIG.organisationsPath);
        this.organisations = parseDelimited(tsv).sort((a, b) => a.name_en.localeCompare(b.name_en, 'sv-SE'));
        this.handleHashChange();
      } catch (error) {
        this.error = `Could not initialize application: ${error.message}`;
        console.error(error);
      }
    },

    async handleHashChange() {
      const slug = decodeURIComponent(location.hash.slice(1));
      const organisation = this.organisations.find(item => item.slug === slug) || null;

      if (!organisation) {
        this.teardownDetailView();
        this.currentOrganisation = null;
        this.rows = [];
        this.error = '';
        return;
      }

      if (organisation.slug === this.currentOrganisation?.slug) return;

      this.currentOrganisation = organisation;
      this.activeTab = 'grid';
      await nextTick();
      this.ensureGrid();
      await this.loadOrganisation(organisation.slug);
    },

    ensureGrid() {
      if (!this.gridApi && this.$refs.gridElement) {
        this.gridApi = agGrid.createGrid(this.$refs.gridElement, GRID_OPTIONS);
      }
    },

    teardownDetailView() {
      Object.values(this.charts).forEach(chart => chart?.destroy());
      this.charts = { publicationYear: null, resourceTypeBar: null, dataCiteClientPie: null };
      this.gridApi?.destroy?.();
      this.gridApi = null;
    },

    async loadOrganisation(slug) {
      this.loading = true;
      this.error = '';
      this.lastUpdated = CONFIG.unknownValue;

      try {
        const csv = await fetchText(`${outputPath(slug)}?v=${Date.now()}`);
        this.rows = parseDelimited(csv);
        this.gridApi?.setGridOption('rowData', this.rows);
        this.configureYearRange();
        nextTick(() => this.gridApi?.sizeColumnsToFit());
      } catch (error) {
        this.rows = [];
        this.gridApi?.setGridOption('rowData', []);
        this.configureYearRange();
        this.error = `Could not load CSV "${slug}.csv": ${error.message}`;
      } finally {
        this.loading = false;
      }

      this.loadLastUpdated(slug);
    },

    configureYearRange() {
      const years = this.rows.map(numericPublicationYear).filter(Number.isInteger);
      if (!years.length) {
        this.minYear = this.maxYear = this.yearFrom = this.yearTo = null;
        this.renderCharts();
        return;
      }

      this.minYear = Math.min(...years);
      this.maxYear = Math.max(...years);
      this.yearFrom = this.minYear;
      this.yearTo = this.maxYear;
    },

    clampYearRange(changed) {
      if (changed === 'from' && this.yearFrom > this.yearTo) this.yearFrom = this.yearTo;
      if (changed === 'to' && this.yearTo < this.yearFrom) this.yearTo = this.yearFrom;
    },

    refreshCharts() {
      if (this.activeTab !== 'statistics') return;
      nextTick(() => this.renderCharts());
    },

    async loadLastUpdated(slug) {
      const url = `https://api.github.com/repos/${CONFIG.githubRepo}/commits?path=${outputPath(slug)}&per_page=1`;
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch commit info');
        const commits = await response.json();
        const date = commits[0]?.commit?.committer?.date ? new Date(commits[0].commit.committer.date) : null;
        this.lastUpdated = date && !Number.isNaN(date.getTime()) ? date.toISOString().split('T')[0] : CONFIG.unknownValue;
      } catch {
        this.lastUpdated = CONFIG.unknownValue;
      }
    },

    async download(format) {
      const slug = this.currentOrganisation?.slug;
      if (!slug) return;

      try {
        const csv = await fetchText(outputPath(slug));
        if (format === 'csv') {
          downloadBlob(new Blob([csv], { type: 'text/csv' }), `${slug}.csv`);
          return;
        }

        const rows = Papa.parse(csv, { skipEmptyLines: true }).data;
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Data');
        XLSX.writeFile(workbook, `${slug}.xlsx`);
      } catch (error) {
        this.error = `Could not download ${format.toUpperCase()} for ${slug}: ${error.message}`;
      }
    },

    chartData() {
      const rows = this.filteredRows;
      const yearCounts = countBy(rows, publicationYear).sort(([a], [b]) => {
        const na = Number(a), nb = Number(b);
        if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
        if (Number.isFinite(na)) return -1;
        if (Number.isFinite(nb)) return 1;
        return a.localeCompare(b);
      });

      const typeCounts = countBy(rows, resourceType).sort((a, b) => b[1] - a[1]);
      const clientCounts = countBy(rows, dataCiteClientName).sort((a, b) => b[1] - a[1]);
      return { yearCounts, typeCounts, clientCounts };
    },

    renderCharts() {
      if (!this.currentOrganisation || typeof Chart === 'undefined') return;
      const { yearCounts, typeCounts, clientCounts } = this.chartData();
      const yearLabels = yearCounts.map(([label]) => label);
      const yearValues = yearCounts.map(([, value]) => value);
      const typeLabels = typeCounts.map(([label]) => label);
      const typeValues = typeCounts.map(([, value]) => value);
      const typeColors = typeLabels.map(label => COLORS.resourceTypes[label] || COLORS.genericResourceType);
      const clientLabels = clientCounts.map(([label]) => label);
      const clientValues = clientCounts.map(([, value]) => value);
      const clientColors = clientLabels.map((_, i) => CLIENT_PALETTE[i % CLIENT_PALETTE.length]);

      if (!this.charts.publicationYear && this.$refs.publicationYearChart) {
        this.charts.publicationYear = markRaw(this.createBarChart(this.$refs.publicationYearChart, yearLabels, yearValues, COLORS.publicationYear));
      } else if (this.charts.publicationYear) {
        updateChart(this.charts.publicationYear, yearLabels, yearValues, COLORS.publicationYear);
      }

      if (!this.charts.resourceTypeBar && this.$refs.resourceTypeBarChart) {
        this.charts.resourceTypeBar = markRaw(this.createBarChart(this.$refs.resourceTypeBarChart, typeLabels, typeValues, typeColors));
      } else if (this.charts.resourceTypeBar) {
        updateChart(this.charts.resourceTypeBar, typeLabels, typeValues, typeColors);
      }

      if (!this.charts.dataCiteClientPie && this.$refs.dataCiteClientPieChart) {
        this.charts.dataCiteClientPie = markRaw(new Chart(this.$refs.dataCiteClientPieChart, {
          type: 'doughnut',
          data: { labels: clientLabels, datasets: [{ data: clientValues, backgroundColor: clientColors, borderWidth: 1, borderColor: '#ffffff' }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        }));
      } else if (this.charts.dataCiteClientPie) {
        updateChart(this.charts.dataCiteClientPie, clientLabels, clientValues, clientColors);
      }
    },

    createBarChart(canvas, labels, values, backgroundColor) {
      return new Chart(canvas, {
        type: 'bar',
        data: { labels, datasets: [{ label: 'Outputs', data: values, backgroundColor, borderWidth: 0 }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });
    }
  },

  mounted() {
    window.addEventListener('hashchange', this.handleHashChange);
    this.initialize();
  },

  beforeUnmount() {
    window.removeEventListener('hashchange', this.handleHashChange);
    this.teardownDetailView();
  }
}).mount('#app');
