function renderTable(container, data) {
let html = '<table><tr>';
Object.keys(data[0] || {}).forEach(h => html += `<th>${h}</th>`);
html += '</tr>';
data.forEach(r => {
html += '<tr>';
Object.values(r).forEach(v => html += `<td>${v}</td>`);
html += '</tr>';
});
html += '</table>';
container.innerHTML = html;
}
