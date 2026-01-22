function calculateMetrics(row) {
row.FC_DRR = row.gross / 30;
row.FC_SC = row.fcStock / (row.FC_DRR || 1);
row.UNI_SC = row.uniStock / (row.UNI_DRR || 1);
return row;
}
