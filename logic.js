/* ======================================================
   FBF STOCK RECOMMENDATION ENGINE
   VERSION: V1.4 (FC NORMALIZATION FIX)
   UI VERSION: V1.1 (LOCKED)
====================================================== */

console.log('LOGIC V1.4 LOADED');

const STATE = { config:{}, files:{}, results:{} };

const progressBar = document.querySelector('.progress-bar');
const generateBtn = document.querySelector('.action-bar .btn-primary');
const exportBtn = document.querySelector('.action-bar .btn-secondary');

const fcSummaryBox = document.querySelectorAll('.summary-grid .card')[0];
const topSkuBox = document.querySelectorAll('.summary-grid .card')[1];
const tabsContainer = document.querySelector('.tabs');
const tabContent = document.querySelector('.tab-content');

/* ---------- HELPERS ---------- */
const norm = v => String(v||'')
  .toLowerCase()
  .replace(/[^a-z0-9]/g,'_')
  .replace(/_+/g,'_')
  .trim();

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

/* CORE ENGINE */
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

  /* UNIWARE STOCK */
  const uniStock={};
  uniware.forEach(r=>{
    uniStock[r['Sku Code']]=+r['Available (ATP)']||0;
  });

  /* SALE MAP */
  const saleMap={};
  sales.forEach(r=>{
    const k=`${r['SKU ID']}|${norm(r['Location Id'])}`;
    saleMap[k]=(saleMap[k]||0)+(+r['Gross Units']||0);
  });

  /* FBF MAP */
  const fbfMap={};
  fbf.forEach(r=>{
    if(+r['Live on Website']>0){
      const k=`${r['SKU']}|${norm(r['Warehouse Id'])}`;
      fbfMap[k]=+r['Live on Website'];
    }
  });

  setProgress(60);

  const fcResults={};
  const skuAgg={};

  fcAsk.forEach(r=>{
    const sku=r['SKU Id'];
    const uniSku=r['Uniware SKU'];
    const fcNorm=norm(r['FC']);
    const fkAsk=+r['Quantity Sent']||0;

    const sale30=saleMap[`${sku}|${fcNorm}`]||0;
    const fcStock=fbfMap[`${sku}|${fcNorm}`]||0;

    let sent=0,remark='',drr='-',fcSC='-';

    if(sale30===0){
      remark='No Sale in last 30D';
    }else{
      drr=(sale30/30);
      fcSC=(fcStock/drr).toFixed(1);

      if(fcSC>=STATE.config.targetSC){
        remark='Already sufficient SC';
      }else if((uniStock[uniSku]||0)<STATE.config.minUniware){
        remark='Uniware stock below threshold';
      }else{
        let need=drr*STATE.config.targetSC-fcStock;
        need=Math.min(need,fkAsk,uniStock[uniSku]-STATE.config.minUniware);
        if(need>=STATE.config.minUniware){
          sent=Math.floor(need);
          uniStock[uniSku]-=sent;
        }else{
          remark='Uniware stock below threshold';
        }
      }
    }

    if(!fcResults[fcNorm])fcResults[fcNorm]=[];
    fcResults[fcNorm].push({
      'MP SKU':sku,
      'Uniware SKU':uniSku,
      '30D Sale':sale30,
      'FC Stock':fcStock,
      'FC DRR':drr==='-'?'-':drr.toFixed(2),
      'FC SC':fcSC,
      'FK Ask':fkAsk,
      'Sent Qty':sent,
      'Remarks':sent?'':remark
    });

    if(sale30>0){
      skuAgg[sku]=(skuAgg[sku]||0)+sale30;
    }
  });

  STATE.results=fcResults;

  renderFCSummary(fcResults);
  renderTop10(skuAgg);
  renderTabs(fcResults);

  setProgress(100);
  exportBtn.disabled=false;
}

/* ---------- RENDERING ---------- */
function renderFCSummary(res){
  let h=`<h3>FC Performance Summary</h3>
  <table class="zebra center"><tr><th>FC</th><th>SKUs</th><th>Total Sent</th></tr>`;
  Object.keys(res).forEach(fc=>{
    const rows=res[fc];
    const total=rows.reduce((s,r)=>s+r['Sent Qty'],0);
    h+=`<tr><td>${fc}</td><td>${rows.length}</td><td>${total}</td></tr>`;
  });
  fcSummaryBox.innerHTML=h+`</table>`;
}

function renderTop10(agg){
  const top=Object.entries(agg).sort((a,b)=>b[1]-a[1]).slice(0,10);
  let h=`<h3>Top 10 Selling SKUs</h3>
  <table class="zebra center"><tr><th>SKU</th><th>30D Sale</th></tr>`;
  top.forEach(([s,v])=>h+=`<tr><td>${s}</td><td>${v}</td></tr>`);
  topSkuBox.innerHTML=h+`</table>`;
}

function renderTabs(res){
  tabsContainer.innerHTML='';
  const fcs=Object.keys(res);
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
