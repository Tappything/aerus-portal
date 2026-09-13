const https = require('https');

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  const query = JSON.stringify({
    query: `{
      boards(ids: [18424728273]) {
        groups {
          name
          items_page(limit: 10) {
            items {
              name
              column_values(ids: ["project_status"]) {
                text
              }
            }
          }
        }
      }
    }`
  });

  const apiKey = process.env.MONDAY_API_KEY;

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.monday.com',
      path: '/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
        'API-Version': '2024-01'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const groups = json.data.boards[0].groups.map(g => ({
            name: g.name,
            items: g.items_page.items.map(i => ({
              name: i.name,
              status: i.column_values[0]?.text || ''
            }))
          }));
          resolve({statusCode: 200, headers, body: JSON.stringify({groups})});
        } catch(e) {
          resolve({statusCode: 200, headers, body: JSON.stringify({groups: []})});
        }
      });
    });

    req.on('error', () => resolve({statusCode: 200, headers, body: JSON.stringify({groups: []})}));
    req.write(query);
    req.end();
  });
};
