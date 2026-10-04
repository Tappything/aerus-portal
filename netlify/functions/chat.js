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
    const { prompt, board_id } = JSON.parse(event.body || '{}');

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing prompt parameter' }),
      };
    }

    const targetBoardId = board_id || '18424728273';
    const groupId = classifyZone(prompt);

    const query = `
      mutation CreateItem($boardId: ID!, $groupId: String!, $itemName: String!) {
        create_item (board_id: $boardId, group_id: $groupId, item_name: $itemName) {
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
          boardId: targetBoardId,
          groupId: groupId,
          itemName: prompt,
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        reply: `⚡ Card Created: "${prompt}"`,
        groupId: groupId,
        itemId: result.data.create_item.id,
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

function classifyZone(text) {
  const lower = (text || '').toLowerCase();
  const cleaned = lower.replace(/^test\.?\s*/i, '').trim();

  const calendarWords = [
    'today', 'tomorrow', 'schedule', 'appointment', 'calendar',
    'pick up', 'pickup', 'service call', 'water test', 'consultation',
    'delivery', 'install', 'drop off', 'this morning', 'this afternoon',
    'at 2pm', 'at 3pm', 'at 7am', 'at 8am', 'at 9am', 'at 10am', 'at 11am'
  ];
  if (
    calendarWords.some(w => cleaned.includes(w)) ||
    /\d{1,2}:\d{2}/.test(cleaned)
  ) {
    return 'group_mm7maw66';
  }

  if (
    /\b(personal|bill|mortgage|car|home|family|pickleball|courthouse|llc|company|register|attorney|lawyer|filing|incorporate)\b/.test(cleaned)
  ) {
    return 'group_mm7mv0yv';
  }

  if (
    /\b(invoice|estimate|proposal|payment|pay|charge|quote|lead|prospect|customer)\b/.test(cleaned)
  ) {
    return 'group_mm7myd0b';
  }

  if (
    /\b(parts|order|desco|amazon|cord|hose|belt|filter|bag)\b/.test(cleaned)
  ) {
    return 'group_mm6bv2h0';
  }

  if (
    /\b(repair|bench|motor|vacuum|intake|diagnostic|oreck|kirby|machine|burnt|wire|overhaul|service|disposed)\b/.test(cleaned)
  ) {
    return 'group_mm7mfbre';
  }

  return 'group_mm7mfbre';
}
