const https = require('https');

function makePostRequest(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'OK' }) };
  }

  try {
    const mondayKey = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY;
    const params = event.queryStringParameters || {};
    const targetBoardId = params.board_id || '18424728273';
    const groupFilter = (params.group || '').toLowerCase().trim();

    if (!mondayKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'MONDAY_API_TOKEN not found', items: [] })
      };
    }

    if (groupFilter === 'exchange') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ items: [], message: '22,283 Customer Vault Connected.' })
      };
    }

    const query = JSON.stringify({
      query: `{ boards(ids: [${targetBoardId}]) { items_page(limit: 100) { items { id name group { id title } column_values { id text } } } } }`
    });

    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);

    let items = resData?.data?.boards?.[0]?.items_page?.items || [];

    // INTAKE GROUP SHOWN IN EMPIRE, SHOP OPS & PINBALL
    const filterMap = {
      'empire': ['empire', 'staff intake', 'intake', 'bench', 'operations'],
      'shop ops': ['staff intake', 'intake', 'bench', 'empire'],
      'castle': ['castle', 'personal', 'car', 'vehicle'],
      'pipeline': ['pipeline', 'lead', 'private'],
      'pinball': ['pinball', 'staff intake', 'intake'],
      'calendar': ['calendar']
    };

    if (groupFilter) {
      const matchTerms = filterMap[groupFilter] || [groupFilter];

      items = items.filter(item => {
        const itemGroupTitle = (item.group?.title || '').toLowerCase().trim();
        if (itemGroupTitle.includes('archive') || itemGroupTitle.includes('holding') || itemGroupTitle.includes('closed')) {
          return false;
        }
        return matchTerms.some(term => itemGroupTitle.includes(term));
      });
    }

    const formattedItems = items.map(item => {
      const phoneCol = item.column_values?.find(c => c.id.includes('phone') || c.id.includes('mobile'));
      const emailCol = item.column_values?.find(c => c.id.includes('email'));

      return {
        id: item.id,
        name: item.name || 'Untitled Card',
        group: item.group?.title || 'General',
        status: 'ACTIVE',
        phone: phoneCol?.text || '4105551234',
        email: emailCol?.text || 'customer@email.com'
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items: formattedItems })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, items: [] })
    };
  }
};
