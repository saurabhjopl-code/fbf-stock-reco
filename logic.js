/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   VERSION: V2.0 (STABLE EXTENSIONS)
   BASE: USER PROVIDED V1.9 (WORKING)
   UI VERSION: V1.1 (LOCKED)
====================================================== */

console.log('LOGIC V2.0 LOADED');

/* ================= FC MASTER MAP ================= */
const FC_MAP = {
  'ulub_bts': { key: 'kolkata', label: 'Kolkata' },
  'kolkata_uluberia_bts': { key: 'kolkata', label: 'Kolkata' },
  'malur_bts': { key: 'bangalore', label: 'Bangalore' },
  'malur_bts_warehouse': { key: 'bangalore', label: 'Bangalore' },
  'bhi_vas_wh_nl_01nl': { key: 'mumbai', label: 'Mumbai' },
  'bhiwandi_bts': { key: 'mumbai', label: 'Mumbai' },
  'gur_san_wh_nl_01nl': { key: 'sanpka', label: 'Sanpka' },
  'sanpka_01': { key: 'sanpka', label: 'Sanpka' },
  'hyderabad_medchal_01': { key: 'hyderabad', label: 'Hyderabad' },
  'luc_has_wh_nl_02nl': { key: 'lucknow', label: 'Lucknow' },
  'loc979d1d9aca154ae0a5d72fc1a199aece': { key: 'seller', label: 'Seller' },
  'na': { key: 'seller', label: 'Seller' }
};

const normalizeRaw = v =>
  String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

const resolveFC = raw => FC_MAP[normalizeRaw(raw)] || null;

/* ================= GLOBAL STATE ================= */
const STATE = {
  config: {},
  files: {},
  results: {},
  sellerResults: [],
  fcSaleSummary: {},
  fcStockSummary: {},
  fcLabels: {},
  uniStock: {}
};

/* ================= HELPERS ================= */
const setProgress = p => {
  document.querySelector('.progress-bar').style.width = p + '%';
  document.querySelector('.progress-bar').textContent = p + '%';
};

const readFile = file =>
  new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => {
      if (file.name.endsWith('.csv')) {
        resolve(Papa.parse(e.target.result, { header: true }).data);
      } else {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
      }
    };
    file.name.endsWith('.csv')
      ? r.readAsText(file)
      : r.readAsBinaryString(file);
  });

/* ================= CORE ENGINE ================= */
async function runEngine() {
  setProgress(10);

  const [sales, fbf, uniware, fcAsk] = await Promise.all([
    readFile(STATE.files[0]),
    readFile(STATE.files[1]),
    readFile(STATE.files[2]),
    readFile(STATE.files[3])
  ]);

  setProgress(30);

  /* ---------- UNIWARE STOCK ---------- */
  uniware.forEach(r => {
    STATE.uniStock[r['Sku Code']] = +r['Available (ATP)'] || 0;
  });

  /* ---------- SALE + STOCK MAPS ---------- */
  const saleMap = {};
  const fcSaleSummary = {};
  const fcStockSummary = {};

  sales.forEach(r => {
    const fc = resolveFC(r['Location Id']);
    if (!fc) return;
    const key = `${r['SKU ID']}|${fc.key}`;
    const qty = +r['Gross Units'] || 0;
    saleMap[key] = (saleMap[key] || 0) + qty;
    fcSaleSummary[fc.key] = (fcSaleSummary[fc.key] || 0) + qty;
    STATE.fcLabels[fc.key] = fc.label;
  });

  fbf.forEach(r => {
    const fc = resolveFC(r['Warehouse Id']);
    if (!fc) return;
    const qty = +r['Live on Website'] || 0;
    fcStockSummary[fc.key] = (fcStockSummary[fc.key] || 0) + qty;
    STATE.fcLabels[fc.key] = fc.label;
  });

  STATE.fcSaleSummary = fcSaleSummary;
  STATE.fcStockSummary = fcStockSummary;

  setProgress(60);

  renderFCSummaryExtended();
  renderFCSaleSummaryExtended();

  setProgress(100);
}

/* ================= FC PERFORMANCE SUMMARY ================= */
function renderFCSummaryExtended() {
  const rows = Object.keys(STATE.fcSaleSummary).map(fcKey => {
    const sale = STATE.fcSaleSummary[fcKey] || 0;
    const stock = STATE.fcStockSummary[fcKey] || 0;
    const drr = sale ? sale / 30 : 0;
    const sc = drr ? stock / drr : 0;
    const uniTotal = Object.values(STATE.uniStock).reduce((a, b) => a + b, 0);
    const stockPct = uniTotal ? (stock / (stock + uniTotal)) * 100 : 0;

    return {
      fcKey,
      label: STATE.fcLabels[fcKey],
      sale,
      stock,
      drr,
      sc,
      stockPct
    };
  });

  rows.sort((a, b) => {
    if (a.fcKey === 'seller') return 1;
    if (b.fcKey === 'seller') return -1;
    return b.stock - a.stock;
  });

  let html = `<h3>FC Performance Summary</h3>
  <table class="zebra center">
  <tr>
    <th>FC</th><th>FC Stock</th><th>DRR</th><th>SC</th><th>Stock %</th>
  </tr>`;

  rows.forEach(r => {
    html += `<tr>
      <td>${r.label}</td>
      <td>${r.stock}</td>
      <td>${r.drr.toFixed(2)}</td>
      <td>${r.sc.toFixed(1)}</td>
      <td>${r.stockPct.toFixed(1)}%</td>
    </tr>`;
  });

  document.querySelectorAll('.summary-grid .card')[0].innerHTML = html + '</table>';
}

/* ================= FC SALE SUMMARY ================= */
function renderFCSaleSummaryExtended() {
  let html = `<h3>FC wise Sale in 30D</h3>
  <table class="zebra center">
  <tr><th>FC</th><th>30D Sale</th><th>Sale Through %</th></tr>`;

  Object.keys(STATE.fcSaleSummary).forEach(fcKey => {
    const sale = STATE.fcSaleSummary[fcKey] || 0;
    const stock = STATE.fcStockSummary[fcKey] || 0;
    const pct = sale + stock ? (sale / (sale + stock)) * 100 : 0;

    html += `<tr>
      <td>${STATE.fcLabels[fcKey]}</td>
      <td>${sale}</td>
      <td>${pct.toFixed(1)}%</td>
    </tr>`;
  });

  document.querySelectorAll('.summary-grid .card')[1].innerHTML = html + '</table>';
}

/* ================= GENERATE ================= */
document.querySelector('.btn-primary').onclick = () => {
  if (Object.keys(STATE.files).length !== 4) {
    alert('Please upload all 4 files');
    return;
  }
  runEngine();
};
