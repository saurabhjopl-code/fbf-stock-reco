function parseFile(file) {
return new Promise(resolve => {
Papa.parse(file, {
header: true,
skipEmptyLines: true,
complete: res => resolve(res.data)
});
});
}
