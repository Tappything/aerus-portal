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

  const groupMap = {
    castle: 'group_mm7mv0yv',
    empire: 'group_mm7mfbre',
    pipeline: 'group_mm7myd0b',
    calendar: 'group_mm7maw66',
    housekeeping: 'group_mm6b77as',
    pinball: 'group_mm7mmekt'
  };

  const qParams = event.queryStringParameters || {};
  const rawDrawer = qParams.group || qParams.drawer || 'all';
  const drawer = rawDrawer.toLowerCase();
  const targetGroup = groupMap[drawer];

  const query = `
    query {
      boards(ids: [${boardId}]) {
        groups ${targetGroup ? `(ids: ["${targetGroup}"])` : ''} {
          id
          title
          items_page(limit: 50) {
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
        'Authorization': token
      },
      body: JSON.stringify({ query })
    });

    const resData = await response.json();
    const groups = resData?.data?.boards?.[0]?.groups || [];
    let items = [];
    groups.forEach(g => {
      if (g.items_page && g.items_page.items) {
        items = items.concat(g.items_page.items);
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items, count: items.length })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, items: [] })
    };
  }
};
