/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   VERSION: V1.1.1
   FIX: Generate button binding
   UI VERSION: V1.1 (LOCKED)
====================================================== */

console.log('LOGIC.JS LOADED');

/* ===============================
   ELEMENT REFERENCES (FIXED)
================================ */
const progressBar = document.querySelector('.progress-bar');
const generateBtn = document.querySelector('.action-bar .btn-primary');
const exportBtn = document.querySelector('.action-bar .btn-secondary');

/* ===============================
   PROGRESS
================================ */
function setProgress(p) {
  progressBar.style.width = p + '%';
  progressBar.textContent = p + '%';
}

/* ===============================
   FILE STATUS (LOCKED)
================================ */
const STATE = { files: {} };

document
  .querySelectorAll('#fileSection .file-row')
  .forEach((row, idx) => {
    const input = row.querySelector('input[type="file"]');
    const status = row.querySelector('.status');

    input.addEventListener('change', () => {
      if (!input.files.length) return;
      STATE.files[idx] = input.files[0];
      status.textContent = 'Uploaded';
      status.style.color = '#16a34a';
      status.title = input.files[0].name;
    });
  });

/* ===============================
   GENERATE BUTTON (NOW WORKS)
================================ */
generateBtn.addEventListener('click', () => {
  console.log('Generate clicked');

  if (Object.keys(STATE.files).length !== 4) {
    alert('Please upload all 4 required files.');
    return;
  }

  setProgress(10);
  setTimeout(() => setProgress(25), 300);
  setTimeout(() => setProgress(50), 600);
  setTimeout(() => setProgress(75), 900);
  setTimeout(() => {
    setProgress(100);
    exportBtn.disabled = false;
    alert('Generate pipeline confirmed working.');
  }, 1200);
});
