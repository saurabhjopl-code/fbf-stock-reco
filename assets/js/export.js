function exportAll(data) {
const wb = XLSX.utils.book_new();
Object.keys(data).forEach(fc => {
const ws = XLSX.utils.json_to_sheet(data[fc]);
XLSX.utils.book_append_sheet(wb, ws, fc);
});
XLSX.writeFile(wb, 'FBF_Recommendation.xlsx');
}
