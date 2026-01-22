/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   VERSION: V1.7 (EXPLICIT FC MAPPING)
   UI VERSION: V1.1 (LOCKED)
====================================================== */

console.log('LOGIC V1.7 LOADED');

/* ================= FC MASTER MAP ================= */
const FC_MAP = {
  'ulub_bts':              { key: 'kolkata',   label: 'Kolkata' },
  'kolkata_uluberia_bts':  { key: 'kolkata',   label: 'Kolkata' },

  'malur_bts':             { key: 'bangalore', label: 'Bangalore' },
  'malur_bts_warehouse':   { key: 'bangalore', label: 'Bangalore' },

  'bhi_vas_wh_nl_01nl':    { key: 'mumbai',    label: 'Mumbai' },
  'bhiwandi_bts':          { key: 'mumbai',    label: 'Mumbai' },

  'gur_san_wh_nl_01nl':    { key: 'sanpka',    label: 'Sanpka' },
  'sanpka_01':             { key: 'sanpka',    label: 'Sanpka' },

  'hyderabad_medchal_01':  { key: 'hyderabad', label: 'Hyderabad' },
  'luc_has_wh_nl_02nl':    { key: 'lucknow',   label: 'Lucknow' },

  'loc979d1d9aca154ae0a5d72fc1a199aece': { key: 'seller', label: 'Seller' },
  'na':                    { key: 'seller',   label: 'Seller' }
};

function normalizeRaw(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function resolveFC(raw) {
  const n = normalizeRaw(raw);
  return FC_MAP[n] || null;
}

/* ================= GLOBAL STATE ================= */
const STATE = {
  config: {},
  files: {},
  results: {},
  fcSaleSummary: {},
  fcLabels: {}
};

/* ================= ELEMENTS ================= */
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

  /* ---------- SALE MAP + FC SALE SUMMARY ---------- */
  const saleMap = {};
  const fcSaleSummary = {};

  sales.forEach(r => {
    const fcObj = resolveFC(r['Location Id']);
    if (!fcObj) return;

    STATE.fcLabels[fcObj.key] = fcObj.label;

    const sku = r['SKU ID'];
    const qty = +r['Gross Units'] || 0;
    const key = `${sku}|${fcObj.key}`;

    saleMap[key] = (saleMap[key] || 0) + qty;
    fcSaleSummary[fcObj.key] = (fcSaleSummary[fcObj.key] || 0) + qty;
  });

  STATE.fcSaleSummary = fcSaleSummary;

  /* ---------- FBF STOCK ---------- */
  const fbfMap = {};
  fbf.forEach(r => {
    const fcObj = resolveFC(r['Warehouse Id']);
    if (!fcObj) return;

    STATE.fcLabels[fcObj.key] = fcObj.label;

    if (+r['Live on Website'] > 0) {
      fbfMap[`${r['SKU']}|${fcObj.key}`] = +r['Live on Website'];
    }
  });

  /* ---------- FK ASK ---------- */
  const fkAskMap = {};
  fcAsk.forEach(r => {
    const fcObj = resolveFC(r['FC']);
    if (!fcObj) return;

    STATE.fcLabels[fcObj.key] = fcObj.label;

    fkAskMap[`${r['SKU Id']}|${fcObj.key}`] =
      +r['Quantity Sent'] || 0;
  });

  setProgress(60);

  /* ---------- FULL SKU–FC UNIVERSE ---------- */
  const universe = new Set([
    ...Object.keys(saleMap),
    ...Object.keys(fbfMap),
    ...Object.keys(fkAskMap)
  ]);

  const fcResults = {};

  universe.forEach(key => {
    const [sku, fcKey] = key.split('|');

    const sale30 = saleMap[key] || 0;
    const fcStock = fbfMap[key] || 0;
    const fkAsk = fkAskMap[key] || 0;

    let sent = 0, remark = '', drr = '-', fcSC = '-';

    if (sale30 === 0) {
      remark = 'No Sale in last 30D';
    } else {
      drr = sale30 / 30;
      fcSC = (fcStock / drr).toFixed(1);

      if (+fcSC >= STATE.config.targetSC) {
        remark = 'Already sufficient SC';
      } else if (fkAsk === 0) {
        remark = 'FK Ask not available';
      } else if ((uniStock[sku] || 0) < STATE.config.minUniware) {
        remark = 'Uniware stock below threshold';
      } else {
        let need = drr * STATE.config.targetSC - fcStock;
        need = Math.min(need, fkAsk, uniStock[sku] - STATE.config.minUniware);

        if (need >= STATE.config.minUniware) {
          sent = Math.floor(need);
          uniStock[sku] -= sent;
        } else {
          remark = 'Uniware stock below threshold';
        }
      }
    }

    if (!fcResults[fcKey]) fcResults[fcKey] = [];
    fcResults[fcKey].push({
      'MP SKU': sku,
      '30D Sale': sale30,
      'FC Stock': fcStock,
      'FC DRR': drr === '-' ? '-' : drr.toFixed(2),
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
  let html = `<h3>FC Performance Summary</h3>
  <table class="zebra center">
    <tr><th>FC</th><th>SKUs</th><th>Total Sent</th></tr>`;

  Object.keys(STATE.results).forEach(fcKey => {
    const rows = STATE.results[fcKey];
    const totalSent = rows.reduce((s, r) => s + r['Sent Qty'], 0);
    html += `<tr>
      <td>${STATE.fcLabels[fcKey]}</td>
      <td>${rows.length}</td>
      <td>${totalSent}</td>
    </tr>`;
  });

  fcSummaryBox.innerHTML = html + '</table>';
}

function renderFCSaleSummary() {
  let html = `<h3>FC wise Sale in 30D</h3>
  <table class="zebra center">
    <tr><th>FC</th><th>Total Units Sold</th></tr>`;

  Object.keys(STATE.fcSaleSummary).forEach(fcKey => {
    html += `<tr>
      <td>${STATE.fcLabels[fcKey]}</td>
      <td>${STATE.fcSaleSummary[fcKey]}</td>
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

/* ================= GENERATE ================= */
generateBtn.onclick = () => {
  if (Object.keys(STATE.files).length !== 4) {
    alert('Please upload all 4 files');
    return;
  }
  runEngine();
};
