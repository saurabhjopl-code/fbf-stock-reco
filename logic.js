/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   FORWARD-ONLY EXTENSION
   BASELINE VERIFIED WORKING
====================================================== */

console.log('LOGIC EXTENDED – SAFE MODE');

/* ================= FC MASTER ================= */
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

const normalize = v =>
  String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');

const resolveFC = raw => FC_MAP[normalize(raw)] || null;

/* ================= STATE ================= */
const STATE = {
  files: {},
  config: {},
  saleMap: {},
  fcSale: {},
  fcStock: {},
  fcMetrics: {},
  fkAsk: {},
  skuUni: {},
  uniStock: {},
  results: {}
};

/* ================= FILE UPLOAD (FROZEN) ================= */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#fileSection .file-row').forEach((row, i) => {
    const input = row.querySelector('input');
    const status = row.querySelector('.status');
    input.onchange = () => {
      STATE.files[i] = input.files[0];
      status.textContent = 'Uploaded';
      status.style.color = '#16a34a';
    };
  });

  document.querySelector('.action-bar .btn-primary').onclick = runEngine;
});

/* ================= FILE READER ================= */
function readFile(file) {
  return new Promise(resolve => {
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
}

/* ================= PROGRESS ================= */
function setProgress(p) {
  const bar = document.querySelector('.progress-bar');
  if (!bar) return;
  bar.style.width = p + '%';
  bar.textContent = p + '%';
}

/* ================= CORE ENGINE ================= */
async function runEngine() {
  if (Object.keys(STATE.files).length !== 4) {
    alert('Please upload all 4 files');
    return;
  }

  STATE.saleMap = {};
  STATE.fcSale = {};
  STATE.fcStock = {};
  STATE.fcMetrics = {};
  STATE.fkAsk = {};
  STATE.skuUni = {};
  STATE.uniStock = {};
  STATE.results = {};

  setProgress(10);

  const [sales, fbf, uni, ask] = await Promise.all([
    readFile(STATE.files[0]),
    readFile(STATE.files[1]),
    readFile(STATE.files[2]),
    readFile(STATE.files[3])
  ]);

  setProgress(30);

  /* Uniware */
  uni.forEach(r => {
    STATE.uniStock[r['Sku Code']] = +r['Available (ATP)'] || 0;
  });

  /* FK Ask */
  ask.forEach(r => {
    const fc = resolveFC(r['FC']);
    if (!fc) return;
    STATE.skuUni[r['SKU Id']] = r['Uniware SKU'];
    STATE.fkAsk[`${r['SKU Id']}|${fc.key}`] = +r['Quantity Sent'] || 0;
  });

  /* Sales */
  sales.forEach(r => {
    const fc = resolveFC(r['Location Id']);
    if (!fc) return;
    const key = `${r['SKU ID']}|${fc.key}`;
    const q = +r['Gross Units'] || 0;
    STATE.saleMap[key] = (STATE.saleMap[key] || 0) + q;
    STATE.fcSale[fc.key] = (STATE.fcSale[fc.key] || 0) + q;
  });

  /* FC Stock */
  fbf.forEach(r => {
    const fc = resolveFC(r['Warehouse Id']);
    if (!fc) return;
    STATE.fcStock[fc.key] = (STATE.fcStock[fc.key] || 0) + (+r['Live on Website'] || 0);
  });

  /* FC Metrics */
  Object.keys(STATE.fcSale).forEach(fc => {
    const sale = STATE.fcSale[fc];
    const stock = STATE.fcStock[fc] || 0;
    const drr = sale / 30;
    const sc = drr ? stock / drr : Infinity;
    STATE.fcMetrics[fc] = { drr, sc };
  });

  buildResults();
  renderSummary();
  renderTabs();

  setProgress(100);
}

/* ================= RESULT BUILD ================= */
function buildResults() {
  const keys = new Set([
    ...Object.keys(STATE.saleMap),
    ...Object.keys(STATE.fkAsk)
  ]);

  keys.forEach(k => {
    const [sku, fc] = k.split('|');
    if (!STATE.results[fc]) STATE.results[fc] = [];

    const sale = STATE.saleMap[k] || 0;
    const drr = sale ? sale / 30 : '-';
    const stock = STATE.fcStock[fc] || 0;
    const sc = drr !== '-' ? (stock / drr).toFixed(1) : '-';
    const ask = STATE.fkAsk[k] || 0;

    STATE.results[fc].push({
      'MP SKU': sku,
      '30D Sale': sale,
      'FC Stock': fc === 'seller' ? 0 : stock,
      'FC DRR': drr === '-' ? '-' : drr.toFixed(3),
      'FC SC': sc,
      'FK Ask': ask,
      'Sent Qty': 0,
      'Remarks': sale === 0 ? 'No Sale in last 30D' : ''
    });
  });
}

/* ================= SUMMARY ================= */
function renderSummary() {
  /* FC Performance */
  let fcRows = Object.keys(STATE.fcMetrics)
    .filter(f => f !== 'seller')
    .sort((a, b) => {
      if (STATE.fcMetrics[b].drr !== STATE.fcMetrics[a].drr)
        return STATE.fcMetrics[b].drr - STATE.fcMetrics[a].drr;
      return STATE.fcMetrics[a].sc - STATE.fcMetrics[b].sc;
    });

  let html = `<h3>FC Performance Summary</h3>
  <table class="zebra center">
  <tr><th>FC</th><th>FC Stock</th><th>DRR</th><th>SC</th></tr>`;

  fcRows.forEach(fc => {
    html += `<tr>
      <td>${FC_MAP[fc]?.label || fc}</td>
      <td>${STATE.fcStock[fc] || 0}</td>
      <td>${STATE.fcMetrics[fc].drr.toFixed(2)}</td>
      <td>${STATE.fcMetrics[fc].sc.toFixed(1)}</td>
    </tr>`;
  });

  document.querySelectorAll('.summary-grid .card')[0].innerHTML = html + '</table>';

  /* FC Sale Through */
  let html2 = `<h3>FC wise Sale in 30D</h3>
  <table class="zebra center">
  <tr><th>FC</th><th>Sale</th><th>Sale Through %</th></tr>`;

  fcRows.forEach(fc => {
    const sale = STATE.fcSale[fc] || 0;
    const stock = STATE.fcStock[fc] || 0;
    const pct = sale + stock ? (sale / (sale + stock)) * 100 : 0;
    html2 += `<tr>
      <td>${FC_MAP[fc]?.label || fc}</td>
      <td>${sale}</td>
      <td>${pct.toFixed(1)}%</td>
    </tr>`;
  });

  document.querySelectorAll('.summary-grid .card')[1].innerHTML = html2 + '</table>';
}

/* ================= TABS ================= */
function renderTabs() {
  const tabs = document.querySelector('.tabs');
  const content = document.querySelector('.tab-content');
  tabs.innerHTML = '';

  const ordered = Object.keys(STATE.results).sort((a, b) => {
    if (a === 'seller') return 1;
    if (b === 'seller') return -1;
    const ma = STATE.fcMetrics[a] || { drr: 0, sc: Infinity };
    const mb = STATE.fcMetrics[b] || { drr: 0, sc: Infinity };
    if (mb.drr !== ma.drr) return mb.drr - ma.drr;
    return ma.sc - mb.sc;
  });

  ordered.forEach((fc, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (i === 0 ? ' active' : '');
    btn.textContent = FC_MAP[fc]?.label || fc;
    btn.onclick = () => showTab(fc, btn);
    tabs.appendChild(btn);
  });

  showTab(ordered[0], tabs.children[0]);
}

function showTab(fc, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const rows = STATE.results[fc];
  let html = `<table class="zebra center"><tr>`;
  Object.keys(rows[0]).forEach(h => html += `<th>${h}</th>`);
  html += '</tr>';

  rows.forEach(r => {
    html += '<tr>';
    Object.values(r).forEach(v => html += `<td>${v}</td>`);
    html += '</tr>';
  });

  document.querySelector('.tab-content').innerHTML = html + '</table>';
}
