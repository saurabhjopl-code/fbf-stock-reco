/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   VERSION: V1.9 (SELLER VISIBILITY DISTRIBUTION)
   UI VERSION: V1.1 (LOCKED)
====================================================== */

console.log('LOGIC V1.9 LOADED');

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
  fcLabels: {},
  fcStockSummary: {}
};

/* ================= HELPERS ================= */
const setProgress = p => {
  progressBar.style.width = p + '%';
  progressBar.textContent = p + '%';
};

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
  const uniStock = {};
  uniware.forEach(r => uniStock[r['Sku Code']] = +r['Available (ATP)'] || 0);

  /* ---------- FC ASK MAP ---------- */
  const fcAskBySku = {};
  fcAsk.forEach(r => {
    const fc = resolveFC(r['FC']);
    if (!fc) return;

    const mpSku = r['SKU Id'];
    const uniSku = r['Uniware SKU'];
    const qty = +r['Quantity Sent'] || 0;

    if (!fcAskBySku[mpSku]) fcAskBySku[mpSku] = { uniSku, fcs: [] };
    fcAskBySku[mpSku].fcs.push({ fcKey: fc.key, fcLabel: fc.label, ask: qty });
  });

  /* ---------- SALE + FC STOCK ---------- */
  const saleMap = {}, fbfMap = {};
  const fcSaleSummary = {}, fcStockSummary = {};

  sales.forEach(r => {
    const fc = resolveFC(r['Location Id']);
    if (!fc) return;
    const k = `${r['SKU ID']}|${fc.key}`;
    saleMap[k] = (saleMap[k] || 0) + (+r['Gross Units'] || 0);
    fcSaleSummary[fc.key] = (fcSaleSummary[fc.key] || 0) + (+r['Gross Units'] || 0);
    STATE.fcLabels[fc.key] = fc.label;
  });

  fbf.forEach(r => {
    const fc = resolveFC(r['Warehouse Id']);
    if (!fc) return;
    const k = `${r['SKU']}|${fc.key}`;
    const stk = +r['Live on Website'] || 0;
    fbfMap[k] = stk;
    fcStockSummary[fc.key] = (fcStockSummary[fc.key] || 0) + stk;
    STATE.fcLabels[fc.key] = fc.label;
  });

  STATE.fcSaleSummary = fcSaleSummary;
  STATE.fcStockSummary = fcStockSummary;

  setProgress(60);

  /* ================= SELLER DISTRIBUTION ================= */
  const sellerRows = [];

  Object.keys(fcAskBySku).forEach(mpSku => {
    const { uniSku, fcs } = fcAskBySku[mpSku];
    const totalSale = Object.keys(saleMap)
      .filter(k => k.startsWith(mpSku + '|'))
      .reduce((s, k) => s + saleMap[k], 0);

    if (totalSale === 0) {
      sellerRows.push({
        'MP SKU': mpSku,
        'Uniware SKU': uniSku,
        '30D Sale': 0,
        'Uniware Stock': uniStock[uniSku] || 0,
        'Uniware DRR': '-',
        'Uniware SC': '-',
        'FK Ask': fcs.reduce((s, f) => s + f.ask, 0),
        'Sent Qty': 0,
        'Recommended FC': '',
        'Remarks': 'No Sale in last 30D'
      });
      return;
    }

    const drr = totalSale / 30;
    let sendable = Math.max(0, (uniStock[uniSku] || 0) - cfgMinUni.value);

    if (sendable < 3) {
      sellerRows.push({
        'MP SKU': mpSku,
        'Uniware SKU': uniSku,
        '30D Sale': totalSale,
        'Uniware Stock': uniStock[uniSku] || 0,
        'Uniware DRR': drr.toFixed(2),
        'Uniware SC': ((uniStock[uniSku] || 0) / drr).toFixed(1),
        'FK Ask': fcs.reduce((s, f) => s + f.ask, 0),
        'Sent Qty': 0,
        'Recommended FC': '',
        'Remarks': 'Uniware stock below threshold'
      });
      return;
    }

    fcs.sort((a, b) => b.ask - a.ask);

    let maxFCs = sendable >= 10 ? fcs.length : sendable >= 3 ? 2 : 1;
    const selected = fcs.slice(0, maxFCs);

    let remaining = sendable;
    const allocations = [];

    selected.forEach(fc => {
      if (remaining <= 0) return;
      const alloc = Math.min(fc.ask, Math.floor(remaining / selected.length));
      if (alloc > 0) {
        allocations.push(fc.fcLabel);
        remaining -= alloc;
      }
    });

    sellerRows.push({
      'MP SKU': mpSku,
      'Uniware SKU': uniSku,
      '30D Sale': totalSale,
      'Uniware Stock': uniStock[uniSku] || 0,
      'Uniware DRR': drr.toFixed(2),
      'Uniware SC': ((uniStock[uniSku] || 0) / drr).toFixed(1),
      'FK Ask': fcs.reduce((s, f) => s + f.ask, 0),
      'Sent Qty': sendable - remaining,
      'Recommended FC': allocations.join(', '),
      'Remarks': allocations.length ? '' : 'No eligible FC'
    });
  });

  STATE.sellerResults = sellerRows;

  renderSellerTab();
  setProgress(100);
}

/* ================= RENDER SELLER TAB ================= */
function renderSellerTab() {
  let html = `<table class="zebra center"><tr>`;
  Object.keys(STATE.sellerResults[0]).forEach(h => html += `<th>${h}</th>`);
  html += `</tr>`;

  STATE.sellerResults.forEach(r => {
    html += `<tr>`;
    Object.values(r).forEach(v => html += `<td>${v}</td>`);
    html += `</tr>`;
  });

  tabContent.innerHTML = html + '</table>';
}
