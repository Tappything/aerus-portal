exports.handler = async (event) => {
  const token = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY;
  const boardId = process.env.MONDAY_BOARD_ID;

  if (!token || !boardId) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Missing Monday API credentials in Netlify settings." })
    };
  }

  const query = `query {
    boards(ids: [${boardId}]) {
      groups {
        title
        items_page {
          items {
            id
            name
            column_values {
              title
              text
            }
          }
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": token,
        "API-Version": "2023-10"
      },
      body: JSON.stringify({ query })
    });

    const data = await res.json();
    const groups = data.data?.boards?.[0]?.groups || [];
    
    // Filter specifically for Bagdons Queue and Ready Wall
    const targetGroups = groups.filter(g => 
      g.title.toLowerCase().includes("bagdon") || 
      g.title.toLowerCase().includes("ready wall")
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups: targetGroups })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
