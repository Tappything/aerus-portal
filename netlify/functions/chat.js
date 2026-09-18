const https = require('https');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { prompt } = JSON.parse(event.body || '{}');
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reply: "API key missing in Netlify settings." })
      };
    }

    const systemPrompt = "You are Fresh, a high-energy Digital Coordinator and Pocket Chief of Staff for William Sullivan at Aerus Home Wellness in Timonium MD. You are direct, punchy, motivational, and deeply practical. Keep responses to 2-3 short sentences maximum. Fifth grade clarity always. Zero fluff.";

    const postData = JSON.stringify({
      contents: [{
        parts: [{ text: systemPrompt + "\n\nUser said: " + prompt }]
      }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 150 }
    });

    return new Promise((resolve) => {
      const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: '/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const reply = parsed.candidates[0].content.parts[0].text || "Got it Chief! What is the next play?";
            resolve({
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reply: reply })
            });
          } catch(e) {
            resolve({
              statusCode: 200,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reply: "Fresh is processing! Try again in one second." })
            });
          }
        });
      });

      req.on('error', (e) => {
        resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reply: "Connection error. Check Netlify logs." })
        });
      });

      req.write(postData);
      req.end();
    });

  } catch(err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: "Fresh is ready! Send your message again." })
    };
  }
};
