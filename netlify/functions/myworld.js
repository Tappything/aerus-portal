exports.handler = async () => {
  const token = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY;
  const boardId = process.env.MONDAY_BOARD_ID;
  if (!token || !boardId) {
    return { statusCode: 500, headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body: JSON.stringify({ error: 'Missing env vars' }) };
  }
  const query = `query ($boardId: [ID!]) { boards(ids: $boardId) { items_page(limit: 10) { items { name column_values { id text type } } } } }`;
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
    if (data.errors) return { statusCode: 502, headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body: JSON.stringify({ error: 'Monday API error' }) };
    const items = data?.data?.boards?.[0]?.items_page?.items || [];
    const normalized = items.map(item => {
      const statusCol = item.column_values.find(c => c.type === 'color') || item.column_values.find(c => c.id === 'status') || item.column_values.find(c => /status/i.test(c.id));
      return { name: item.name || 'Untitled', status: statusCol?.text || 'Unknown' };
    });
    return { statusCode: 200, headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body: JSON.stringify({ items: normalized }) };
  } catch(err) {
    return { statusCode: 500, headers: {'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}, body: JSON.stringify({ error: 'Failed to fetch' }) };
  }
};
