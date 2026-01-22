/* ===============================
   GLOBAL STATE
================================ */
const STATE = {
  config: {
    targetSC: 30,
    minUniware: 10,
    maxReturn: 30
  },
  files: {
    sale: null,
    fbf: null,
    uniware: null,
    fcAsk: null
  }
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

/* FILE INPUTS (EXPLICIT BINDING) */
const saleInput = document.querySelectorAll('#fileSection input[type=file]')[0];
const fbfInput = document.querySelectorAll('#fileSection input[type=file]')[1];
const uniInput = document.querySelectorAll('#fileSection input[type=file]')[2];
const fcAskInput = document.querySelectorAll('#fileSection input[type=file]')[3];

const saleStatus = document.querySelectorAll('#fileSection .status')[0];
const fbfStatus = document.querySelectorAll('#fileSection .status')[1];
const uniStatus = document.querySelectorAll('#fileSection .status')[2];
const fcAskStatus = document.querySelectorAll('#fileSection .status')[3];

/* ===============================
   UTILITIES
================================ */
function setProgress(percent) {
  progressBar.style.width = percent + '%';
  progressBar.textContent = percent + '%';
}

function markUploaded(statusEl, file) {
  statusEl.textContent = 'Uploaded';
  statusEl.style.color = '#16a34a';
  statusEl.title = file.name;
}

/* ===============================
   FILE UPLOAD HANDLERS
================================ */
saleInput.addEventListener('change', () => {
  if (!saleInput.files.length) return;
  STATE.files.sale = saleInput.files[0];
  markUploaded(saleStatus, saleInput.files[0]);
});

fbfInput.addEventListener('change', () => {
  if (!fbfInput.files.length) return;
  STATE.files.fbf = fbfInput.files[0];
  markUploaded(fbfStatus, fbfInput.files[0]);
});

uniInput.addEventListener('change', () => {
  if (!uniInput.files.length) return;
  STATE.files.uniware = uniInput.files[0];
  markUploaded(uniStatus, uniInput.files[0]);
});

fcAskInput.addEventListener('change', () => {
  if (!fcAskInput.files.length) return;
  STATE.files.fcAsk = fcAskInput.files[0];
  markUploaded(fcAskStatus, fcAskInput.files[0]);
});

/* ===============================
   CONFIG READ
================================ */
function readConfig() {
  STATE.config.targetSC = Number(cfgTargetSC.value);
  STATE.config.minUniware = Number(cfgMinUni.value);
  STATE.config.maxReturn = Number(cfgMaxReturn.value);
}

/* ===============================
   GENERATE BUTTON
================================ */
generateBtn.addEventListener('click', () => {

  if (!STATE.files.sale || !STATE.files.fbf || !STATE.files.uniware || !STATE.files.fcAsk) {
    alert('Please upload all 4 required files.');
    return;
  }

  readConfig();

  setProgress(10);
  setTimeout(() => setProgress(25), 300);
  setTimeout(() => setProgress(50), 600);
  setTimeout(() => setProgress(75), 900);
  setTimeout(() => {
    setProgress(100);
    exportBtn.disabled = false;
    alert('Files detected correctly. Ready for recommendation logic.');
  }, 1200);
});
