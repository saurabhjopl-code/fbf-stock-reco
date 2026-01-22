/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   VERSION: V2.1 (FC SUMMARY + UNIWARE FIX)
   BASE: V2.0 STABLE
   UI: LOCKED
====================================================== */

console.log('LOGIC V2.1 LOADED');

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

function normalizeRaw(v) {
  return String(v || '').toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function resolveFC(raw) {
  return FC_MAP[normalizeRaw(raw)] || null;
}

/* ================= STATE ================= */
const STATE = {
  config: {},
  files: {},
  results: {},
  fcSaleSummary: {},
  fcLabels: {},
  fcStockSummary: {},
  uniStockMaster: {}
};

/* ================= ELEMENTS (LOCKED) ================= */
const progressBar = document.querySelector('.progress-bar');
const generateBtn = document.querySelector('.action-bar .btn-primary');
const exportBtn = document.querySelector('.action-bar .btn-secondary');

const fcSummaryBox = document.querySelectorAll('.summary-grid .card')[0];
const fcSaleBox = document.querySelectorAll('.summary-grid .card')[1];
const tabsContainer = document.querySelector('.tabs');
const tabContent = document.querySelector('.tab-content');

/* ================= HELPERS ================= */
function setProgress(p) {
  progressBar.style.width = p + '%';
  progressBar.textContent = p + '%';
}

function readConfig() {
  STATE.config = {
    targetSC: +cfgTargetSC.value,
    minUniware: +cfgMinUni.value,
    maxReturn: +cfgMaxReturn.value
  };
}

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

/* ================= FILE UPLOAD (LOCKED) ================= */
document.querySelectorAll('#fileSection .file-row').forEach((row, i) => {
  const input = row.querySelector('input');
  const status = row.querySelector('.status');
  input.onchange = () => {
    STATE.files[i] = input.files[0];
    status.textContent = 'Uploaded';
    status.style.color = '#16a34a';
  };
});

/* ================= CORE ENGINE ================= */
async function runEngine() {
  readConfig();
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
  uniware.forEach(r => {
    uniStock[r['Sku Code']] = +r['Available (ATP)'] || 0;
  });
  STATE.uniStockMaster = { ...uniStock };

  /* ---------- MASTER SKU → UNIWARE MAP ---------- */
  const skuToUni = {};

  // Priority 1: FC Ask
  fcAsk.forEach(r => {
    if (r['SKU Id'] && r['Uniware SKU']) {
      skuToUni[r['SKU Id']] = r['Uniware SKU'];
    }
  });

  // Priority 2: 30D Sale
  sales.forEach(r => {
    if (r['SKU ID'] && r['Uniware SKU'] && !skuToUni[r['SKU ID']]) {
      skuToUni[r['SKU ID']] = r['Uniware SKU'];
    }
  });

  // Priority 3: FBF Stock
  fbf.forEach(r => {
    if (r['SKU'] && r['Uniware SKU'] && !skuToUni[r['SKU']]) {
      skuToUni[r['SKU']] = r['Uniware SKU'];
    }
  });

  /* ---------- FK ASK ---------- */
  const fkAskMap = {};
  fcAsk.forEach(r => {
    const fc = resolveFC(r['FC']);
    if (!fc) return;
    fkAskMap[`${r['SKU Id']}|${fc.key}`] = +r['Quantity Sent'] || 0;
    STATE.fcLabels[fc.key] = fc.label;
  });

  /* ---------- SALES ---------- */
  const saleMap = {};
  const fcSaleSummary = {};
  sales.forEach(r => {
    const fc = resolveFC(r['Location Id']);
    if (!fc) return;
    const key = `${r['SKU ID']}|${fc.key}`;
    const qty = +r['Gross Units'] || 0;
    saleMap[key] = (saleMap[key] || 0) + qty;
    fcSaleSummary[fc.key] = (fcSaleSummary[fc.key] || 0) + qty;
    STATE.fcLabels[fc.key] = fc.label;
  });
  STATE.fcSaleSummary = fcSaleSummary;

  /* ---------- FBF STOCK ---------- */
  const fbfMap = {};
  const fcStockSummary = {};
  fbf.forEach(r => {
    const fc = resolveFC(r['Warehouse Id']);
    if (!fc) return;
    const qty = +r['Live on Website'] || 0;
    fbfMap[`${r['SKU']}|${fc.key}`] = qty;
    fcStockSummary[fc.key] = (fcStockSummary[fc.key] || 0) + qty;
    STATE.fcLabels[fc.key] = fc.label;
  });
  STATE.fcStockSummary = fcStockSummary;

  setProgress(60);

  /* ---------- BUILD RESULTS (UNCHANGED ALLOCATION) ---------- */
  const universe = new Set([
    ...Object.keys(saleMap),
    ...Object.keys(fbfMap),
    ...Object.keys(fkAskMap)
  ]);

  const fcResults = {};

  universe.forEach(key => {
    const [mpSku, fcKey] = key.split('|');
    const uniSku = skuToUni[mpSku] || '';
    const sale30 = saleMap[key] || 0;
    const fcStock = fbfMap[key] || 0;
    const fkAsk = fkAskMap[key] || 0;

    let sent = 0, remark = '', drr = '-', fcSC = '-';

    if (sale30 === 0) {
      remark = 'No Sale in last 30D';
    } else {
      drr = sale30 / 30;
      fcSC = (fcStock / drr).toFixed(2);

      if (+fcSC >= STATE.config.targetSC) {
        remark = 'Already sufficient SC';
      } else if (fkAsk === 0) {
        remark = 'FK Ask not available';
      } else if (!uniSku || (uniStock[uniSku] || 0) < STATE.config.minUniware) {
        remark = 'Uniware stock below threshold';
      } else {
        let need = drr * STATE.config.targetSC - fcStock;
        need = Math.min(need, fkAsk, uniStock[uniSku] - STATE.config.minUniware);
        if (need >= STATE.config.minUniware) {
          sent = Math.floor(need);
          uniStock[uniSku] -= sent;
        } else {
          remark = 'Uniware stock below threshold';
        }
      }
    }

    if (!fcResults[fcKey]) fcResults[fcKey] = [];
    fcResults[fcKey].push({
      'MP SKU': mpSku,
      'Uniware SKU': uniSku,
      'Uniware Stock': STATE.uniStockMaster[uniSku] || 0,
      '30D Sale': sale30,
      'FC Stock': fcStock,
      'FC DRR': drr === '-' ? '-' : drr.toFixed(3),
      'FC SC': fcSC,
      'FK Ask': fkAsk,
      'Sent Qty': sent,
      'Remarks': sent ? '' : remark
    });
  });

  STATE.results = fcResults;

  renderFCSummary();
  renderFCSaleSummary();
  renderTabs();

  setProgress(100);
  exportBtn.disabled = false;
}

/* ================= RENDERING ================= */
function renderFCSummary() {
  const sellerStock = STATE.fcStockSummary['seller'] || 0;

  let rows = Object.keys(STATE.fcStockSummary)
    .filter(fc => fc !== 'seller')
    .map(fc => {
      const sale = STATE.fcSaleSummary[fc] || 0;
      const stock = STATE.fcStockSummary[fc] || 0;
      const drr = sale / 30;
      const sc = drr ? stock / drr : 0;
      const stockPct = stock + sellerStock
        ? (stock / (stock + sellerStock)) * 100
        : 0;
      return { fc, sale, stock, drr, sc, stockPct };
    })
    .sort((a, b) => b.stock - a.stock);

  let html = `<h3>FC Performance Summary</h3>
  <table class="zebra center">
    <tr>
      <th>FC</th>
      <th>FC Stock</th>
      <th>DRR</th>
      <th>SC</th>
      <th>Stock %</th>
    </tr>`;

  rows.forEach(r => {
    html += `<tr>
      <td>${STATE.fcLabels[r.fc]}</td>
      <td>${r.stock}</td>
      <td>${r.drr.toFixed(2)}</td>
      <td>${r.sc.toFixed(1)}</td>
      <td>${r.stockPct.toFixed(1)}%</td>
    </tr>`;
  });

  if (STATE.fcLabels['seller']) {
    html += `<tr>
      <td>Seller</td>
      <td>${sellerStock}</td>
      <td>-</td><td>-</td><td>-</td>
    </tr>`;
  }

  fcSummaryBox.innerHTML = html + '</table>';
}

function renderFCSaleSummary() {
  const totalSale = Object.values(STATE.fcSaleSummary)
    .reduce((s, v) => s + v, 0);

  let html = `<h3>FC wise Sale in 30D</h3>
  <table class="zebra center">
    <tr>
      <th>FC</th>
      <th>Total Units Sold</th>
      <th>Sale through %</th>
    </tr>`;

  Object.keys(STATE.fcSaleSummary).forEach(fc => {
    const sale = STATE.fcSaleSummary[fc];
    const pct = totalSale ? (sale / totalSale) * 100 : 0;
    html += `<tr>
      <td>${STATE.fcLabels[fc]}</td>
      <td>${sale}</td>
      <td>${pct.toFixed(1)}%</td>
    </tr>`;
  });

  fcSaleBox.innerHTML = html + '</table>';
}

function renderTabs() {
  tabsContainer.innerHTML = '';
  const fcs = Object.keys(STATE.results);

  fcs.forEach((fcKey, idx) => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (idx === 0 ? ' active' : '');
    btn.textContent = STATE.fcLabels[fcKey];
    btn.onclick = () => showTab(fcKey, btn);
    tabsContainer.appendChild(btn);
  });

  showTab(fcs[0], tabsContainer.children[0]);
}

function showTab(fcKey, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const rows = STATE.results[fcKey];
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

/* ================= GENERATE (LOCKED) ================= */
generateBtn.onclick = () => {
  if (Object.keys(STATE.files).length !== 4) {
    alert('Please upload all 4 files');
    return;
  }
  runEngine();
};
