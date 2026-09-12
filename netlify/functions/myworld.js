exports.handler = async () => {
  const token = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY;
  const boardId = process.env.MONDAY_BOARD_ID;
  const headers = {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'};
  if (!token || !boardId) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing env vars' }) };
  }
  const query = `query ($boardId: [ID!]) {
    boards(ids: $boardId) {
      groups {
        id
        title
        color
        items_page(limit: 20) {
          items {
            name
            column_values { id text type }
          }
        }
      }
    }
  }`;
  try {
    const res = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: token.startsWith('Bearer ') ? token : 'Bearer ' + token,
        'API-Version': '2024-01'
      },
      body: JSON.stringify({ query, variables: { boardId: [boardId] } })
    });
    const data = await res.json();
    if (data.errors) return { statusCode: 502, headers, body: JSON.stringify({ error: 'Monday API error', details: data.errors }) };
    const groups = data?.data?.boards?.[0]?.groups || [];
    const normalized = groups.map(group => ({
      id: group.id,
      title: group.title,
      color: group.color,
      items: (group.items_page?.items || []).map(item => {
        const statusCol = item.column_values.find(c => c.id === 'project_status');
        return { name: item.name || 'Untitled', status: statusCol?.text || '' };
      })
    }));
    return { statusCode: 200, headers, body: JSON.stringify({ groups: normalized }) };
  } catch(err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch', details: err.message }) };
  }
};
