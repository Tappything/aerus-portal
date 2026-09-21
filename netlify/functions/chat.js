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

    // System prompt update: Sissy brain logic with board context
    var fullPrompt = 'You are Sissy, the intelligent brain behind TappyThing. You serve William Sullivan at Aerus Home Wellness. You have live access to his board data shown below. Rules: ' +
      '1) When someone gives an intake — a person name with a service, repair, bill or task — respond ONLY: Got it — delivered to Sissy. ' +
      '2) When asked a question about the board, schedule, customers or business — answer intelligently using live board data. ' +
      '3) For personal tasks like bills or health — respond: Got it — added to your Personal World. ' +
      '4) For stress or overwhelm — respond with calm support and one action step. ' +
      '5) Be sharp, warm, direct. Max 2 sentences. Never mention Monday.com.' +
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

    const reply = resData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Got it — delivered to Sissy.';

    // Server-side Webhook Trigger: If response contains "Got it", fire to Make.com
    if (reply.indexOf('Got it') !== -1) {
      const webhookUrl = 'https://hook.us2.make.com/nubq7q917ondi9xh88wggb250jwk7af1';
      const webhookPayload = JSON.stringify({ body: prompt });
      
      makePostRequest(webhookUrl, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(webhookPayload)
      }, webhookPayload).catch(e => console.log('Server Webhook Error:', e));
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reply: reply })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
