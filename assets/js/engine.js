function runEngine(sales, fbf, uni, fcAsk) {


const saleMap = {};
sales.forEach(r => {
const k = r['SKU ID'] + '|' + r['Location Id'];
if (!saleMap[k]) saleMap[k] = { gross: 0, ret: 0 };
saleMap[k].gross += +r['Gross Units'] || 0;
saleMap[k].ret += +r['Return Units'] || 0;
});


const fbfMap = {};
fbf.forEach(r => {
if (+r['Live on Website'] > 0)
fbfMap[r['SKU'] + '|' + r['Warehouse Id']] = +r['Live on Website'];
});


const items = [];
fcAsk.forEach(r => {
const sku = r['SKU Id'];
const uniSku = r['Uniware SKU'];
const fc = r['FC'];
const key = sku + '|' + fc;


const gross = saleMap[key]?.gross || 0;
const ret = saleMap[key]?.ret || 0;
const fcStock = fbfMap[key] || 0;
const drr = gross / 30;
const fcSC = drr ? fcStock / drr : 999;
const uniSC = drr ? (uniStock[uniSku] || 0) / drr : 999;


items.push({ sku, uniSku, fc, gross, ret, fcStock, drr, fcSC, uniSC, fkAsk: +r['Quantity Sent'] || 0 });
});


items.sort((a,b)=>b.drr-a.drr||a.fcSC-b.fcSC);


const out = {};
items.forEach(i => {
if (!out[i.fc]) out[i.fc] = [];
let sent = 0, remark = '';


if (i.ret / (i.gross || 1) * 100 > CONFIG.maxReturn)
remark = 'Return % exceeds limit';
else if (i.fcSC >= CONFIG.targetSC)
remark = 'Already sufficient SC';
else if ((uniStock[i.uniSku]||0) < CONFIG.minUni)
remark = 'Uniware stock below threshold';
else {
let need = i.drr * CONFIG.targetSC - i.fcStock;
need = Math.min(need, i.fkAsk);
need = Math.min(need, uniStock[i.uniSku] - CONFIG.minUni);
if (need >= CONFIG.minUni) {
sent = Math.floor(need);
uniStock[i.uniSku] -= sent;
} else remark = 'Uniware stock below threshold';
}


out[i.fc].push({
'MP SKU': i.sku,
'Uniware SKU': i.uniSku,
'30D Sale': i.gross,
'FC Stock': i.fcStock,
'FC DRR': i.drr.toFixed(2),
'FC SC': i.fcSC.toFixed(1),
'Uniware Stock': uniStock[i.uniSku],
'FK Ask': i.fkAsk,
'Sent Qty': sent,
'Remarks': sent ? '' : remark
});
});


return out;
