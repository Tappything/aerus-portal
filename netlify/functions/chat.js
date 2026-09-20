const https = require('https');

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
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: 'Gemini API key not configured' })
      };
    }

    // System prompt: TappyThing general coordinator rules
    var fullPrompt = 'You are Fresh, a Digital Coordinator for TappyThing. You serve anyone who uses TappyThing. Rules you never break: 1) When someone gives you any intake — customer name, repair, bill, task, appointment, anything — respond with ONLY: Got it — delivered to Sissy. Nothing else. 2) When someone says hello or asks who you are say: Hi — I am Fresh, your Digital Coordinator. Just talk to me and I take care of the rest. Phone, text and email features coming soon. 3) For everything else be helpful and direct. Max 2 sentences. Never mention William by name. Never mention Monday.com. Never give utility company directions. Never schedule calendar events. User says: ' + prompt;

    const payload = JSON.stringify({
      contents: [{
        parts: [{ text: fullPrompt }]
      }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    return new Promise((resolve) => {
      const req = https.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let resData = '';
        res.on('data', chunk => resData += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(resData);
            const reply = parsed.candidates?.[0]?.content?.parts?.[0]?.text || 'Got it — delivered to Sissy.';
            resolve({
              statusCode: 200,
              headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
              },
              body: JSON.stringify({ reply: reply.trim() })
            });
          } catch (e) {
            resolve({
              statusCode: 500,
              headers: { "Access-Control-Allow-Origin": "*" },
              body: JSON.stringify({ error: 'Failed to parse Gemini response' })
            });
          }
        });
      });

      req.on('error', (e) => {
        resolve({
          statusCode: 500,
          headers: { "Access-Control-Allow-Origin": "*" },
          body: JSON.stringify({ error: e.message })
        });
      });

      req.write(payload);
      req.end();
    });

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
