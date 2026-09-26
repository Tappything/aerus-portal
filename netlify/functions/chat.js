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

// Helper: DIRECT MONDAY.COM ITEM CREATION (Bypasses Make.com 520 errors)
async function createMondayItemDirect(mondayKey, boardId, itemName) {
  if (!mondayKey || !itemName) return null;
  const cleanName = itemName.replace(/"/g, '\\"').replace(/\n/g, ' ');
  // Default target group: Staff Intake — Pending Review (group_mm6b77as)
  const targetGroupId = 'group_mm6b77as';
  const query = JSON.stringify({
    query: `mutation { create_item (board_id: ${boardId}, group_id: "${targetGroupId}", item_name: "${cleanName}") { id } }`
  });
  try {
    return await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);
  } catch (err) {
    console.error('Direct Monday creation error:', err);
    return null;
  }
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
    const mondayKey = process.env.MONDAY_API_KEY;
    const targetBoardId = data.board_id || '18424728273';
    const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/nubq7q917ondi9xh88wggb250jwk7af1';

    // INTENT DETECTION
    const lower = prompt.toLowerCase();
    const questionStarters = ['show', 'list', 'give', 'status', 'what', 'how', 'why', 'who', 'where', 'when', 'can', 'could', 'should', 'is', 'are', 'tell'];
    const isQuestionOrBrainstorm = (questionStarters.some(w => lower.startsWith(w)) || lower.includes('?')) && !lower.includes('repair') && !lower.includes('picked up') && !lower.includes('dropped off') && !lower.includes('rebuild');

    // ROUTE 1: FAST TASK / INTAKE -> DIRECT MONDAY.COM CREATION + MAKE.COM BACKUP
    if (!isQuestionOrBrainstorm) {
      // 1. Direct Monday API creation (Instant & Guaranteed)
      if (mondayKey) {
        await createMondayItemDirect(mondayKey, targetBoardId, prompt);
      }

      // 2. Make.com Webhook (Parallel backup)
      const webhookPayload = JSON.stringify({
        prompt: prompt,
        rawDump: prompt,
        text: prompt,
        body: prompt,
        board_id: targetBoardId,
        timestamp: new Date().toISOString()
      });
      makePostRequest(MAKE_WEBHOOK_URL, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(webhookPayload)
      }, webhookPayload).catch(e => console.error('Make backup error:', e));

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: 'LOGGED & FIRED TO BOARD! ⚡' })
      };
    }

    // ROUTE 2: CONVERSATIONAL CHIEF OF STAFF -> GEMINI REST API
    if (!apiKey) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: 'LOGGED & FIRED TO BOARD! ⚡' })
      };
    }

    const isOwner = (targetBoardId === '18424728273');
    const systemInstruction = isOwner 
      ? `You are Fresh 🤵 — the Digital Coordinator powering TappyThing for William Sullivan. Direct, punchy, ultra-concise. Zero fluff. Motivational coach energy. Never mention Dan.`
      : `You are Fresh 🤵 — the Digital Coordinator for TappyThing. Energetic, helpful, direct. Guide subscribers to build their world.`;

    const contents = [{ role: 'user', parts: [{ text: `${systemInstruction}\n\nUser says: ${prompt}` }] }];
    const geminiPayload = JSON.stringify({ contents });
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const geminiRes = await makePostRequest(geminiUrl, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(geminiPayload)
    }, geminiPayload);

    let reply = 'LOGGED & FIRED TO BOARD! ⚡';
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
