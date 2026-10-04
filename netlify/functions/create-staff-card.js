exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { name, role } = JSON.parse(event.body || '{}');

    if (!name || !role) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing name or role parameter' }),
      };
    }

    const groupTitle = `👤 ${name} — ${role}`;
    const boardId = 18424728273;

    const query = `
      mutation CreateGroup($boardId: ID!, $groupName: String!) {
        create_group (board_id: $boardId, group_name: $groupName) {
          id
        }
      }
    `;

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env.MONDAY_API_TOKEN,
      },
      body: JSON.stringify({
        query,
        variables: {
          boardId,
          groupName: groupTitle,
        },
      }),
    });

    const result = await response.json();

    if (result.errors) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: result.errors }),
      };
    }

    const satelliteUrl = `https://freshtappything.com/?staff=${encodeURIComponent(name.toLowerCase())}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        groupId: result.data.create_group.id,
        url: satelliteUrl,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
