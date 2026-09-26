const https = require('https');

// Helper for native HTTPS POST requests
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
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Successful preflight' })
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const prompt = (data.prompt || '').trim();

    if (!prompt) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const targetBoardId = data.board_id || '18424728273';
    const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/nubq7q917ondi9xh88wggb250jwk7af1';

    // INTENT DETECTION ENGINE
    const lower = prompt.toLowerCase();
    const words = prompt.split(/\s+/);
    const wordCount = words.length;

    const questionStarters = ['show', 'list', 'give', 'status', 'what', 'how', 'why', 'who', 'where', 'when', 'can', 'could', 'should', 'is', 'are', 'tell'];
    const intakeKeywords = ['repair', 'fix', 'vacuum', 'dyson', 'oreck', 'electrolux', 'motor', 'belt', 'filter', 'parts', 'estimate', 'pickup', 'picked up', 'drop off', 'dropped off', 'broken', 'service', 'tune', 'rebuild', 'customer', 'invoice', 'paid', 'call', 'note', 'task', 'dave', 'peterson', 'mike', 'monday', 'belair', 'bel air'];

    const isQuestionOrBrainstorm = (questionStarters.some(w => lower.startsWith(w)) || lower.includes('?')) && !intakeKeywords.some(w => lower.includes(w));
    const isIntake = !isQuestionOrBrainstorm || wordCount <= 45 || intakeKeywords.some(w => lower.includes(w));

    // ROUTE 1: FAST SILENT INTAKE -> MAKE.COM WEBHOOK (UNIVERSAL PAYLOAD)
    if (isIntake) {
      const webhookPayload = JSON.stringify({
        prompt: prompt,
        rawDump: prompt,
        text: prompt,
        body: prompt,
        board_id: targetBoardId,
        timestamp: new Date().toISOString()
      });

      try {
        await makePostRequest(MAKE_WEBHOOK_URL, {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(webhookPayload)
        }, webhookPayload);
      } catch (err) {
        console.error('Webhook dispatch error:', err);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: 'Logged! ⚡' })
      };
    }

    // ROUTE 2: CONVERSATIONAL CHIEF OF STAFF -> GEMINI REST API
    if (!apiKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: 'Logged! ⚡' })
      };
    }

    const isOwner = (targetBoardId === '18424728273');

    const systemInstruction = isOwner 
      ? `You are Fresh 🤵 — the Digital Coordinator powering TappyThing for William Sullivan. Direct, punchy, ultra-concise. Zero fluff. Respond ONLY to the specific task or question. Motivational, fun, direct, and energetic coach energy. Draw from Ogilvy, Ziglar, Girard, Cardone as natural instinct. Never mention Dan. Never ask "Are we hanging up now?".`
      : `You are Fresh 🤵 — the Digital Coordinator for TappyThing. Energetic, helpful, direct. Guide subscribers to build their world in TappyThing. One card at a time, zero friction.`;

    const contents = [
      {
        role: 'user',
        parts: [{ text: `${systemInstruction}\n\nUser says: ${prompt}` }]
      }
    ];

    const geminiPayload = JSON.stringify({ contents });
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await makePostRequest(geminiUrl, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(geminiPayload)
    }, geminiPayload);

    let reply = 'Logged! ⚡';
    if (geminiRes?.candidates?.[0]?.content?.parts?.[0]?.text) {
      reply = geminiRes.candidates[0].content.parts[0].text.trim();
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: reply })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
🚀 Your 1 Action:
Open GitHub: Tappything/aerus-portal ➔ netlify/functions/chat.js
Replace everything with this code and commit to main.
