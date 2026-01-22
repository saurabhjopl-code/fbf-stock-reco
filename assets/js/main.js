document.getElementById('generateBtn').onclick = async () => {
const s = await parse(saleFile.files[0]);
const f = await parse(fbfFile.files[0]);
const u = await parse(uniFile.files[0]);
const a = await parse(fcAskFile.files[0]);


const res = runEngine(s,f,u,a);
renderTabs(res);
document.getElementById('exportAllBtn').disabled = false;
document.getElementById('exportAllBtn').onclick = ()=>exportAll(res);
};
