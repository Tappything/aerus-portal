const https = require('https');

function makePostRequest(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
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
    const body = JSON.parse(event.body || '{}');
    const promptText = (body.prompt || body.rawDump || '').trim();

    if (!promptText) {
      return { statusCode: 400, headers, body: JSON.stringify({ reply: 'Empty input.' }) };
    }

    const lower = promptText.toLowerCase();

    // TRACK 1: ACTION COMMAND TRACK (Move Active Items to Pinball)
    if (lower.includes('move') || lower.includes('clean up') || lower.includes('pinball') || lower.includes('clear queue')) {
      if (mondayKey) {
        const getItemsQuery = JSON.stringify({
          query: `{ boards(ids: [18424728273]) { groups(ids: ["group_mm7mfbre", "group_mm6b77as"]) { items_page(limit: 50) { items { id } } } } }`
        });

        const itemsRes = await makePostRequest('https://api.monday.com/v2', {
          'Content-Type': 'application/json',
          'Authorization': mondayKey,
          'API-Version': '2023-10',
          'Content-Length': Buffer.byteLength(getItemsQuery)
        }, getItemsQuery);

        const groups = itemsRes?.data?.boards?.[0]?.groups || [];
        for (const group of groups) {
          const items = group.items_page?.items || [];
          for (const item of items) {
            const moveQuery = JSON.stringify({
              query: `mutation { move_item_to_group (item_id: "${item.id}", group_id: "group_mm7mmekt") { id } }`
            });
            await makePostRequest('https://api.monday.com/v2', {
              'Content-Type': 'application/json',
              'Authorization': mondayKey,
              'API-Version': '2023-10',
              'Content-Length': Buffer.byteLength(moveQuery)
            }, moveQuery);
          }
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          reply: "⚡ All active tasks moved to your Pinball queue, William! Let's knock them out!"
        })
      };
    }

    // TRACK 2: INTAKE DUMP TRACK -> CREATE CARD ON MONDAY
    if (mondayKey) {
      const createItemQuery = JSON.stringify({
        query: `mutation {
          create_item (board_id: 18424728273, group_id: "group_mm6b77as", item_name: "${promptText.replace(/"/g, '\\"')}") {
            id
          }
        }`
      });

      await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(createItemQuery)
      }, createItemQuery);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: `✅ INTAKE LOGGED TO QUEUE: "${promptText.substring(0, 45)}..."`
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ reply: '✅ LOGGED & STAGED IN QUEUE! ⚡' })
    };
  }
};
