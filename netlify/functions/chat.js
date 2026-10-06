exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const prompt = body.prompt || '';
    const boardId = body.board_id || '18424728273';
    const apiKey = process.env.MONDAY_API_KEY;

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    // HANDLE MOVE_CARD MUTATION
    if (prompt === 'MOVE_CARD') {
      const itemId = body.item_id;
      const groupId = body.group_id;

      if (!itemId || !groupId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'item_id and group_id are required for MOVE_CARD' })
        };
      }

      const moveQuery = `
        mutation ($itemId: ID!, $groupId: String!) {
          move_item_to_group (item_id: $itemId, group_id: $groupId) {
            id
          }
        }
      `;

      const moveVariables = {
        itemId: itemId,
        groupId: groupId
      };

      const moveResponse = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: moveQuery, variables: moveVariables })
      });

      const moveData = await moveResponse.json();

      if (moveData.errors) {
        console.error('Monday API Move Errors:', moveData.errors);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to move item on Monday.com', details: moveData.errors })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply: 'Card Routed! ⚡',
          item: moveData.data.move_item_to_group
        })
      };
    }

    // DEFAULT ROUTE: All standard intakes go directly to Learning Drawer
    const groupId = 'group_mm6b77as';

    const query = `
      mutation ($boardId: ID!, $groupId: String!, $itemName: String!) {
        create_item (board_id: $boardId, group_id: $groupId, item_name: $itemName) {
          id
          name
        }
      }
    `;

    const variables = {
      boardId: boardId,
      groupId: groupId,
      itemName: prompt
    };

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    const resData = await response.json();

    if (resData.errors) {
      console.error('Monday API Errors:', resData.errors);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create item on Monday.com', details: resData.errors })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reply: 'Logged! ⚡',
        item: resData.data.create_item
      })
    };
  } catch (error) {
    console.error('Chat function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
