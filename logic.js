/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   VERSION: V1.6 (FULL FC NORMALIZATION)
   UI VERSION: V1.1 (LOCKED)
====================================================== */

console.log('LOGIC V1.6 LOADED');

const STATE = {
  config: {},
  files: {},
  results: {},
  fcSaleSummary: {}
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
function normalizeFC(v) {
  return String(v || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

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

  /* ---------- UNIWARE STOCK (SKU LEVEL) ---------- */
  const uniStock = {};
  uniware.forEach(r => {
    uniStock[r['Sku Code']] = +r['Available (ATP)'] || 0;
  });

  /* ---------- 30D SALE MAP + FC SUMMARY ---------- */
  const saleMap = {};
  const fcSaleSummary = {};

  sales.forEach(r => {
    const sku = r['SKU ID'];
    const fc = normalizeFC(r['Location Id']);
    const qty = +r['Gross Units'] || 0;

    const key = `${sku}|${fc}`;
    saleMap[key] = (saleMap[key] || 0) + qty;
    fcSaleSummary[fc] = (fcSaleSummary[fc] || 0) + qty;
  });

  STATE.fcSaleSummary = fcSaleSummary;

  /* ---------- FBF STOCK MAP ---------- */
  const fbfMap = {};
  fbf.forEach(r => {
    if (+r['Live on Website'] > 0) {
      const sku = r['SKU'];
      const fc = normalizeFC(r['Warehouse Id']);
      fbfMap[`${sku}|${fc}`] = +r['Live on Website'];
    }
  });

  /* ---------- FK ASK MAP ---------- */
  const fkAskMap = {};
  fcAsk.forEach(r => {
    const sku = r['SKU Id'];
    const fc = normalizeFC(r['FC']);
    fkAskMap[`${sku}|${fc}`] = +r['Quantity Sent'] || 0;
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
    const [sku, fc] = key.split('|');

    const sale30 = saleMap[key] || 0;
    const fcStock = fbfMap[key] || 0;
    const fkAsk = fkAskMap[key] || 0;

    let sent = 0;
    let remark = '';
    let drr = '-';
    let fcSC = '-';

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

    if (!fcResults[fc]) fcResults[fc] = [];
    fcResults[fc].push({
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

  Object.keys(STATE.results).forEach(fc => {
    const rows = STATE.results[fc];
    const totalSent = rows.reduce((s, r) => s + r['Sent Qty'], 0);
    html += `<tr><td>${fc}</td><td>${rows.length}</td><td>${totalSent}</td></tr>`;
  });

  fcSummaryBox.innerHTML = html + '</table>';
}

function renderFCSaleSummary() {
  let html = `<h3>FC wise Sale in 30D</h3>
  <table class="zebra center">
    <tr><th>FC</th><th>Total Units Sold</th></tr>`;

  Object.keys(STATE.fcSaleSummary).forEach(fc => {
    html += `<tr><td>${fc}</td><td>${STATE.fcSaleSummary[fc]}</td></tr>`;
  });

  fcSaleBox.innerHTML = html + '</table>';
}

function renderTabs() {
  tabsContainer.innerHTML = '';
  const fcs = Object.keys(STATE.results);

  fcs.forEach((fc, idx) => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (idx === 0 ? ' active' : '');
    btn.textContent = fc;
    btn.onclick = () => showTab(fc, btn);
    tabsContainer.appendChild(btn);
  });

  showTab(fcs[0], tabsContainer.children[0]);
}

function showTab(fc, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const rows = STATE.results[fc];
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
