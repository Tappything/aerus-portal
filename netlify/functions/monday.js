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
    return { statusCode: 500, headers, body: JSON.stringify({ error: '❌ MONDAY_API_TOKEN is missing in Netlify Environment Variables.' }) };
  }

  const qParams = event.queryStringParameters || {};
  const rawDrawer = qParams.group || qParams.drawer || 'all';
  const drawer = rawDrawer.toLowerCase().trim();

  // Clean, targeted group mapping for Netlify Monday Function
  const groupMap = {
    castle: ['group_mm7mv0yv', 'group_mm6b77as'],
    empire: ['group_mm7mfbre', 'group_mm6b77as'],
    pipeline: ['group_mm7myd0b', 'group_mm6b77as'],
    calendar: ['group_mm7maw66'],
    housekeeping: ['group_mm6b77as'],
    pinball: ['group_mm7mmekt', 'group_mm6b77as'],
    'needs attention': ['group_mm6b77as'],
    vault: ['group_mm6xs2fx'],
    all: ['group_mm7maw66', 'group_mm7mv0yv', 'group_mm7myd0b', 'group_mm6bv2h0', 'group_mm7mfbre', 'group_mm6b77as', 'group_mm7mmekt', 'group_mm6xs2fx']
  };

  const targetGroups = groupMap[drawer] || groupMap['all'];
  const groupIdsFormatted = JSON.stringify(targetGroups);

  const query = `
    query {
      boards(ids: [${boardId}]) {
        groups(ids: ${groupIdsFormatted}) {
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
        drawer: drawer,
        count: groups.reduce((acc, g) => acc + (g.items_page?.items?.length || 0), 0),
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
