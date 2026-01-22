function renderTabs(data) {
const tabs = document.getElementById('tabs');
tabs.innerHTML = '';
Object.keys(data).forEach(fc => {
const h = document.createElement('h3');
h.textContent = fc;
tabs.appendChild(h);


const t = document.createElement('table');
const cols = Object.keys(data[fc][0] || {});
t.innerHTML = '<tr>' + cols.map(c=>`<th>${c}</th>`).join('') + '</tr>' +
data[fc].map(r=>'<tr>'+cols.map(c=>`<td>${r[c]}</td>`).join('')+'</tr>').join('');
tabs.appendChild(t);
});
}
