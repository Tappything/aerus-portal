const https = require('https');

exports.handler = async function(event, context) {
  // Handle CORS Preflight Options Request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const boardId = data.boardId;
    const groupName = data.groupName;

    if (!boardId || !groupName) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'boardId and groupName are required fields' })
      };
    }

    const apiKey = process.env.MONDAY_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: 'MONDAY_API_KEY environment variable missing' })
      };
    }

    // GraphQL Mutation to instantly create a group on the targeted board
    const query = JSON.stringify({
      query: `mutation {
        create_group (
          board_id: ${boardId}, 
          group_name: "${groupName.replace(/"/g, '\\"')}"
        ) {
          id
        }
      }`
    });

    const options = {
      hostname: 'api.monday.com',
      path: '/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(query),
        'Authorization': apiKey,
        'API-Version': '2023-10'
      }
    };

    return new Promise((resolve) => {
      const req = https.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const result = JSON.parse(responseData);

            if (result.errors) {
              resolve({
                statusCode: 400,
                headers: {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ error: result.errors })
              });
              return;
            }

            const newGroupId = result.data?.create_group?.id;

            resolve({
              statusCode: 200,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                success: true,
                board_id: boardId,
                group_name: groupName,
                group_id: newGroupId
              })
            });
          } catch (err) {
            resolve({
              statusCode: 500,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({ error: 'Failed to parse Monday API response', details: err.message })
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ error: 'Failed to connect to Monday.com API', details: error.message })
        });
      });

      req.write(query);
      req.end();
    });

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Internal Server Error', details: error.message })
    };
  }
};
