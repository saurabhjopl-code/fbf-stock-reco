/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   VERSION: V1.0.1 (Bugfix)
   UI VERSION: V1.0 (LOCKED)
====================================================== */

const STATE = {
  config: {
    targetSC: 30,
    minUniware: 10,
    maxReturn: 30
  },
  files: {}
};

/* ELEMENTS */
const progressBar = document.querySelector('.progress-bar');
const generateBtn = document.querySelector('.btn-primary');
const exportBtn = document.querySelector('.btn-secondary');

const cfgTargetSC = document.getElementById('cfgTargetSC');
const cfgMinUni = document.getElementById('cfgMinUni');
const cfgMaxReturn = document.getElementById('cfgMaxReturn');

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
   FILE HANDLING (FINAL, SAFE)
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
   GENERATE BUTTON
================================ */
generateBtn.addEventListener('click', () => {
  if (Object.keys(STATE.files).length !== 4) {
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
    alert('Files detected correctly. Ready to proceed.');
  }, 1200);
});
