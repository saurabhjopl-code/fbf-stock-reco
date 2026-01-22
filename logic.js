/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   VERSION: V1.3 (CALCULATION FIX)
   UI VERSION: V1.1 (LOCKED)
====================================================== */

console.log('LOGIC V1.3 LOADED');

const STATE = {
  config: {},
  files: {},
  results: {},
  sellerResults: []
};

/* ELEMENTS */
const progressBar = document.querySelector('.progress-bar');
const generateBtn = document.querySelector('.action-bar .btn-primary');
const exportBtn = document.querySelector('.action-bar .btn-secondary');

const fcSummaryBox = document.querySelectorAll('.summary-grid .card')[0];
const topSkuBox = document.querySelectorAll('.summary-grid .card')[1];
const tabsContainer = document.querySelector('.tabs');
const tabContent = document.querySelector('.tab-content');

/* HELPERS */
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
        const ws = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(ws));
      }
    };
    file.name.endsWith('.csv')
      ? reader.readAsText(file)
      : reader.readAsBinaryString(file);
  });
}

/* FILE UPLOAD */
document.querySelectorAll('#fileSection .file-row')
  .forEach((row, idx) => {
    const input = row.querySelector('input[type=file]');
    const status = row.querySelector('.status');
    input.addEventListener('change', () => {
      if (!input.files.length) return;
      STATE.files[idx] = input.files[0];
      status.textContent = 'Uploaded';
      status.style.color = '#16a34a';
    });
  });

/* CORE ENGINE */
async function runEngine() {
  readConfig();
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
    const key = `${r['SKU ID']}|${r['Location Id']}`;
    if (!saleMap[key]) saleMap[key] = 0;
    saleMap[key] += +r['Gross Units'] || 0;
  });

  const fbfMap = {};
  fbf.forEach(r => {
    if (+r['Live on Website'] > 0) {
      fbfMap[`${r['SKU']}|${r['Warehouse Id']}`] =
        +r['Live on Website'];
    }
  });

  setProgress(50);

  const fcResults = {};
  const skuAgg = {};

  fcAsk.forEach(r => {
    const sku = r['SKU Id'];
    const uniSku = r['Uniware SKU'];
    const fc = r['FC'];
    const fkAsk = +r['Quantity Sent'] || 0;

    const key = `${sku}|${fc}`;
    const sale30 = saleMap[key] || 0;
    const fcStock = fbfMap[key] || 0;

    const drr = sale30 / 30;
    const fcSC = drr > 0 ? (fcStock / drr) : 0;

    let sent = 0;
    let remark = '';

    if (sale30 === 0) {
      remark = 'No sale in last 30D';
    } else if (fcSC >= STATE.config.targetSC) {
      remark = 'Already sufficient SC';
    } else if ((uniStock[uniSku] || 0) < STATE.config.minUniware) {
      remark = 'Uniware stock below threshold';
    } else {
      let need = drr * STATE.config.targetSC - fcStock;
      need = Math.min(need, fkAsk);
      need = Math.min(need, uniStock[uniSku] - STATE.config.minUniware);
      if (need >= STATE.config.minUniware) {
        sent = Math.floor(need);
        uniStock[uniSku] -= sent;
      } else {
        remark = 'Uniware stock below threshold';
      }
    }

    if (!fcResults[fc]) fcResults[fc] = [];
    fcResults[fc].push({
      'MP SKU': sku,
      'Uniware SKU': uniSku,
      '30D Sale': sale30,
      'FC Stock': fcStock,
      'FC DRR': drr.toFixed(2),
      'FC SC': drr ? fcSC.toFixed(1) : '-',
      'FK Ask': fkAsk,
      'Sent Qty': sent,
      'Remarks': sent ? '' : remark
    });

    if (!skuAgg[sku]) skuAgg[sku] = 0;
    skuAgg[sku] += sale30;
  });

  STATE.results = fcResults;

  /* RENDER */
  renderFCSummary(fcResults);
  renderTop10(skuAgg);
  renderTabs(fcResults);

  setProgress(100);
  exportBtn.disabled = false;
}

/* RENDER FUNCTIONS */
function renderFCSummary(results) {
  let html = `<h3>FC Performance Summary</h3>
  <table class="zebra">
  <tr><th>FC</th><th>SKUs</th><th>Total Sent</th></tr>`;
  Object.keys(results).forEach(fc => {
    const rows = results[fc];
    const sent = rows.reduce((s, r) => s + r['Sent Qty'], 0);
    html += `<tr><td>${fc}</td><td>${rows.length}</td><td>${sent}</td></tr>`;
  });
  html += `</table>`;
  fcSummaryBox.innerHTML = html;
}

function renderTop10(agg) {
  const top = Object.entries(agg)
    .filter(([,v]) => v > 0)
    .sort((a,b) => b[1] - a[1])
    .slice(0,10);

  let html = `<h3>Top 10 Selling SKUs</h3>
  <table class="zebra">
  <tr><th>SKU</th><th>30D Sale</th></tr>`;
  top.forEach(([sku, sale]) => {
    html += `<tr><td>${sku}</td><td>${sale}</td></tr>`;
  });
  html += `</table>`;
  topSkuBox.innerHTML = html;
}

function renderTabs(results) {
  tabsContainer.innerHTML = '';
  const fcs = Object.keys(results);

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
  if (!rows.length) {
    tabContent.innerHTML = '<div class="placeholder">No data</div>';
    return;
  }

  let html = `<table class="zebra"><tr>`;
  Object.keys(rows[0]).forEach(h => html += `<th>${h}</th>`);
  html += `</tr>`;
  rows.forEach(r => {
    html += `<tr>`;
    Object.values(r).forEach(v => html += `<td>${v}</td>`);
    html += `</tr>`;
  });
  html += `</table>`;
  tabContent.innerHTML = html;
}

/* GENERATE */
generateBtn.addEventListener('click', () => {
  if (Object.keys(STATE.files).length !== 4) {
    alert('Please upload all 4 files.');
    return;
  }
  runEngine();
});
