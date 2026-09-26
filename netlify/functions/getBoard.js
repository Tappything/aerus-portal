const https = require('https');

// Helper for HTTPS POST requests
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

    // GraphQL Query: Read board items with items_page API version 2023-10
    const query = JSON.stringify({
      query: `{ boards(ids: [${targetBoardId}]) { items_page(limit: 50) { items { id name group { id title } } } } }`
    });

    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);

    let items = resData?.data?.boards?.[0]?.items_page?.items || [];

    // STRICT Group filtering — NO FALLBACK to all items if empty
    if (groupFilter) {
      const cleanGroup = groupFilter.toLowerCase().trim();
      items = items.filter(item => 
        item.group?.title && item.group.title.toLowerCase().trim() === cleanGroup
      );
    }

    // Format clean JSON payload for index.html card rendering
    const formattedItems = items.map(item => ({
      id: item.id,
      name: item.name,
      group: item.group?.title || 'General',
      status: 'ACTIVE'
    }));

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
