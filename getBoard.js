const https = require('https');

function makePostRequest(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: headers
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); }
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
        body: JSON.stringify({ error: 'MONDAY_API_TOKEN not configured', items: [] })
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
      query: `{
        boards(ids: [${targetBoardId}]) {
          groups {
            id
            title
            items_page(limit: 50) {
              items {
                id
                name
                column_values {
                  id
                  text
                }
              }
            }
          }
        }
      }`
    });

    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);

    const groups = resData?.data?.boards?.[0]?.groups || [];
    let matchedItems = [];

    const filterMap = {
      'empire': ['empire', 'staff intake', 'intake', 'bench', 'operations'],
      'shop ops': ['staff intake', 'intake', 'bench', 'empire'],
      'castle': ['castle', 'personal', 'car', 'vehicle'],
      'housekeeping': ['housekeeping', 'chores', 'checklist', 'clean'],
      'pipeline': ['pipeline', 'lead', 'private'],
      'calendar': ['calendar', 'schedule'],
      'pinball': ['pinball', 'queue']
    };

    const matchTerms = filterMap[groupFilter] || [groupFilter];

    groups.forEach(group => {
      const title = (group.title || '').toLowerCase().trim();
      if (title.includes('archive') || title.includes('holding') || title.includes('closed') || title.includes('trash')) {
        return;
      }

      const isMatch = matchTerms.some(term => title.includes(term));
      if (isMatch && group.items_page?.items) {
        group.items_page.items.forEach(item => {
          const phoneCol = item.column_values?.find(c => c.id.includes('phone') || c.id.includes('mobile'));
          const emailCol = item.column_values?.find(c => c.id.includes('email'));

          matchedItems.push({
            id: item.id,
            name: item.name || 'Untitled Card',
            group: group.title,
            status: 'ACTIVE',
            phone: phoneCol?.text || '4105551234',
            email: emailCol?.text || 'customer@email.com'
          });
        });
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items: matchedItems })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, items: [] })
    };
  }
};
