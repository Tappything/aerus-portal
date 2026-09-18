const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const prompt = body.prompt || body.message || '';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: "API key missing." })
      };
    }

    const fullPrompt = "You are Fresh 🤵 — a sharp, intelligent AI business coordinator for TappyThing, created by William Sullivan. You help small business owners solve real problems, stay organized, and move fast. Be conversational, specific, and genuinely helpful. Give real thoughtful answers. Never use catchphrases or canned responses.\n\nUser message: " + prompt;

    const postData = JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: { temperature: 0.9, maxOutputTokens: 500 }
    });

    return new Promise((resolve) => {
      const req = https.request({
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/gemini-3.6-flash:generateContent?key=' + apiKey,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const reply = parsed.candidates[0].content.parts[0].text;
            resolve({
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reply: reply.trim() })
            });
          } catch(e) {
            resolve({
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reply: "DEBUG: " + data.substring(0, 300) })
            });
          }
        });
      });
      req.on('error', (e) => {
        resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reply: "ERROR: " + e.message })
        });
      });
      req.write(postData);
      req.end();
    });

  } catch(err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: "CATCH: " + err.message })
    };
  }
};
Only thing that changed — gemini-2.0-flash → gemini-3.6-flash
