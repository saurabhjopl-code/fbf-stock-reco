/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   SINGLE SOURCE OF TRUTH
   UI LOCKED – DO NOT TOUCH
====================================================== */

console.log('logic.js loaded');

/* ================= GLOBAL STATE ================= */
const STATE = {
  files: {},
  config: {
    targetSC: 30,
    minUniware: 10
  },
  saleMap: {},           // sku|fc -> qty
  fcSaleSummary: {},     // fc -> qty
  fcStockSummary: {},    // fc -> qty
  uniStock: {},          // uniSku -> qty
  fkAskMap: {},          // sku|fc -> ask
  skuUniMap: {},         // mpSku -> uniSku
  fcResults: {},         // fc -> rows[]
  fcMetrics: {}          // fc -> { drr, sc }
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
  String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_');

const resolveFC = raw => FC_MAP[normalize(raw)] || null;

/* ================= FILE UPLOAD (DO NOT TOUCH) ================= */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[type="file"]').forEach((input, idx) => {
    input.addEventListener('change', () => {
      if (!input.files[0]) return;
      STATE.files[idx] = input.files[0];
      const status = input.closest('.file-row')?.querySelector('.status');
      if (status) {
        status.textContent = 'Uploaded';
        status.style.color = 'green';
      }
    });
  });

  document.getElementById('generateBtn').addEventListener('click', runEngine);
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
  bar.style.width = p + '%';
  bar.textContent = p + '%';
}

/* ================= CORE ENGINE ================= */
async function runEngine() {
  if (Object.keys(STATE.files).length !== 4) {
    alert('Upload all 4 files');
    return;
  }

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

  /* ---------- FK ASK ---------- */
  fcAsk.forEach(r => {
    const fc = resolveFC(r['FC']);
    if (!fc) return;
    const sku = r['SKU Id'];
    const uni = r['Uniware SKU'];
    STATE.skuUniMap[sku] = uni;
    STATE.fkAskMap[`${sku}|${fc}`] = +r['Quantity Sent'] || 0;
  });

  /* ---------- SALES ---------- */
  sales.forEach(r => {
    const fc = resolveFC(r['Location Id']);
    if (!fc) return;
    const sku = r['SKU ID'];
    const qty = +r['Gross Units'] || 0;

    const key = `${sku}|${fc}`;
    STATE.saleMap[key] = (STATE.saleMap[key] || 0) + qty;
    STATE.fcSaleSummary[fc] = (STATE.fcSaleSummary[fc] || 0) + qty;
  });

  /* ---------- FBF STOCK ---------- */
  fbf.forEach(r => {
    const fc = resolveFC(r['Warehouse Id']);
    if (!fc) return;
    const qty = +r['Live on Website'] || 0;
    STATE.fcStockSummary[fc] = (STATE.fcStockSummary[fc] || 0) + qty;
  });

  setProgress(60);

  buildFCResults();
  sortTabs();
  renderAllTabs();

  setProgress(100);
}

/* ================= FC + SELLER LOGIC ================= */
function buildFCResults() {
  STATE.fcResults = {};

  const allKeys = new Set([
    ...Object.keys(STATE.saleMap),
    ...Object.keys(STATE.fkAskMap)
  ]);

  allKeys.forEach(key => {
    const [sku, fc] = key.split('|');
    if (!STATE.fcResults[fc]) STATE.fcResults[fc] = [];

    const sale = STATE.saleMap[key] || 0;
    const stock = fc === 'Seller' ? 0 : 0;
    const drr = sale ? sale / 30 : 0;
    const sc = drr ? stock / drr : 0;
    const fkAsk = STATE.fkAskMap[key] || 0;

    let sent = 0;
    let remark = '';

    if (sale === 0) remark = 'No Sale in last 30D';
    else if (fkAsk === 0) remark = 'FK Ask not available';

    STATE.fcResults[fc].push({
      'MP SKU': sku,
      '30D Sale': sale,
      'FC Stock': stock,
      'FC DRR': drr ? drr.toFixed(3) : '-',
      'FC SC': sc ? sc.toFixed(2) : '-',
      'FK Ask': fkAsk,
      'Sent Qty': sent,
      'Remarks': remark
    });
  });

  /* ---------- FC METRICS ---------- */
  Object.keys(STATE.fcResults).forEach(fc => {
    if (fc === 'Seller') return;
    const sale = STATE.fcSaleSummary[fc] || 0;
    const stock = STATE.fcStockSummary[fc] || 0;
    const drr = sale ? sale / 30 : 0;
    const sc = drr ? stock / drr : 0;
    STATE.fcMetrics[fc] = { drr, sc };
  });
}

/* ================= TAB SORTING ================= */
function sortTabs() {
  const container = document.querySelector('.tabs');
  const tabs = [...container.children];

  tabs.sort((a, b) => {
    const fa = a.textContent.trim();
    const fb = b.textContent.trim();

    if (fa === 'Seller') return 1;
    if (fb === 'Seller') return -1;

    const ma = STATE.fcMetrics[fa] || { drr: 0, sc: Infinity };
    const mb = STATE.fcMetrics[fb] || { drr: 0, sc: Infinity };

    if (mb.drr !== ma.drr) return mb.drr - ma.drr;
    return ma.sc - mb.sc;
  });

  tabs.forEach(t => container.appendChild(t));
}

/* ================= RENDER ================= */
function renderAllTabs() {
  Object.keys(STATE.fcResults).forEach(fc => {
    renderTab(fc, STATE.fcResults[fc]);
  });
}

function renderTab(fc, rows) {
  const tabContent = document.querySelector(`#tab-${fc}`);
  if (!tabContent) return;

  let html = `<table class="zebra center"><tr>`;
  Object.keys(rows[0]).forEach(h => html += `<th>${h}</th>`);
  html += `</tr>`;

  rows.forEach(r => {
    html += `<tr>`;
    Object.values(r).forEach(v => html += `<td>${v}</td>`);
    html += `</tr>`;
  });

  tabContent.innerHTML = html + '</table>';
}
