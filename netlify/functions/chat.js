const https = require('https');

// Constant Webhook URL for raw dumps
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
    query: `{ boards(ids: [${targetBoard}]) { items_page(limit: 50) { items { id name group { id title } } } } }`
  });

  try {
    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);

    let items = resData?.data?.boards?.[0]?.items_page?.items || [];
    
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

// Helper to create a new group on Monday.com board for self-building onboarding
async function createMondayGroup(mondayKey, boardId, groupName) {
  if (!mondayKey || !boardId || !groupName) return null;
  const cleanName = groupName.replace(/"/g, '\\"').replace(/\n/g, ' ');
  const mutation = JSON.stringify({
    query: `mutation { create_group (board_id: ${boardId}, group_name: "${cleanName}") { id title } }`
  });

  try {
    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(mutation)
    }, mutation);
    return resData?.data?.create_group;
  } catch (err) {
    console.log('Error creating group:', err);
    return null;
  }
}

// Helper to execute direct Monday.com actions based on dump commands
async function executeMondayCommand(mondayKey, boardId, line) {
  if (!mondayKey || !line) return;
  const lowerLine = line.toLowerCase();
  
  try {
    const query = JSON.stringify({
      query: `{ boards(ids: [${boardId}]) { items_page(limit: 100) { items { id name group { id title } } } groups { id title } } }`
    });

    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);

    const board = resData?.data?.boards?.[0];
    const items = board?.items_page?.items || [];
    const groups = board?.groups || [];

    const lineWords = lowerLine.split(/\s+/).filter(w => w.length > 4);
    const targetItem = items.find(item => {
      const itemNameLower = item.name.toLowerCase();
      return lowerLine.includes(itemNameLower) || lineWords.some(word => itemNameLower.includes(word));
    });

    // ACTION: DELETE / REMOVE
    if ((lowerLine.includes('delete') || lowerLine.includes('remove')) && targetItem) {
      const deleteMutation = JSON.stringify({
        query: `mutation { delete_item (item_id: ${targetItem.id}) { id } }`
      });
      await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(deleteMutation)
      }, deleteMutation);
      return;
    }

    // ACTION: MOVE GROUP / ARCHIVE
    if ((lowerLine.includes('move') || lowerLine.includes('archive')) && targetItem) {
      let targetGroup = lowerLine.includes('archive') 
        ? { id: 'group_mm6xs2fx' }
        : groups.find(g => lowerLine.includes(g.title.toLowerCase()));

      if (targetGroup) {
        const moveMutation = JSON.stringify({
          query: `mutation { move_item_to_group (item_id: ${targetItem.id}, group_id: "${targetGroup.id}") { id } }`
        });
        await makePostRequest('https://api.monday.com/v2', {
          'Content-Type': 'application/json',
          'Authorization': mondayKey,
          'API-Version': '2023-10',
          'Content-Length': Buffer.byteLength(moveMutation)
        }, moveMutation);
        return;
      }
    }

    // ACTION: MARK AS / STATUS UPDATE
    if ((lowerLine.includes('mark as') || lowerLine.includes('status')) && targetItem) {
      const statusParts = line.split(/as|status/i);
      const newStatus = statusParts.length > 1 ? statusParts[1].trim() : 'Done';
      const columnValues = JSON.stringify({ project_status: { label: newStatus } });

      const statusMutation = JSON.stringify({
        query: `mutation { change_column_values (board_id: ${boardId}, item_id: ${targetItem.id}, column_values: ${JSON.stringify(columnValues)}) { id } }`
      });

      await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(statusMutation)
      }, statusMutation);
      return;
    }

    // ACTION: ADD NOTE / UPDATE / CALL / TAG
    if ((lowerLine.includes('note') || lowerLine.includes('call') || lowerLine.includes('tag')) && targetItem) {
      const cleanNote = line.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const updateMutation = JSON.stringify({
        query: `mutation { create_update (item_id: ${targetItem.id}, body: "${cleanNote}") { id } }`
      });
      await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(updateMutation)
      }, updateMutation);
      return;
    }
  } catch (err) {
    console.log('Command execution error:', err);
  }
}

// Helper to archive Route 4 conversations to Monday.com
async function archiveConversationToMonday(mondayKey, prompt, reply) {
  if (!mondayKey) return;
  const boardId = 18424728273;
  const groupId = "group_mm6b65k2";
  const itemName = prompt.substring(0, 80).replace(/"/g, '\\"').replace(/\n/g, ' ');

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
    const groupFilter = data.group || null;

    const boardContext = await fetchBoardContext(mondayKey, targetBoardId, groupFilter);

    const lower = prompt.toLowerCase().trim();
    const words = prompt.trim().split(/\s+/);
    const wordCount = words.length;

    const questionStarters = ['show','list','give','status'];
    const intakeWords = ['repair','fix','vacuum','dyson','oreck','electrolux','motor','belt','filter','parts','estimate','pickup','broken','service','tune'];

    const isQuestion = questionStarters.some(w => lower.startsWith(w));
    const isIntake = wordCount <= 7 && intakeWords.some(w => lower.includes(w));
    const isGreeting = lower === 'hello' || lower === 'hi' || lower.startsWith('hey');

    // ROUTE 1 GREETING — DYNAMIC RESPONSE BASED ON BOARD ID
    if (isGreeting) { 
      const greetingReply = (targetBoardId === '18424728273') 
        ? 'Back at it Chief — what do we have?' 
        : "Welcome to TappyThing! Let's build your world. First question: What's the first thing you deal with every morning at work?";
      
      return { 
        statusCode: 200, 
        headers: {"Access-Control-Allow-Origin":"*","Content-Type":"application/json"}, 
        body: JSON.stringify({ reply: greetingReply }) 
      }; 
    }

    if (isQuestion) { 
      return { 
        statusCode: 200, 
        headers: {"Access-Control-Allow-Origin":"*","Content-Type":"application/json"}, 
        body: JSON.stringify({ reply: 'Here is your active board:\n' + boardContext }) 
      }; 
    }

    if (isIntake) { 
      // ONLY FIRE MAKE.COM WEBHOOK FOR OWNER BOARD (18424728273)
      if (targetBoardId === '18424728273') {
        const webhookPayload = JSON.stringify({ rawDump: prompt }); 
        makePostRequest(MAKE_WEBHOOK_URL, {'Content-Type':'application/json','Content-Length':Buffer.byteLength(webhookPayload)} , webhookPayload).catch(e => console.log('Webhook error:', e)); 
      }
      return { 
        statusCode: 200, 
        headers: {"Access-Control-Allow-Origin":"*","Content-Type":"application/json"}, 
        body: JSON.stringify({ reply: 'Logged and firing to your board! Next?' }) 
      }; 
    }

    // SUBSCRIBER SELF-BUILDING ONBOARDING vs OWNER ROUTE
    if (targetBoardId !== '18424728273' && mondayKey) {
      // 1. Fetch group count to see where they are in the 5-question sequence
      const boardQuery = JSON.stringify({
        query: `{ boards(ids: [${targetBoardId}]) { groups { id title } } }`
      });

      const boardRes = await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(boardQuery)
      }, boardQuery);

      const existingGroups = boardRes?.data?.boards?.[0]?.groups || [];
      const currentDrawerCount = existingGroups.length;

      // 2. Create group from user's response
      if (currentDrawerCount < 5) {
        await createMondayGroup(mondayKey, targetBoardId, prompt);
      }

      // 3. Ask next question based on updated drawer count
      const updatedCount = currentDrawerCount + 1;
      let onboardingReply = "";

      if (updatedCount === 1) {
        onboardingReply = "Got it, created that drawer on your board! Question 2: What's the second core activity or bucket of work in your day?";
      } else if (updatedCount === 2) {
        onboardingReply = "Boom! Second drawer added. Question 3: What's the third type of task or job you manage?";
      } else if (updatedCount === 3) {
        onboardingReply = "Solid! Third drawer live. Question 4: What is the fourth drawer we need for your team, orders, or follow-ups?";
      } else if (updatedCount === 4) {
        onboardingReply = "Almost there! Question 5: What's the final drawer for ready items, pickups, or completed jobs?";
      } else {
        onboardingReply = "BOOM! Your 5 core drawers are live! Your world is officially built. Tap the button anytime to drop raw voice notes, customers, or tasks into your cards. Hit me!";
      }

      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ reply: onboardingReply })
      };
    }

    // SYSTEM INSTRUCTION FOR ROUTE 4 CONVERSATION (OWNER BOARD)
    const systemInstruction = 'If the board_id is 18424728273 you are talking to William — the owner and founder. Skip all onboarding. Never introduce yourself. Never ask his name or what he does. Just respond as his trusted Chief of Staff who knows everything. Treat every message as a continuation of an ongoing conversation. You are Fresh — the bold, decisive Digital Coordinator powering TappyThing. Your job is to ACT not ask. When someone gives you anything — a task, an errand, a thought, a name, or a business description — confirm you logged it, show how it structures into Tappy Cards, and move on. NEVER ask permission. NEVER offer to create sections. NEVER ask if they want something set up. Just say what you did in 1-2 punchy sentences max. Rotate your closing phrase between: What else? / Hit me. / Next? / Keep going! Max 2 sentences always.';
    
    const fullPrompt = systemInstruction + ' User says: ' + prompt;
    const history = data.history || [];

    const contents = [
      ...history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.text }]
      })),
      { role: 'user', parts: [{ text: fullPrompt }] }
    ];

    const payload = JSON.stringify({ contents: contents });
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

    archiveConversationToMonday(mondayKey, prompt, reply).catch(e => console.log('Archive task error:', e));

    // MIXED DUMP SPLITTER & SINGLE ITEM HANDLING — ONLY FIRE MAKE.COM FOR OWNER BOARD
    const lineItems = prompt.split(/\n|,/).map(item => item.trim()).filter(item => item.length > 2);
    const actionKeywords = ['delete', 'archive', 'move', 'add note', 'mark as', 'status', 'call', 'tag', 'remove', 'mark'];

    if (lineItems.length > 0) {
      lineItems.forEach(line => {
        const clean = line.replace(/^[-•*🔧✅📋📦🏠]\s*/,'').trim();
        if (clean.length > 2) {
          const isCommandLine = actionKeywords.some(kw => clean.toLowerCase().includes(kw));

          if (isCommandLine) {
            executeMondayCommand(mondayKey, targetBoardId, clean).catch(e => console.log('Command exec error:', e));
          } else if (targetBoardId === '18424728273') {
            const wpLoad = JSON.stringify({ rawDump: clean });
            makePostRequest(MAKE_WEBHOOK_URL, {'Content-Type':'application/json','Content-Length':Buffer.byteLength(wpLoad)} , wpLoad).catch(e => console.log('Dump webhook error:', e));
          }
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
