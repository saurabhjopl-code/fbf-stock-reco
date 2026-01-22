/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   VERSION: V1.5 (FULL SKU–FC MATRIX)
   UI VERSION: V1.1 (LOCKED)
====================================================== */

console.log('LOGIC V1.5 LOADED');

const STATE = { config:{}, files:{}, results:{}, fcSaleSummary:{} };

/* ELEMENTS */
const progressBar = document.querySelector('.progress-bar');
const generateBtn = document.querySelector('.action-bar .btn-primary');
const exportBtn = document.querySelector('.action-bar .btn-secondary');

const fcSummaryBox = document.querySelectorAll('.summary-grid .card')[0];
const fcSaleBox   = document.querySelectorAll('.summary-grid .card')[1];
const tabsContainer = document.querySelector('.tabs');
const tabContent = document.querySelector('.tab-content');

/* HELPERS */
const norm = v => String(v||'')
  .toLowerCase()
  .replace(/[^a-z0-9]/g,'_')
  .replace(/_+/g,'_');

function setProgress(p){
  progressBar.style.width=p+'%';
  progressBar.textContent=p+'%';
}

function readConfig(){
  STATE.config={
    targetSC:+cfgTargetSC.value,
    minUniware:+cfgMinUni.value,
    maxReturn:+cfgMaxReturn.value
  };
}

function readFile(file){
  return new Promise(res=>{
    const r=new FileReader();
    r.onload=e=>{
      if(file.name.endsWith('.csv')){
        res(Papa.parse(e.target.result,{header:true}).data);
      }else{
        const wb=XLSX.read(e.target.result,{type:'binary'});
        res(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]));
      }
    };
    file.name.endsWith('.csv')?r.readAsText(file):r.readAsBinaryString(file);
  });
}

/* FILE UPLOAD (LOCKED) */
document.querySelectorAll('#fileSection .file-row').forEach((row,i)=>{
  const input=row.querySelector('input');
  const status=row.querySelector('.status');
  input.onchange=()=>{
    STATE.files[i]=input.files[0];
    status.textContent='Uploaded';
    status.style.color='#16a34a';
  };
});

/* ================= CORE ENGINE ================= */
async function runEngine(){
  readConfig();
  setProgress(10);

  const [sales,fbf,uniware,fcAsk]=await Promise.all([
    readFile(STATE.files[0]),
    readFile(STATE.files[1]),
    readFile(STATE.files[2]),
    readFile(STATE.files[3])
  ]);

  setProgress(30);

  /* -------- UNIWARE STOCK -------- */
  const uniStock={};
  uniware.forEach(r=>{
    uniStock[r['Sku Code']]=+r['Available (ATP)']||0;
  });

  /* -------- SALE MAP + FC SALE SUMMARY -------- */
  const saleMap={};
  const fcSaleSummary={};

  sales.forEach(r=>{
    const fc = norm(r['Location Id']);
    const sku = r['SKU ID'];
    const qty = +r['Gross Units']||0;

    const key = `${sku}|${fc}`;
    saleMap[key]=(saleMap[key]||0)+qty;
    fcSaleSummary[fc]=(fcSaleSummary[fc]||0)+qty;
  });

  STATE.fcSaleSummary = fcSaleSummary;

  /* -------- FBF STOCK -------- */
  const fbfMap={};
  fbf.forEach(r=>{
    if(+r['Live on Website']>0){
      const key=`${r['SKU']}|${norm(r['Warehouse Id'])}`;
      fbfMap[key]=+r['Live on Website'];
    }
  });

  /* -------- FK ASK MAP -------- */
  const fkAskMap={};
  fcAsk.forEach(r=>{
    const key=`${r['SKU Id']}|${norm(r['FC'])}`;
    fkAskMap[key]=+r['Quantity Sent']||0;
  });

  setProgress(60);

  /* -------- FULL SKU–FC UNIVERSE -------- */
  const universe = new Set([
    ...Object.keys(saleMap),
    ...Object.keys(fbfMap),
    ...Object.keys(fkAskMap)
  ]);

  const fcResults={};

  universe.forEach(key=>{
    const [sku,fc]=key.split('|');

    const sale30 = saleMap[key]||0;
    const fcStock = fbfMap[key]||0;
    const fkAsk = fkAskMap[key]||0;

    let drr='-',fcSC='-',sent=0,remark='';

    if(sale30===0){
      remark='No Sale in last 30D';
    }else{
      drr=sale30/30;
      fcSC=(fcStock/drr).toFixed(1);

      if(fcSC>=STATE.config.targetSC){
        remark='Already sufficient SC';
      }else if(fkAsk===0){
        remark='FK Ask not available';
      }else if((uniStock[sku]||0)<STATE.config.minUniware){
        remark='Uniware stock below threshold';
      }else{
        let need=drr*STATE.config.targetSC-fcStock;
        need=Math.min(need,fkAsk,uniStock[sku]-STATE.config.minUniware);
        if(need>=STATE.config.minUniware){
          sent=Math.floor(need);
          uniStock[sku]-=sent;
        }else{
          remark='Uniware stock below threshold';
        }
      }
    }

    if(!fcResults[fc])fcResults[fc]=[];
    fcResults[fc].push({
      'MP SKU':sku,
      '30D Sale':sale30,
      'FC Stock':fcStock,
      'FC DRR':drr==='-'?'-':drr.toFixed(2),
      'FC SC':fcSC,
      'FK Ask':fkAsk,
      'Sent Qty':sent,
      'Remarks':sent?'':remark
    });
  });

  STATE.results=fcResults;

  renderFCSummary();
  renderFCSaleSummary();
  renderTabs();

  setProgress(100);
  exportBtn.disabled=false;
}

/* ================= RENDERING ================= */
function renderFCSummary(){
  let h=`<h3>FC Performance Summary</h3>
  <table class="zebra center">
  <tr><th>FC</th><th>SKUs</th><th>Total Sent</th></tr>`;
  Object.keys(STATE.results).forEach(fc=>{
    const rows=STATE.results[fc];
    const total=rows.reduce((s,r)=>s+r['Sent Qty'],0);
    h+=`<tr><td>${fc}</td><td>${rows.length}</td><td>${total}</td></tr>`;
  });
  fcSummaryBox.innerHTML=h+`</table>`;
}

function renderFCSaleSummary(){
  let h=`<h3>FC wise Sale in 30D</h3>
  <table class="zebra center">
  <tr><th>FC</th><th>Total Units Sold</th></tr>`;
  Object.keys(STATE.fcSaleSummary).forEach(fc=>{
    h+=`<tr><td>${fc}</td><td>${STATE.fcSaleSummary[fc]}</td></tr>`;
  });
  fcSaleBox.innerHTML=h+`</table>`;
}

function renderTabs(){
  tabsContainer.innerHTML='';
  const fcs=Object.keys(STATE.results);

  fcs.forEach((fc,i)=>{
    const b=document.createElement('button');
    b.className='tab'+(i===0?' active':'');
    b.textContent=fc;
    b.onclick=()=>showTab(fc,b);
    tabsContainer.appendChild(b);
  });
  showTab(fcs[0],tabsContainer.children[0]);
}

function showTab(fc,b){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  b.classList.add('active');

  const rows=STATE.results[fc];
  let h=`<table class="zebra center"><tr>`;
  Object.keys(rows[0]).forEach(k=>h+=`<th>${k}</th>`);
  h+=`</tr>`;
  rows.forEach(r=>{
    h+=`<tr>`;
    Object.values(r).forEach(v=>h+=`<td>${v}</td>`);
    h+=`</tr>`;
  });
  tabContent.innerHTML=h+`</table>`;
}

/* GENERATE */
generateBtn.onclick=()=>{
  if(Object.keys(STATE.files).length!==4){
    alert('Please upload all 4 files');
    return;
  }
  runEngine();
};
