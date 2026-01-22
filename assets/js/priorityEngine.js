function sortByPriority(list) {
return list.sort((a, b) => b.FC_DRR - a.FC_DRR || a.totalSC - b.totalSC);
}
