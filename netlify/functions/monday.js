const https = require('https');

exports.handler = async (event) => {
  const token = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY;
  const boardId = process.env.MONDAY_BOARD_ID;

  if (!token || !boardId) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Missing Monday API credentials." })
    };
  }

  const query = `query \{
     const query = "{ boards(ids: [" + boardId + "]) { groups { title items_page { items { id name column_values { title text } } } } } }";
      groups {
        title
        items_page {
          items {
            id
            name
            column_values {
              title
              text
            \}
          }
        }
      }
    }
  }`;

  const postData = JSON.stringify({ query });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.monday.com',
      path: '/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const groups = parsed.data?.boards?.[0]?.groups || [];
          const targetGroups = groups.filter(g =>
            g.title.toLowerCase().includes("bagdon") ||
            g.title.toLowerCase().includes("ready wall")
          );
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ groups: targetGroups })
          });
        } catch (e) {
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: e.message })
          });
        }
      });
    });

    req.on('error', (e) => {
      resolve({
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: e.message })
      });
    });

    req.write(postData);
    req.end();
  });
};
