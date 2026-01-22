/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   VERSION: V1.2 (Result Rendering)
   BASE VERSION: V1.1 (LOCKED)
====================================================== */

const STATE = {
  config: {
    targetSC: 30,
    minUniware: 10,
    maxReturn: 30
  },
  files: {},
  results: {}
};

/* ===============================
   ELEMENT REFERENCES
================================ */
const progressBar = document.querySelector('.progress-bar');
const generateBtn = document.querySelector('.btn-primary');
const exportBtn = document.querySelector('.btn-secondary');

const cfgTargetSC = document.getElementById('cfgTargetSC');
const cfgMinUni = document.getElementById('cfgMinUni');
const cfgMaxReturn = document.getElementById('cfgMaxReturn');

const fcSummaryBox = document.querySelectorAll('.summary-grid .card')[0];
const topSkuBox = document.querySelectorAll('.summary-grid .card')[1];
const tabsContainer = document.querySelector('.tabs');
const tabContent = document.querySelector('.tab-content');

/* ===============================
   PROGRESS
================================ */
function setProgress(p) {
  progressBar.style.width = p + '%';
  progressBar.textContent = p + '%';
}

/* ===============================
   CONFIG
================================ */
function readConfig() {
  STATE.config.targetSC = Number(cfgTargetSC.value);
  STATE.config.minUniware = Number(cfgMinUni.value);
  STATE.config.maxReturn = Number(cfgMaxReturn.value);
}

/* ===============================
   FILE HANDLING (LOCKED)
================================ */
document
  .querySelectorAll('#fileSection .file-row')
  .forEach((row, index) => {
    const input = row.querySelector('input[type="file"]');
    const status = row.querySelector('.status');

    input.addEventListener('change', () => {
      if (!input.files.length) return;
      STATE.files[index] = input.files[0];
      status.textContent = 'Uploaded';
      status.style.color = '#16a34a';
      status.title = input.files[0].name;
    });
  });

/* ===============================
   FILE READERS
================================ */
function readFile(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      if (file.name.endsWith('.csv')) {
        resolve(Papa.parse(e.target.result, { header: true }).data);
      } else {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws));
      }
    };
    file.name.endsWith('.csv')
      ? reader.readAsText(file)
      : reader.readAsBinaryString(file);
  });
}

/* ===============================
   CORE ENGINE (UNCHANGED)
================================ */
async function runEngine() {
  setProgress(10);

  const [sales, fbf, uniware, fcAsk] = await Promise.all([
    readFile(STATE.files[0]),
    readFile(STATE.files[1]),
    readFile(STATE.files[2]),
    readFile(STATE.files[3])
  ]);

  setProgress(25);

  const uniStock = {};
  uniware.forEach(r => {
    uniStock[r['Sku Code']] = +r['Available (ATP)'] || 0;
  });

  const saleMap = {};
  sales.forEach(r => {
    const k = `${r['SKU ID']}|${r['Location Id']}`;
    if (!saleMap[k]) saleMap[k] = { gross: 0, ret: 0 };
    saleMap[k].gross += +r['Gross Units'] || 0;
    saleMap[k].ret += +r['Return Units'] || 0;
  });

  const fbfMap = {};
  fbf.forEach(r => {
    if (+r['Live on Website'] > 0) {
      fbfMap[`${r['SKU']}|${r['Warehouse Id']}`] =
        +r['Live on Website'];
    }
  });

  setProgress(50);

  const items = [];
  fcAsk.forEach(r => {
    const sku = r['SKU Id'];
    const uniSku = r['Uniware SKU'];
    const fc = r['FC'];
    const fkAsk = +r['Quantity Sent'] || 0;

    const key = `${sku}|${fc}`;
    const gross = saleMap[key]?.gross || 0;
    const ret = saleMap[key]?.ret || 0;
    const fcStock = fbfMap[key] || 0;

    const drr = gross / 30;
    const fcSC = drr ? fcStock / drr : 999;

    items.push({
      sku, uniSku, fc, gross, ret,
      fcStock, drr, fcSC, fkAsk
    });
  });

  items.sort((a, b) => b.drr - a.drr || a.fcSC - b.fcSC);

  setProgress(75);

  const results = {};
  items.forEach(i => {
    if (!results[i.fc]) results[i.fc] = [];
    let sent = 0, remark = '';

    if (i.fcSC < STATE.config.targetSC) {
      let need = i.drr * STATE.config.targetSC - i.fcStock;
      need = Math.min(need, i.fkAsk);
      if (need >= STATE.config.minUniware) sent = Math.floor(need);
      else remark = 'Uniware stock below threshold';
    } else {
      remark = 'Already sufficient SC';
    }

    results[i.fc].push({
      'MP SKU': i.sku,
      '30D Sale': i.gross,
      'FC Stock': i.fcStock,
      'FC DRR': i.drr.toFixed(2),
      'FC SC': i.fcSC.toFixed(1),
      'FK Ask': i.fkAsk,
      'Sent Qty': sent,
      'Remarks': sent ? '' : remark
    });
  });

  STATE.results = results;

  setProgress(100);
  exportBtn.disabled = false;

  renderResults();
}

/* ===============================
   RENDERING
================================ */
function renderResults() {
  renderFCSummary();
  renderTop10();
  renderFCTabs();
}

/* FC PERFORMANCE SUMMARY */
function renderFCSummary() {
  let html = '<h3>FC Performance Summary</h3><table><tr><th>FC</th><th>SKUs</th><th>Total Reco</th></tr>';
  Object.keys(STATE.results).forEach(fc => {
    const rows = STATE.results[fc];
    const total = rows.reduce((s, r) => s + r['Sent Qty'], 0);
    html += `<tr><td>${fc}</td><td>${rows.length}</td><td>${total}</td></tr>`;
  });
  html += '</table>';
  fcSummaryBox.innerHTML = html;
}

/* TOP 10 SKUs */
function renderTop10() {
  const all = [];
  Object.values(STATE.results).forEach(fcRows => {
    fcRows.forEach(r => all.push(r));
  });

  all.sort((a, b) => b['30D Sale'] - a['30D Sale']);

  let html = '<h3>Top 10 Selling SKUs</h3><table><tr><th>SKU</th><th>30D Sale</th><th>Sent Qty</th></tr>';
  all.slice(0, 10).forEach(r => {
    html += `<tr><td>${r['MP SKU']}</td><td>${r['30D Sale']}</td><td>${r['Sent Qty']}</td></tr>`;
  });
  html += '</table>';
  topSkuBox.innerHTML = html;
}

/* FC TABS */
function renderFCTabs() {
  tabsContainer.innerHTML = '';
  const fcs = Object.keys(STATE.results);

  fcs.forEach((fc, idx) => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (idx === 0 ? ' active' : '');
    btn.textContent = fc;
    btn.onclick = () => showFCTab(fc, btn);
    tabsContainer.appendChild(btn);
  });

  showFCTab(fcs[0], tabsContainer.children[0]);
}

function showFCTab(fc, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');

  const rows = STATE.results[fc];
  let html = '<table><tr>';
  Object.keys(rows[0]).forEach(h => html += `<th>${h}</th>`);
  html += '</tr>';

  rows.forEach(r => {
    html += '<tr>';
    Object.values(r).forEach(v => html += `<td>${v}</td>`);
    html += '</tr>';
  });

  html += '</table>';
  tabContent.innerHTML = html;
}

/* ===============================
   GENERATE
================================ */
generateBtn.addEventListener('click', () => {
  if (Object.keys(STATE.files).length !== 4) {
    alert('Please upload all 4 required files.');
    return;
  }
  readConfig();
  runEngine();
});
