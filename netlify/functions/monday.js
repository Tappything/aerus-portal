const https = require('https');

exports.handler = async function(event, context) {
  // Read dynamic board parameter from URL or fallback to env default
  const boardId = (event.queryStringParameters && event.queryStringParameters.board) || process.env.MONDAY_BOARD_ID;
  const apiKey = process.env.MONDAY_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'MONDAY_API_KEY environment variable missing' })
    };
  }

  const query = JSON.stringify({
    query: `query {
      boards (ids: [${boardId}]) {
        name
        groups {
          id
          title
          items_page {
            items {
              id
              name
              state
              column_values {
                id
                text
                value
              }
            }
          }
        }
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

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);

          if (result.errors) {
            resolve({
              statusCode: 400,
              body: JSON.stringify({ error: result.errors })
            });
            return;
          }

          const board = result.data?.boards?.[0];
          if (!board) {
            resolve({
              statusCode: 404,
              body: JSON.stringify({ error: `Board ID ${boardId} not found` })
            });
            return;
          }

          resolve({
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              board_id: boardId,
              board_name: board.name,
              groups: board.groups
            })
          });
        } catch (err) {
          resolve({
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to parse response', details: err.message })
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to connect to Monday.com API', details: error.message })
      });
    });

    req.write(query);
    req.end();
  });
};
