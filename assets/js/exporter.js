function exportCSV(data, name) {
const csv = Papa.unparse(data);
const blob = new Blob([csv]);
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = name;
a.click();
}
