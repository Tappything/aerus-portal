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
  const groupParam = (event.queryStringParameters && event.queryStringParameters.group) ? event.queryStringParameters.group.toLowerCase() : '';

  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "Missing Monday API token." }) };
  }

  // Group Map for Drawers
  const groupMap = {
    'castle': 'group_mm7mv0yv',
    'empire': 'group_mm7mfbre',
    'pipeline': 'group_mm7myd0b',
    'calendar': 'group_mm7maw66',
    'housekeeping': 'group_mm6b77as',
    'pinball': 'group_mm7mmekt',
    'parts': 'group_mm6bv2h0',
    'bench': 'group_mm76qbbh',
    'ready': 'group_mm6s961c',
    'vault': 'group_mm7myd0b'
  };

  const groupId = groupMap[groupParam] || null;

  let query = '';
  if (groupId) {
    query = `query { boards(ids: [${boardId}]) { groups(ids: ["${groupId}"]) { items_page(limit: 50) { items { id name created_at } } } } }`;
  } else {
    query = `query { boards(ids: [${boardId}]) { items_page(limit: 50) { items { id name created_at } } } }`;
  }

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
    let items = [];

    if (groupId) {
      items = data?.data?.boards?.[0]?.groups?.[0]?.items_page?.items || [];
    } else {
      items = data?.data?.boards?.[0]?.items_page?.items || [];
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ group: groupParam, groupId: groupId, items: items })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to query board: " + err.message })
    };
  }
};
