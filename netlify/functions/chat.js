const https = require('https');

// Constant Webhook URL for raw dumps — ONLY fires for William's board
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

// Helper to fetch live items from Monday.com
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

// Helper to create a new group on Monday.com board
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

// Helper to delete a group on Monday.com board
async function deleteMondayGroup(mondayKey, boardId, groupId) {
  if (!mondayKey || !boardId || !groupId) return null;
  const mutation = JSON.stringify({
    query: `mutation { delete_group (board_id: ${boardId}, group_id: "${groupId}") { id } }`
  });
  try {
    await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(mutation)
    }, mutation);
  } catch (err) {
    console.log('Error deleting group:', err);
  }
}

// Helper to create a new item inside a specific Monday.com group
async function createMondayItemInGroup(mondayKey, boardId, groupId, itemName) {
  if (!mondayKey || !boardId || !groupId || !itemName) return null;
  const cleanName = itemName.replace(/"/g, '\\"').replace(/\n/g, ' ');
  const mutation = JSON.stringify({
    query: `mutation { create_item (board_id: ${boardId}, group_id: "${groupId}", item_name: "${cleanName}") { id } }`
  });
  try {
    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(mutation)
    }, mutation);
    return resData?.data?.create_item;
  } catch (err) {
    console.log('Error creating item in group:', err);
    return null;
  }
}

// Helper to execute direct Monday.com actions
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
    if ((lowerLine.includes('delete') || lowerLine.includes('remove')) && targetItem) {
      const deleteMutation = JSON.stringify({ query: `mutation { delete_item (item_id: ${targetItem.id}) { id } }` });
      await makePostRequest('https://api.monday.com/v2', { 'Content-Type': 'application/json', 'Authorization': mondayKey, 'API-Version': '2023-10', 'Content-Length': Buffer.byteLength(deleteMutation) }, deleteMutation);
      return;
    }
    if ((lowerLine.includes('move') || lowerLine.includes('archive')) && targetItem) {
      let targetGroup = lowerLine.includes('archive') ? { id: 'group_mm6xs2fx' } : groups.find(g => lowerLine.includes(g.title.toLowerCase()));
      if (targetGroup) {
        const moveMutation = JSON.stringify({ query: `mutation { move_item_to_group (item_id: ${targetItem.id}, group_id: "${targetGroup.id}") { id } }` });
        await makePostRequest('https://api.monday.com/v2', { 'Content-Type': 'application/json', 'Authorization': mondayKey, 'API-Version': '2023-10', 'Content-Length': Buffer.byteLength(moveMutation) }, moveMutation);
        return;
      }
    }
    if ((lowerLine.includes('note') || lowerLine.includes('call') || lowerLine.includes('tag')) && targetItem) {
      const cleanNote = line.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const updateMutation = JSON.stringify({ query: `mutation { create_update (item_id: ${targetItem.id}, body: "${cleanNote}") { id } }` });
      await makePostRequest('https://api.monday.com/v2', { 'Content-Type': 'application/json', 'Authorization': mondayKey, 'API-Version': '2023-10', 'Content-Length': Buffer.byteLength(updateMutation) }, updateMutation);
      return;
    }
  } catch (err) {
    console.log('Command execution error:', err);
  }
}

// Helper to archive conversations to Monday.com
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
    const isGreeting = lower === 'hello' || lower === 'hi' || lower.startsWith('hey') || lower === 'introduce yourself';

    // ROUTE 1: GREETING
    if (isGreeting) {
      const greetingReply = (targetBoardId === '18424728273')
        ? 'Back at it Chief — what do we have?'
        : "Hey! I am Fresh — your Digital Coordinator with TappyThing. Tell me your name and what you do.";
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
      if (targetBoardId === '18424728273') {
        const webhookPayload = JSON.stringify({ rawDump: prompt });
        makePostRequest(MAKE_WEBHOOK_URL, {'Content-Type':'application/json','Content-Length':Buffer.byteLength(webhookPayload)}, webhookPayload).catch(e => console.log('Webhook error:', e));
      }
      return {
        statusCode: 200,
        headers: {"Access-Control-Allow-Origin":"*","Content-Type":"application/json"},
        body: JSON.stringify({ reply: 'Logged and firing to your board! Next?' })
      };
    }

    // ROUTE 2: SUBSCRIBER ONBOARDING — DEMO FIRST THEN BUILD
    if (targetBoardId !== '18424728273' && mondayKey) {
      const boardQuery = JSON.stringify({
        query: `{ boards(ids: [${targetBoardId}]) { groups { id title } items_page(limit: 50) { items { id name group { id } } } } }`
      });
      const boardRes = await makePostRequest('https://api.monday.com/v2', {
        'Content-Type': 'application/json',
        'Authorization': mondayKey,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(boardQuery)
      }, boardQuery);

      const boardData = boardRes?.data?.boards?.[0];
      const existingGroups = boardData?.groups || [];
      const existingItems = boardData?.items_page?.items || [];

      // DEMO SEQUENCE — empty board gets 3 demo cards
      if (existingGroups.length === 0) {
        const g1 = await createMondayGroup(mondayKey, targetBoardId, 'Home Depot — Dirt for Plants');
        const g2 = await createMondayGroup(mondayKey, targetBoardId, 'Grocery Store — Fruit');
        const g3 = await createMondayGroup(mondayKey, targetBoardId, 'Pickleball — Saturday 10am Riverside Courts');

        // Wait 2 seconds then delete the demo cards — clean slate
        setTimeout(async () => {
          if (g1?.id) await deleteMondayGroup(mondayKey, targetBoardId, g1.id);
          if (g2?.id) await deleteMondayGroup(mondayKey, targetBoardId, g2.id);
          if (g3?.id) await deleteMondayGroup(mondayKey, targetBoardId, g3.id);
        }, 8000);

        return {
          statusCode: 200,
          headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
          body: JSON.stringify({
            reply: "See those three cards? First one — share with your husband, he goes to Home Depot, gets the dirt, done. Second — share with your son, he handles the grocery run. Third — Pickleball Saturday — share with ten friends, they RSVP through the card, you see who is coming. One card. One person. Another card. Another person. One card. Ten people. All connected. Two way. Organized. Now watch — Clean slate. THAT is TappyThing. What do you want to build first — personal, business, or customers? I will hold your hand the whole way."
          })
        };
      }

      // AFTER DEMO — Gemini builds their real world
      const nonOwnerSystemInstruction = `You are Fresh — the Digital Coordinator for TappyThing. You are smart, energetic, and genuinely helpful. You know everything about TappyThing. TappyThing turns voice into live cards. Each card represents a person, a job, a customer, a task, or anything. Cards can have cards inside them. Every card can be shared with one person or thousands by text or email. People talk back through the card in real time. The owner sees everything. Each person only sees their piece. Brain dumps go straight into cards automatically. No forms. No typing. Just talk. TappyThing also handles invoicing on the fly and eliminates email chains. It works for any business — restaurants, repair shops, real estate, retail, home services, medical offices, schools, families. Always be warm, energetic, and human. Never robotic. Never use bullet points. Talk like a real person. Build their world naturally through conversation by creating Monday groups and items based on what they tell you.`;

      const fullPrompt = nonOwnerSystemInstruction + ' User says: ' + prompt;
      const history = data.history || [];
      const contents = [
        ...history.map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.text }]
        })),
        { role: 'user', parts: [{ text: fullPrompt }] }
      ];

      // Build world based on what they say
      if (existingItems.length === 0 && existingGroups.length > 0) {
        const firstGroupId = existingGroups[0].id;
        await createMondayItemInGroup(mondayKey, targetBoardId, firstGroupId, prompt);
      } else if (existingGroups.length > 0) {
        const lowerPrompt = prompt.toLowerCase();
        if (lowerPrompt.includes('drawer') || lowerPrompt.includes('add') || lowerPrompt.includes('create') || lowerPrompt.includes('new')) {
          await createMondayGroup(mondayKey, targetBoardId, prompt);
        } else {
          const latestGroupId = existingGroups[existingGroups.length - 1].id;
          await createMondayItemInGroup(mondayKey, targetBoardId, latestGroupId, prompt);
        }
      }

      const payload = JSON.stringify({ contents });
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const resData = await makePostRequest(url, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }, payload);

      let onboardingReply = 'Fresh is on it...';
      if (resData?.candidates?.[0]?.content?.parts?.[0]?.text) {
        onboardingReply = resData.candidates[0].content.parts[0].text.trim();
      }

      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({ reply: onboardingReply })
      };
    }

    // ROUTE 3: WILLIAM'S BOARD — CHIEF OF STAFF MODE
    const systemInstruction = 'You are talking to William — the owner and founder of TappyThing. Skip all onboarding. Never introduce yourself. Just respond as his trusted Chief of Staff. You are Fresh — bold, decisive Digital Coordinator. ACT not ask. Confirm you logged it in 1-2 punchy sentences max. Rotate closing phrase: What else? / Hit me. / Next? / Keep going!';
    const fullPrompt = systemInstruction + ' User says: ' + prompt;
    const history = data.history || [];
    const contents = [
      ...history.map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.text }]
      })),
      { role: 'user', parts: [{ text: fullPrompt }] }
    ];

    const payload = JSON.stringify({ contents });
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
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

    // MAKE.COM WEBHOOK — ONLY FOR WILLIAM'S BOARD
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
            makePostRequest(MAKE_WEBHOOK_URL, {'Content-Type':'application/json','Content-Length':Buffer.byteLength(wpLoad)}, wpLoad).catch(e => console.log('Dump webhook error:', e));
          }
        }
      });
    }

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
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
