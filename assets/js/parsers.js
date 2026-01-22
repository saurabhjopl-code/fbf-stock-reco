function parse(file) {
return new Promise(res => {
Papa.parse(file, {
header: true,
skipEmptyLines: true,
complete: r => res(r.data)
});
});
}
