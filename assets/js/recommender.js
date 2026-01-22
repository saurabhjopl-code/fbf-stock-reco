function recommend(item) {
const target = item.FC_DRR * APP_CONFIG.targetSC;
let reco = Math.min(target - item.fcStock, item.fkAsk);
if (item.uniStock - reco < APP_CONFIG.minUniware) reco = 0;
if (reco < APP_CONFIG.minUniware) reco = 0;
return Math.max(0, Math.floor(reco));
}
