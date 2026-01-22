/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   VERSION: V1.1 (Logic only)
   UI VERSION: V1.0 (LOCKED)
====================================================== */

/* ===============================
   GLOBAL STATE
================================ */
const STATE = {
  config: {
    targetSC: 30,
    minUniware: 10,
    maxReturn: 30
  },
  files: {},
  data: {},
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

const fileInputs = document.querySelectorAll('#fileSection input[type=file]');
const fileStatuses = document.querySelectorAll('#fileSection .status');

/* ===============================
   UTILITIES
================================ */
function setProgress(p) {
  progressBar.style.width = p + '%';
  progressBar.textContent = p + '%';
}

function readConfig() {
  STATE.config.targetSC = +cfgTargetSC.value;
  STATE.config.minUniware = +cfgMinUni.value;
  STATE.config.maxReturn = +cfgMaxReturn.value;
}

function readFile(file) {
  return new Promise((resolve) => {
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
    if (file.name.endsWith('.csv')) reader.readAsText(file);
    else reader.readAsBinaryString(file);
  });
}

/* ===============================
   FILE BINDING
================================ */
fileInputs.forEach((input, idx) => {
  input.addEventListener('change', () => {
    if (!input.files.length) return;
    STATE.files[idx] = input.files[0];
    fileStatuses[idx].textContent = 'Uploaded';
    fileStatuses[idx].style.color = '#16a34a';
    fileStatuses[idx].title = input.files[0].name;
  });
});

/* ===============================
   CORE ENGINE
================================ */
async function runEngine() {

  /* ---------- STEP 1: LOAD FILES ---------- */
  setProgress(10);
  const [sales, fbf, uniware, fcAsk] = await Promise.all([
    readFile(STATE.files[0]),
    readFile(STATE.files[1]),
    readFile(STATE.files[2]),
    readFile(STATE.files[3])
  ]);

  setProgress(25);

  /* ---------- STEP 2: NORMALIZE DATA ---------- */

  // Uniware Stock
  const uniStock = {};
  uniware.forEach(r => {
    uniStock[r['Sku Code']] = +r['Available (ATP)'] || 0;
  });

  // 30D Sale (FC + SKU)
  const saleMap = {};
  sales.forEach(r => {
    const key = `${r['SKU ID']}|${r['Location Id']}`;
    if (!saleMap[key]) saleMap[key] = { gross: 0, ret: 0 };
    saleMap[key].gross += +r['Gross Units'] || 0;
    saleMap[key].ret += +r['Return Units'] || 0;
  });

  // FBF Stock
  const fbfMap = {};
  fbf.forEach(r => {
    if (+r['Live on Website'] > 0) {
      fbfMap[`${r['SKU']}|${r['Warehouse Id']}`] =
        +r['Live on Website'];
    }
  });

  setProgress(50);

  /* ---------- STEP 3: BUILD FC ITEMS ---------- */
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
    const uniSC = drr ? (uniStock[uniSku] || 0) / drr : 999;

    items.push({
      sku, uniSku, fc, gross, ret,
      drr, fcStock, fcSC, uniSC, fkAsk
    });
  });

  /* ---------- STEP 4: PRIORITY SORT ---------- */
  items.sort((a, b) =>
    b.drr - a.drr || a.fcSC - b.fcSC
  );

  setProgress(75);

  /* ---------- STEP 5: ALLOCATION ---------- */
  const results = {};

  items.forEach(i => {
    if (!results[i.fc]) results[i.fc] = [];

    let sent = 0;
    let remark = '';

    const returnPct = (i.ret / (i.gross || 1)) * 100;

    if (returnPct > STATE.config.maxReturn) {
      remark = 'Return % exceeds limit';
    } else if (i.fcSC >= STATE.config.targetSC) {
      remark = 'Already sufficient SC';
    } else if ((uniStock[i.uniSku] || 0) < STATE.config.minUniware) {
      remark = 'Uniware stock below threshold';
    } else {
      let need = i.drr * STATE.config.targetSC - i.fcStock;
      need = Math.min(need, i.fkAsk);
      need = Math.min(need, uniStock[i.uniSku] - STATE.config.minUniware);

      if (need >= STATE.config.minUniware) {
        sent = Math.floor(need);
        uniStock[i.uniSku] -= sent;
      } else {
        remark = 'Uniware stock below threshold';
      }
    }

    results[i.fc].push({
      'MP SKU': i.sku,
      'Uniware SKU': i.uniSku,
      '30D Sale': i.gross,
      'FC Stock': i.fcStock,
      'FC DRR': i.drr.toFixed(2),
      'FC SC': i.fcSC.toFixed(1),
      'Uniware Stock': uniStock[i.uniSku] || 0,
      'FK Ask': i.fkAsk,
      'Sent Qty': sent,
      'Remarks': sent ? '' : remark
    });
  });

  STATE.results = results;

  setProgress(100);
  exportBtn.disabled = false;

  console.log('FINAL RESULTS:', results);
  alert('Recommendation engine completed successfully (V1.1)');
}

/* ===============================
   GENERATE BUTTON
================================ */
generateBtn.addEventListener('click', () => {
  if (Object.keys(STATE.files).length !== 4) {
    alert('Please upload all 4 required files.');
    return;
  }
  readConfig();
  runEngine();
});
