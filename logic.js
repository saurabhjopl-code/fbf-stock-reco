<script>
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

const fileInputs = document.querySelectorAll('#fileSection input[type=file]');
const fileStatuses = document.querySelectorAll('#fileSection .status');

const cfgTargetSC = document.getElementById('cfgTargetSC');
const cfgMinUni = document.getElementById('cfgMinUni');
const cfgMaxReturn = document.getElementById('cfgMaxReturn');

/* ===============================
   UTILITIES
================================ */
function setProgress(percent) {
  progressBar.style.width = percent + '%';
  progressBar.textContent = percent + '%';
}

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

/* ===============================
   FILE UPLOAD HANDLING
================================ */
fileInputs.forEach((input, index) => {
  input.addEventListener('change', () => {
    if (!input.files.length) return;

    fileStatuses[index].textContent = 'Uploaded';
    fileStatuses[index].style.color = '#16a34a';

    switch (index) {
      case 0: STATE.files.sale = input.files[0]; break;
      case 1: STATE.files.fbf = input.files[0]; break;
      case 2: STATE.files.uniware = input.files[0]; break;
      case 3: STATE.files.fcAsk = input.files[0]; break;
    }
  });
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
generateBtn.addEventListener('click', async () => {

  // Validate files
  if (!STATE.files.sale || !STATE.files.fbf || !STATE.files.uniware || !STATE.files.fcAsk) {
    alert('Please upload all 4 required files.');
    return;
  }

  // Step 1: Config
  readConfig();
  setProgress(10);
  await sleep(300);

  // Step 2: Files Loaded
  setProgress(25);
  await sleep(500);

  // Step 3: Data Consolidation (placeholder)
  setProgress(50);
  await sleep(700);

  // Step 4: Metrics Calculation (placeholder)
  setProgress(75);
  await sleep(700);

  // Step 5: Recommendation Done
  setProgress(100);

  exportBtn.disabled = false;

  console.log('CONFIG:', STATE.config);
  console.log('FILES:', STATE.files);

  alert('Logic pipeline wired successfully. Recommendation engine comes next.');
});
</script>
