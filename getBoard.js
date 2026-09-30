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
  const boardId = "18424728273";

  if (!token) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: '❌ MONDAY_API_TOKEN environment variable is missing in Netlify.' })
    };
  }

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

    const resData = await response.json();

    if (resData.errors && resData.errors.length > 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: 'Monday API Error: ' + resData.errors[0].message })
      };
    }

    if (resData.error_message) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ error: 'Monday Auth Error: ' + resData.error_message })
      };
    }

    const groups = resData?.data?.boards?.[0]?.groups || [];
    let allItems = [];
    const seen = new Set();
    groups.forEach(g => {
      if (g.items_page && g.items_page.items) {
        g.items_page.items.forEach(item => {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            allItems.push(item);
          }
        });
      }
    });

    allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        count: allItems.length,
        items: allItems
      })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: 'Netlify Fetch Error: ' + err.message })
    };
  }
};
