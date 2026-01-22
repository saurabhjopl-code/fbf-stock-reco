/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   SAFE FORWARD BUILD – FREEZE FIX
====================================================== */

console.log('LOGIC – SAFE BUILD');

/* ================= FC MASTER ================= */
const FC_MAP = {
  ulub_bts: { key: 'kolkata', label: 'Kolkata' },
  kolkata_uluberia_bts: { key: 'kolkata', label: 'Kolkata' },
  malur_bts: { key: 'bangalore', label: 'Bangalore' },
  malur_bts_warehouse: { key: 'bangalore', label: 'Bangalore' },
  bhi_vas_wh_nl_01nl: { key: 'mumbai', label: 'Mumbai' },
  bhiwandi_bts: { key: 'mumbai', label: 'Mumbai' },
  gur_san_wh_nl_01nl: { key: 'sanpka', label: 'Sanpka' },
  sanpka_01: { key: 'sanpka', label: 'Sanpka' },
  hyderabad_medchal_01: { key: 'hyderabad', label: 'Hyderabad' },
  luc_has_wh_nl_02nl: { key: 'lucknow', label: 'Lucknow' },
  loc979d1d9aca154ae0a5d72fc1a199aece: { key: 'seller', label: 'Seller' },
  na: { key: 'seller', label: 'Seller' }
};

const normalize = v =>
  String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_');

const resolveFC = raw => FC_MAP[normalize(raw)] || null;

/* ================= STATE ================= */
const STATE = {
  files: {},

  saleMap: {},
  fcSale: {},
  fcStockSku: {},
  fcStock: {},
  fkAsk: {},
  skuUni: {},
  uniStock: {},
  fcMetrics: {},
  results: {}
};

/* ================= UPLOAD (LOCKED) ================= */
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

  document.querySelector('.btn-primary').onclick = runEngine;
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

/* ================= ENGINE ================= */
async function runEngine() {
  if (Object.keys(STATE.files).length !== 4) {
    alert('Please upload all 4 files');
    return;
  }

  /* 🔒 SAFE RESET (FILES PRESERVED) */
  STATE.saleMap = {};
  STATE.fcSale = {};
  STATE.fcStockSku = {};
  STATE.fcStock = {};
  STATE.fkAsk = {};
  STATE.skuUni = {};
  STATE.uniStock = {};
  STATE.fcMetrics = {};
  STATE.results = {};

  setProgress(10);

  const [sales, fbf, uni, ask] = await Promise.all([
    readFile(STATE.files[0]),
    readFile(STATE.files[1]),
    readFile(STATE.files[2]),
    readFile(STATE.files[3])
  ]);

  setProgress(30);

  /* Uniware Stock */
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

  /* FBF Stock (SKU LEVEL) */
  fbf.forEach(r => {
    const fc = resolveFC(r['Warehouse Id']);
    if (!fc) return;
    const key = `${r['SKU']}|${fc.key}`;
    const qty = +r['Live on Website'] || 0;
    STATE.fcStockSku[key] = qty;
    STATE.fcStock[fc.key] = (STATE.fcStock[fc.key] || 0) + qty;
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

/* ================= RESULTS ================= */
function buildResults() {
  const keys = new Set([
    ...Object.keys(STATE.saleMap),
    ...Object.keys(STATE.fkAsk),
    ...Object.keys(STATE.fcStockSku)
  ]);

  keys.forEach(k => {
    const [sku, fc] = k.split('|');
    if (!STATE.results[fc]) STATE.results[fc] = [];

    const sale = STATE.saleMap[k] || 0;
    const stock = STATE.fcStockSku[k] || 0;
    const drr = sale ? sale / 30 : '-';
    const sc = drr !== '-' ? (stock / drr).toFixed(1) : '-';
    const ask = STATE.fkAsk[k] || 0;
    const uniSku = STATE.skuUni[sku] || '';
    const uniQty = uniSku ? STATE.uniStock[uniSku] || 0 : 0;

    STATE.results[fc].push({
      'MP SKU': sku,
      ...(fc !== 'seller'
        ? { 'Uniware SKU': uniSku, 'Uniware Stock': uniQty }
        : {}),
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

/* ================= SUMMARY + TABS ================= */
/* (UNCHANGED – already working) */
