// Netlify serverless function to fetch item names from a Monday.com board
// Assumes Node 18+ on Netlify so global.fetch is available and MONDAY_API_KEY is set in env.
const fetch = global.fetch;

const MONDAY_API_URL = 'https://api.monday.com/v2';
const BOARD_ID = 18424728273;

exports.handler = async function (event, context) {
  const query = `
    query {
      boards(ids: ${BOARD_ID}) {
        items {
          name
        }
      }
    }
  `;

  try {
    const res = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.MONDAY_API_KEY}`
      },
      body: JSON.stringify({ query })
    });

    const payload = await res.json();

    if (!res.ok || payload.errors) {
      const msg = payload.errors ? JSON.stringify(payload.errors) : `HTTP ${res.status}`;
      throw new Error(`Failed to fetch Monday board items: ${msg}`);
    }

    const items =
      (payload.data &&
        payload.data.boards &&
        payload.data.boards[0] &&
        Array.isArray(payload.data.boards[0].items)
        ? payload.data.boards[0].items
        : []
      ).map(item => ({ name: item.name }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // allow browser requests; adjust for production
      },
      body: JSON.stringify({ items })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message || 'Unknown error' })
    };
  }
};
