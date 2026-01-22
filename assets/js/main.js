document.getElementById('generateBtn').onclick = async () => {
const sales = await parseFile(document.getElementById('saleFile').files[0]);
const fbf = await parseFile(document.getElementById('fbfFile').files[0]);
const uni = await parseFile(document.getElementById('uniFile').files[0]);
const fcAsk = await parseFile(document.getElementById('fcRecoFile').files[0]);


const consolidated = consolidateData(sales, fbf, uni, fcAsk);
document.getElementById('progressBar').style.width = '100%';


renderTable(document.getElementById('fcSummary'), consolidated.sales.slice(0,5));
document.getElementById('exportAllBtn').disabled = false;
};
