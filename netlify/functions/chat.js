const https = require('https');

// Constant Webhook URL
const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/g6aw7r8759ar5jr5c7lnb6nvwnuuz67t';

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

// Helper to fetch live items from Monday.com with dynamic boardId target and optional group filtering
async function fetchBoardContext(mondayKey, boardId, groupFilter) {
  if (!mondayKey) return "No live board context available.";
  
  const targetBoard = boardId || '18424728273';
  const query = JSON.stringify({
    query: `{ boards(ids: [${targetBoard}]) { items_page(limit: 50) { items { name group { title } } } } }`
  });

  try {
    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);

    let items = resData?.data?.boards?.[0]?.items_page?.items || [];
    
    // Apply Group Filter if provided via URL/payload
    if (groupFilter) {
      const cleanGroup = groupFilter.toLowerCase().trim();
      items = items.filter(item => item.group?.title && item.group.title.toLowerCase().trim() === cleanGroup);
    }

    if (items.length === 0) return groupFilter ? `No items found in group: ${groupFilter}` : "Board is currently empty.";

    return items.map(item => `- ${item.name} (Group: ${item.group?.title || 'General'})`).join('\n');
  } catch (err) {
    return "Error fetching board context.";
  }
}

// Helper to archive Route 4 conversations to Monday.com
async function archiveConversationToMonday(mondayKey, prompt, reply) {
  if (!mondayKey) return;
  const boardId = 18424728273;
  const groupId = "group_mm6b65k2"; // Emailed items / archive group
  const itemName = prompt.substring(0, 80).replace(/"/g, '\\"').replace(/\n/g, ' ');

  // Mutation to create item in specified group
  const createItemMutation = JSON.stringify({
    query: `mutation { create_item (board_id: ${boardId}, group_id: "${groupId}", item_name: "${itemName}") { id } }`
  });

  try {
    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(createItemMutation)
    }, createItemMutation);

    const newItemId = resData?.data?.create_item?.id;

    if (newItemId && reply) {
      const cleanReply = reply.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const addUpdateMutation = JSON.stringify({
        query: `mutation { create_update (item_id: ${newItemId}, body: "${cleanReply}") { id } }`
      });

      await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(addUpdateMutation)
      }, addUpdateMutation);
    }
  } catch (err) {
    console.log('Conversation archive error:', err);
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

    const targetBoardId = data.board_id || '18424728273';
    const groupFilter = data.group || null; // Parses ?groups= parameter passed from client

    // Pull dynamic live board items from Monday.com (Filtered by group if specified)
    const boardContext = await fetchBoardContext(mondayKey, targetBoardId, groupFilter);

    // Pure-code Router
    const lower = prompt.toLowerCase().trim();
    const words = prompt.trim().split(/\s+/);
    const wordCount = words.length;

    // Strict command triggers
    const questionStarters = ['show','list','give','status'];
    const intakeWords = ['repair','fix','vacuum','dyson','oreck','electrolux','motor','belt','filter','parts','estimate','pickup','broken','service','tune'];

    const isQuestion = questionStarters.some(function(w){ return lower.startsWith(w); });
    const isIntake = wordCount <= 7 && intakeWords.some(function(w){ return lower.includes(w); });
    const isGreeting = lower === 'hello' || lower === 'hi' || lower.startsWith('hey');

    // ROUTE 1: GREETING
    if (isGreeting) { 
      return { 
        statusCode: 200, 
        headers: {"Access-Control-Allow-Origin":"*","Content-Type":"application/json"}, 
        body: JSON.stringify({ reply: 'Hi! I am Fresh, your pocket Chief of Staff. Just talk to me.' }) 
      }; 
    }

    // ROUTE 2: EXPLICIT BOARD STATUS COMMAND
    if (isQuestion) { 
      return { 
        statusCode: 200, 
        headers: {"Access-Control-Allow-Origin":"*","Content-Type":"application/json"}, 
        body: JSON.stringify({ reply: 'Here is your active board:\n' + boardContext }) 
      }; 
    }

    // ROUTE 3: SHORT FIELD INTAKE
    if (isIntake) { 
      const webhookPayload = JSON.stringify({ rawDump: prompt }); 
      makePostRequest(MAKE_WEBHOOK_URL, {'Content-Type':'application/json','Content-Length':Buffer.byteLength(webhookPayload)}, webhookPayload).catch(function(e){ console.log('Webhook error:',e); }); 
      return { 
        statusCode: 200, 
        headers: {"Access-Control-Allow-Origin":"*","Content-Type":"application/json"}, 
        body: JSON.stringify({ reply: 'Logged and firing to your board! Next?' }) 
      }; 
    }

    // ROUTE 4: BRAIN DUMP / CONVERSATION
    const systemInstruction = 'You are Fresh — the bold, decisive Chief of Staff powering TappyThing. Your job is to ACT not ask. When someone gives you anything — a task, an errand, a thought, a name — just confirm you logged it and move on. NEVER ask permission. NEVER offer to create sections. NEVER ask if they want something set up. Just say what you did in one punchy sentence and challenge them to give you more. Rotate your closing phrase between: What else? / Hit me. / Next? / Keep going! You decide where everything goes. The user trusts you. Act like it. Max 1-2 sentences always.';
    const fullPrompt = systemInstruction + ' User says: ' + prompt;

    const history = data.history || [];

    const contents = [
      ...history.map(function(h) {
        return {
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.text }]
        };
      }),
      { role: 'user', parts: [{ text: fullPrompt }] }
    ];

    const payload = JSON.stringify({
      contents: contents
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const resData = await makePostRequest(url, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }, payload);

    let reply = 'Fresh is on it...'; 
    try { 
      if (resData?.candidates?.[0]?.content?.parts?.[0]?.text) { 
        reply = resData.candidates[0].content.parts[0].text.trim(); 
      } else if (resData?.error?.message) { 
        reply = 'API Error: ' + resData.error.message; 
      } else { 
        reply = 'Raw: ' + JSON.stringify(resData).substring(0, 200); 
      } 
    } catch(e) { 
      reply = 'Parse error: ' + e.message; 
    }

    // ARCHIVE CONVERSATION TO MONDAY.COM (ASYNC BACKGROUND FIRE)
    archiveConversationToMonday(mondayKey, prompt, reply).catch(e => console.log('Archive task error:', e));

    // BRAIN DUMP PARSER — SPLITS ON COMMAS ONLY
    const commaPieces = prompt.split(',').map(function(item){ return item.trim(); }).filter(function(item){ return item.length > 2; });
    if (commaPieces.length > 1) {
      commaPieces.forEach(function(piece) {
        const clean = piece.replace(/^[-•*🔧✅📋📦🏠]\s*/,'').trim();
        if (clean.length > 2) {
          const wpLoad = JSON.stringify({ rawDump: clean });
          makePostRequest(MAKE_WEBHOOK_URL, {'Content-Type':'application/json','Content-Length':Buffer.byteLength(wpLoad)}, wpLoad).catch(function(e){ console.log('Dump webhook error:',e); });
        }
      });
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: null, reply: reply })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
