function validateHeaders(data, required) {
const headers = Object.keys(data[0] || {});
return required.every(h => headers.includes(h));
}
