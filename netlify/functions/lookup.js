const fs = require('fs');
const path = require('path');

let catalogCache = null;
let customerCache = null;

function loadVaults() {
  if (!catalogCache) {
    try {
      const catPath = path.join(__dirname, '../../catalog.json');
      if (fs.existsSync(catPath)) {
        catalogCache = JSON.parse(fs.readFileSync(catPath, 'utf8'));
      }
    } catch (e) { catalogCache = []; }
  }
  if (!customerCache) {
    try {
      const custPath = path.join(__dirname, '../../customers.json');
      if (fs.existsSync(custPath)) {
        customerCache = JSON.parse(fs.readFileSync(custPath, 'utf8'));
      }
    } catch (e) { customerCache = []; }
  }
}

exports.handler = async (event) => {
  loadVaults();
  const params = event.queryStringParameters || {};
  const type = params.type || 'product';
  const query = (params.q || '').toLowerCase().trim();

  if (!query) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(type === 'customer' ? (customerCache || []).slice(0, 20) : (catalogCache || []).slice(0, 30))
    };
  }

  if (type === 'customer') {
    const cleanDigits = query.replace(/\D/g, '');
    const results = (customerCache || []).filter(c => {
      const nameMatch = c.name && c.name.toLowerCase().includes(query);
      const phoneMatch = cleanDigits.length >= 3 && c.phone && c.phone.replace(/\D/g, '').includes(cleanDigits);
      return nameMatch || phoneMatch;
    }).slice(0, 25);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(results)
    };
  } else {
    const results = (catalogCache || []).filter(p => {
      return p.name && p.name.toLowerCase().includes(query);
    }).slice(0, 30);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(results)
    };
  }
};
