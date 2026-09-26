const https = require('https');

// HELPER 1: CREATE MONDAY GROUP VIA GRAPHQL MUTATION
function createMondayGroup(boardId, groupName, apiKey) {
  return new Promise((resolve, reject) => {
    const query = `mutation { create_group (board_id: ${boardId}, group_name: "${groupName}") { id } }`;
    const postData = JSON.stringify({ query });

    const req = https.request('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });

    req.on('error', (e) => resolve(null));
    req.write(postData);
    req.end();
  });
}

// HELPER 2: CALL GEMINI REST API DIRECTLY (NO SDK)
function callGeminiRest(promptText, apiKey) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({
      system_instruction: {
        parts: [{ text: "You are Fresh, Pocket Chief of Staff for TappyThing. Ultra-concise responses under 6 words." }]
      },
      contents: [{ parts: [{ text: promptText }] }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const reply = parsed.candidates[0].content.parts[0].text.trim();
          resolve(reply);
        } catch (e) {
          resolve('Logged! ⚡');
        }
      });
    });

    req.on('error', () => resolve('Logged! ⚡'));
    req.write(postData);
    req.end();
  });
}

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'CORS Preflight OK' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const promptText = body.prompt || 'Empty intake';
    const boardId = body.board_id || '18424728273';
    const isOwnerBoard = (boardId === '18424728273');

    // 1. FIRE MAKE.COM WEBHOOK IN PARALLEL
    const webhookData = JSON.stringify({ prompt: promptText, board_id: boardId, timestamp: new Date().toISOString() });
    const webhookReq = https.request('https://hook.us2.make.com/nubq7q917ondi9xh88wggb250jwk7af1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(webhookData) }
    });
    webhookReq.on('error', (e) => console.error('Webhook error:', e));
    webhookReq.write(webhookData);
    webhookReq.end();

    // 2. SUBSCRIBER ONBOARDING ROUTE (NON-OWNER BOARDS)
    if (!isOwnerBoard && promptText.includes('Build my personal world')) {
      const mondayApiKey = process.env.MONDAY_API_KEY || '';
      if (mondayApiKey) {
        await createMondayGroup(boardId, 'Customers', mondayApiKey);
        await createMondayGroup(boardId, 'Tasks & Brain Dumps', mondayApiKey);
        await createMondayGroup(boardId, 'Shared Cards', mondayApiKey);
      }
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: 'Personal world created! ⚡', drawers: ['Customers', 'Tasks & Brain Dumps', 'Shared Cards'] })
      };
    }

    // 3. OWNER BOARD CONFIRMATION OR SUBSCRIBER GEMINI FALLBACK
    let finalReply = 'Logged! ⚡';
    if (!isOwnerBoard && process.env.GEMINI_API_KEY) {
      finalReply = await callGeminiRest(promptText, process.env.GEMINI_API_KEY);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: finalReply })
    };
  } catch (error) {
    console.error('Chat error:', error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: 'Logged! ⚡' })
    };
  }
};
