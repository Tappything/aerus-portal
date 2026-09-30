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

  // Multi-group queries so real active cards show up in every drawer
  let groupIds = [];
  if (groupParam === 'castle') {
    groupIds = ['group_mm7mv0yv', 'group_mm7cn4en'];
  } else if (groupParam === 'empire') {
    groupIds = ['group_mm7mfbre', 'group_mm6b77as', 'group_mm76qbbh', 'group_mm6s961c'];
  } else if (groupParam === 'pipeline') {
    groupIds = ['group_mm7myd0b', 'group_mm6c4aj6'];
  } else if (groupParam === 'calendar') {
    groupIds = ['group_mm7maw66'];
  } else if (groupParam === 'housekeeping') {
    groupIds = ['group_mm6b77as', 'group_mm744g20'];
  } else if (groupParam === 'pinball') {
    groupIds = ['group_mm7mmekt', 'group_mm6b77as', 'group_mm7mfbre'];
  } else if (groupParam === 'vault') {
    groupIds = ['group_mm6xs2fx', 'group_mm6b77as'];
  }

  let query = '';
  if (groupIds.length > 0) {
    const formattedGroupIds = groupIds.map(id => `"${id}"`).join(',');
    query = `query { boards(ids: [${boardId}]) { groups(ids: [${formattedGroupIds}]) { items_page(limit: 50) { items { id name created_at } } } } }`;
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

    if (groupIds.length > 0) {
      const groups = data?.data?.boards?.[0]?.groups || [];
      groups.forEach(g => {
        if (g.items_page && g.items_page.items) {
          items = items.concat(g.items_page.items);
        }
      });
    } else {
      items = data?.data?.boards?.[0]?.items_page?.items || [];
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ group: groupParam, count: items.length, items: items })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Failed to query board: " + err.message })
    };
  }
};
