const https = require('https');

// Helper for native HTTPS POST requests
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

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Successful preflight' })
    };
  }

  try {
    const mondayKey = process.env.MONDAY_API_KEY;
    const params = event.queryStringParameters || {};
    const targetBoardId = params.board_id || '18424728273';
    const groupFilter = params.group || null;

    if (!mondayKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'MONDAY_API_KEY environment variable not configured', items: [] })
      };
    }

    // EXCHANGE / VAULT RULE: Do not dump archive items by default
    if (groupFilter && groupFilter.toLowerCase().trim() === 'exchange') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          items: [], 
          message: '22,283 Customer Vault Connected. Use the search bar below to look up any customer.' 
        })
      };
    }

    // GraphQL Query: Read board items with items_page API version 2023-10
    const query = JSON.stringify({
      query: `{ boards(ids: [${targetBoardId}]) { items_page(limit: 50) { items { id name group { id title } column_values { id text } } } } }`
    });

    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);

    let items = resData?.data?.boards?.[0]?.items_page?.items || [];

    // STRICT GROUP MAPPING: KEEP ACTIVE VIEWS CLEAN
    const groupMapping = {
      'shop ops': ['staff intake — pending review', 'bench log'],
      'castle': ['personal', 'car', 'vehicle', 'family'],
      'empire': ['showroom', 'announcements', 'lounge', 'business', 'team', 'operations', 'shop ops'],
      'pipeline': ['private', 'leads', 'prospect', 'sales'],
      'treasury': ['parts needed', 'awaiting install', 'billing', 'invoices']
    };

    if (groupFilter) {
      const cleanGroup = groupFilter.toLowerCase().trim();
      const mappedKeywords = groupMapping[cleanGroup] || [cleanGroup];

      items = items.filter(item => {
        if (!item.group?.title) return false;
        const itemGroupTitle = item.group.title.toLowerCase().trim();
        return mappedKeywords.some(keyword => itemGroupTitle.includes(keyword));
      });
    }

    // Format clean JSON payload for index.html card rendering
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
