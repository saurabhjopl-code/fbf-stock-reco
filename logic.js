console.log('LOGIC.JS LOADED');

const progressBar = document.querySelector('.progress-bar');
const generateBtn = document.querySelector('.btn-primary');

function setProgress(p) {
  progressBar.style.width = p + '%';
  progressBar.textContent = p + '%';
}

generateBtn.addEventListener('click', () => {
  console.log('Generate clicked');

  setProgress(10);
  setTimeout(() => setProgress(25), 300);
  setTimeout(() => setProgress(50), 600);
  setTimeout(() => setProgress(75), 900);
  setTimeout(() => setProgress(100), 1200);
});
