/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   STABLE PIPELINE VERSION
   UI LOCKED
====================================================== */

console.log('logic.js loaded');

/* ================= GLOBAL STATE ================= */
const STATE = {
  files: {},
  fcSaleSummary: {},
  fcStockSummary: {},
  fcLabels: {},
};

/* ================= FC NORMALIZATION ================= */
const FC_MAP = {
  'ulub_bts': 'Kolkata',
  'kolkata_uluberia_bts': 'Kolkata',
  'malur_bts': 'Bangalore',
  'malur_bts_warehouse': 'Bangalore',
  'bhi_vas_wh_nl_01nl': 'Mumbai',
  'bhiwandi_bts': 'Mumbai',
  'gur_san_wh_nl_01nl': 'Sanpka',
  'sanpka_01': 'Sanpka',
  'hyderabad_medchal_01': 'Hyderabad',
  'luc_has_wh_nl_02nl': 'Lucknow',
  'loc979d1d9aca154ae0a5d72fc1a199aece': 'Seller',
  'na': 'Seller'
};

const normalize = v =>
  String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

const resolveFC = raw => FC_MAP[normalize(raw)] || null;

/* ================= FILE UPLOAD WIRING (CRITICAL) ================= */
document.addEventListener('DOMContentLoaded', () => {
  const inputs = document.querySelectorAll('input[type="file"]');

  inputs.forEach((input, idx) => {
    input.addEventListener('change', () => {
      if (!input.files || !input.files[0]) return;

      STATE.files[idx] = input.files[0];

      const status = input.closest('.file-row')?.querySelector('.status');
      if (status) {
        status.textContent = 'Uploaded';
        status.classList.remove('text-muted');
        status.classList.add('text-success');
      }
    });
  });

  document.getElementById('generateBtn').addEventListener('click', runEngine);
});

/* ================= FILE READER ================= */
function readFile(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      if (file.name.endsWith('.csv')) {
        resolve(Papa.parse(e.target.result, { header: true }).data);
      } else {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        resolve(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
      }
    };
    file.name.endsWith('.csv')
      ? reader.readAsText(file)
      : reader.readAsBinaryString(file);
  });
}

/* ================= PROGRESS ================= */
function setProgress(p) {
  const bar = document.querySelector('.progress-bar');
  bar.style.width = p + '%';
  bar.textContent = p + '%';
}

/* ================= CORE ENGINE ================= */
async function runEngine() {
  if (Object.keys(STATE.files).length !== 4) {
    alert('Please upload all 4 files');
    return;
  }

  setProgress(10);

  const [sales, fbf] = await Promise.all([
    readFile(STATE.files[0]),
    readFile(STATE.files[1])
  ]);

  setProgress(40);

  /* ---------- FC SALE SUMMARY ---------- */
  const fcSaleSummary = {};
  sales.forEach(r => {
    const fc = resolveFC(r['Location Id']);
    if (!fc) return;
    const qty = +r['Gross Units'] || 0;
    fcSaleSummary[fc] = (fcSaleSummary[fc] || 0) + qty;
    STATE.fcLabels[fc] = fc;
  });

  /* ---------- FC STOCK SUMMARY ---------- */
  const fcStockSummary = {};
  fbf.forEach(r => {
    const fc = resolveFC(r['Warehouse Id']);
    if (!fc) return;
    const qty = +r['Live on Website'] || 0;
    fcStockSummary[fc] = (fcStockSummary[fc] || 0) + qty;
    STATE.fcLabels[fc] = fc;
  });

  STATE.fcSaleSummary = fcSaleSummary;
  STATE.fcStockSummary = fcStockSummary;

  setProgress(70);

  renderFCSummary();
  renderFCSaleSummary();

  setProgress(100);
}

/* ================= FC PERFORMANCE SUMMARY ================= */
function renderFCSummary() {
  let rows = Object.keys(STATE.fcLabels).map(fc => {
    const sale = STATE.fcSaleSummary[fc] || 0;
    const stock = STATE.fcStockSummary[fc] || 0;
    const drr = sale ? sale / 30 : 0;
    const sc = drr ? stock / drr : 0;

    return { fc, stock, drr, sc };
  });

  rows.sort((a, b) => {
    if (a.fc === 'Seller') return 1;
    if (b.fc === 'Seller') return -1;
    return b.stock - a.stock;
  });

  let html = `
    <h3>FC Performance Summary</h3>
    <table class="zebra center">
      <tr>
        <th>FC</th>
        <th>FC Stock</th>
        <th>DRR</th>
        <th>SC</th>
      </tr>`;

  rows.forEach(r => {
    html += `
      <tr>
        <td>${r.fc}</td>
        <td>${r.stock}</td>
        <td>${r.drr.toFixed(2)}</td>
        <td>${r.sc.toFixed(1)}</td>
      </tr>`;
  });

  html += '</table>';

  document.querySelectorAll('.summary-grid .card')[0].innerHTML = html;
}

/* ================= FC WISE SALE IN 30D ================= */
function renderFCSaleSummary() {
  let html = `
    <h3>FC wise Sale in 30D</h3>
    <table class="zebra center">
      <tr>
        <th>FC</th>
        <th>30D Sale</th>
        <th>Sale Through %</th>
      </tr>`;

  Object.keys(STATE.fcLabels).forEach(fc => {
    const sale = STATE.fcSaleSummary[fc] || 0;
    const stock = STATE.fcStockSummary[fc] || 0;
    const pct = sale + stock ? (sale / (sale + stock)) * 100 : 0;

    html += `
      <tr>
        <td>${fc}</td>
        <td>${sale}</td>
        <td>${pct.toFixed(1)}%</td>
      </tr>`;
  });

  html += '</table>';

  document.querySelectorAll('.summary-grid .card')[1].innerHTML = html;
}
