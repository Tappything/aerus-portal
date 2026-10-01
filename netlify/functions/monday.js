exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const token = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY || process.env.MONDAY_TOKEN;
  const qParams = event.queryStringParameters || {};
  const boardId = qParams.board || "18424728273";

  if (!token) {
    return { 
      statusCode: 500, 
      headers, 
      body: JSON.stringify({ error: '❌ MONDAY_API_TOKEN missing in environment variables.' }) 
    };
  }

  // GraphQL Query fetching groups AND items with group titles attached for index.html filtering
  const query = `
    query {
      boards(ids: [${boardId}]) {
        groups {
          id
          title
          items_page(limit: 50, query_params: { order_by: [{ column_id: "__creation_log__", direction: desc }] }) {
            items {
              id
              name
              created_at
              group {
                id
                title
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2023-10'
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Monday GraphQL Error: ' + data.errors[0].message })
      };
    }

    const groups = data.data?.boards?.[0]?.groups || [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        boardId: boardId,
        groups: groups
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Server fetch error: ' + err.message })
    };
  }
};
