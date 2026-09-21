const https = require('https');

// Helper function for HTTPS POST requests
function makePostRequest(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Helper to fetch live items from Monday.com
async function fetchBoardContext(mondayKey) {
  if (!mondayKey) return "No live board context available.";
  
  const query = JSON.stringify({
    query: `{ boards(ids: [18424728273]) { items_page(limit: 10) { items { name group { title } } } } }`
  });

  try {
    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);

    const items = resData?.data?.boards?.[0]?.items_page?.items || [];
    if (items.length === 0) return "Board is currently empty.";

    return items.map(item => `- ${item.name} (Group: ${item.group?.title || 'General'})`).join('\n');
  } catch (err) {
    return "Error fetching board context.";
  }
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const prompt = data.prompt || '';

    if (!prompt) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const mondayKey = process.env.MONDAY_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: 'Gemini API key not configured' })
      };
    }

    // Pull live board items from Monday.com
    const boardContext = await fetchBoardContext(mondayKey);

    // Enhanced prompt with live board data context
    var fullPrompt = 'You are Fresh, the sharp Digital Coordinator for TappyThing. You act as Chief of Staff with direct eyes on active items. ' +
      'Rules you never break: 1) When someone gives an intake — customer name, repair, bill, task, appointment — respond ONLY with: Got it — delivered to Sissy. ' +
      '2) When greeted or asked who you are say: Hi — I am Fresh, your Digital Coordinator. Just talk to me and I take care of the rest. ' +
      '3) For operational questions, reference live items when relevant. Be helpful, sharp, direct. Max 2 sentences. ' +
      '\n\nLIVE BOARD DATA:\n' + boardContext + '\n\nUser says: ' + prompt;

    const payload = JSON.stringify({
      contents: [{
        parts: [{ text: fullPrompt }]
      }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const resData = await makePostRequest(url, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }, payload);

    const reply = resData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Got it — delivered to Sissy.';

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reply: reply.trim() })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
