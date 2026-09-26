const https = require('https');

// GLOBAL CORS HEADERS
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// HELPER: Send Webhook to Real Make.com Engine
function sendToEngine(payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const options = {
      hostname: 'hook.us2.make.com',
      path: '/nubq7q917ondi9xh88wggb250jwk7af1',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', () => resolve('Engine Bypass'));
    req.write(data);
    req.end();
  });
}

// HELPER: Create Real Monday.com Groups (Drawers) via API
function createMondayGroup(boardId, groupName, mondayToken) {
  return new Promise((resolve) => {
    const query = `mutation { create_group (board_id: ${boardId}, group_name: "${groupName}") { id } }`;
    const data = JSON.stringify({ query });
    const options = {
      hostname: 'api.monday.com',
      path: '/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': mondayToken,
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', () => resolve(null));
    req.write(data);
    req.end();
  });
}

// HELPER: Raw HTTPS Call to Gemini REST API (No SDK Dependency)
function callGeminiAPI(apiKey, systemInstruction, userPrompt, boardId) {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      contents: [
        {
          parts: [
            { text: `${systemInstruction}\nUser Action: ${userPrompt} (Board: ${boardId})` }
          ]
        }
      ]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const text = parsed.candidates[0].content.parts[0].text.trim();
          resolve(text);
        } catch (e) {
          resolve('Schwing! Logged! ⚡');
        }
      });
    });

    req.on('error', () => resolve('Schwing! Logged! ⚡'));
    req.write(payload);
    req.end();
  });
}

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: 'OK' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const data = JSON.parse(event.body || '{}');
    const userPrompt = data.prompt || 'Hello';
    const boardId = data.board_id || '18424728273';

    const isOwner = (boardId === '18424728273');
    const trimmedPrompt = userPrompt.trim();
    const isGreeting = /^(hello|hi|hey|good morning|gm)/i.test(trimmedPrompt);
    const isIntake = !isGreeting;

    // Fire Engine Webhook
    await sendToEngine({
      board_id: boardId,
      prompt: userPrompt,
      timestamp: new Date().toISOString(),
      is_owner: isOwner
    });

    // ROUTE 1 & 3: Owner Board Silent Tapulator Confirmations
    if (isOwner) {
      if (isIntake) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ reply: 'Schwing! Logged! ⚡', board_id: boardId })
        };
      }
      if (isGreeting) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ reply: 'Back at it Chief — what do we have?', board_id: boardId })
        };
      }
    }

    // ROUTE 2: Subscriber Onboarding — Builds REAL Monday.com Drawers
    if (boardId === 'new_visitor' || userPrompt.includes('Build my personal world')) {
      const defaultDrawers = ['Customers', 'Tasks & Brain Dumps', 'Shared Cards'];
      const mondayToken = process.env.MONDAY_API_KEY;

      if (mondayToken && boardId !== 'new_visitor') {
        for (const drawer of defaultDrawers) {
          await createMondayGroup(boardId, drawer, mondayToken);
        }
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          reply: 'Schwing! World built with 3 default drawers! ⚡',
          board_id: boardId,
          drawers: defaultDrawers
        })
      };
    }

    // Fallback Gemini REST Process for Subscriber Instances
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: 'Schwing! Logged! ⚡', board_id: boardId })
      };
    }

    const systemInstruction = `
      You are Fresh 🤵 — Digital Coordinator for TappyThing (Clean Environment LLC).
      Rules:
      1. Direct, punchy, 5th-grade clarity bullet point outputs.
      2. Return ultra-concise, silent confirmations under 6 words for board actions.
      3. Bake in Zig Ziglar sales warmth and Wayne's World retro humor.
      4. Never output speech synthesis or verbose chatter.
    `;

    const responseText = await callGeminiAPI(apiKey, systemInstruction, userPrompt, boardId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: responseText || 'Schwing! Logged! ⚡',
        board_id: boardId
      })
    };

  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: 'Schwing! Logged! ⚡' })
    };
  }
};
