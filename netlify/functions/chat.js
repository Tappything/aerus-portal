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
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
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
    const rawPrompt = body.prompt || body.text || '';
    const targetBoardId = body.board_id || '18424728273';
    const targetGroupId = 'group_mm6b77as'; // Staff Intake — Pending Review

    if (!mondayKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'MONDAY_API_KEY environment variable not configured',
          reply: '❌ ERROR: MISSING MONDAY API KEY' 
        })
      };
    }

    if (!rawPrompt) {
      return { 
        statusCode: 400, 
        headers, 
        body: JSON.stringify({ error: 'No prompt provided', reply: '❌ ERROR: EMPTY PROMPT' }) 
      };
    }

    // DIRECT MONDAY.COM GRAPHQL MUTATION (NO MAKE.COM MIDDLEMAN)
    const query = JSON.stringify({
      query: `mutation {
        create_item (
          board_id: ${targetBoardId},
          group_id: "${targetGroupId}",
          item_name: "${rawPrompt.replace(/"/g, '\\"').replace(/\n/g, ' ')}"
        ) {
          id
          name
        }
      }`
    });

    const response = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);

    if (response.body?.errors) {
      console.error('Monday API GraphQL Error:', response.body.errors);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: response.body.errors[0]?.message || 'Monday GraphQL Error',
          reply: '❌ MONDAY API ERROR' 
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        reply: '✅ LOGGED & FIRED TO MONDAY! ⚡',
        itemId: response.body?.data?.create_item?.id 
      })
    };

  } catch (err) {
    console.error('Direct Intake Error:', err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: err.message, 
        reply: '❌ DIRECT INTAKE ERROR: ' + err.message 
      })
    };
  }
};
