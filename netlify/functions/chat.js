const https = require('https');

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

// Helper to fetch live items from Monday.com with dynamic boardId target
async function fetchBoardContext(mondayKey, boardId) {
  if (!mondayKey) return "No live board context available.";
  
  const targetBoard = boardId || '18424728273';
  const query = JSON.stringify({
    query: `{ boards(ids: [${targetBoard}]) { items_page(limit: 10) { items { name group { title } } } } }`
  });

  try {
    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);

    const items = resData?.data?.boards?.[0]?.items_page?.items || [];
    if (items.length === 0) return "Board is currently empty.";

    return items.map(item => `- ${item.name} (Group: ${item.group?.title || 'General'})`).join('\n');
  } catch (err) {
    return "Error fetching board context.";
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

    // Pull dynamic live board items from Monday.com
    const boardContext = await fetchBoardContext(mondayKey, targetBoardId);

    // Pure-code Router
    const lower = prompt.toLowerCase().trim();
    const words = prompt.trim().split(/\s+/);
    const wordCount = words.length;

    // Strict command triggers only
    const questionStarters = ['show','list','give','status'];
    const intakeWords = ['repair','fix','vacuum','dyson','oreck','electrolux','motor','belt','filter','parts','estimate','pickup','broken','service','tune'];

    const isQuestion = questionStarters.some(function(w){ return lower.startsWith(w); });
    const isIntake = wordCount <= 7 && intakeWords.some(function(w){ return lower.includes(w); });
    const isGreeting = lower === 'hello' || lower === 'hi' || lower.startsWith('hey');

    // ------------------------------------------------------------------
    // YES DETECTION & PERMISSION-BASED GROUP SPAWNING
    // ------------------------------------------------------------------
    const history = data.history || [];
    const isYes = lower === 'yes' || lower === 'yeah' || lower === 'add it' || lower === 'do it' || lower === 'sure';

    if (isYes && history.length > 0) {
      const lastReply = history[history.length - 1].text || history[history.length - 1].parts?.[0]?.text || '';
      const groupMatch = lastReply.match(/I can create a (.+?) section/);

      if (groupMatch) {
        const groupToCreate = groupMatch[1];
        const gpPayload = JSON.stringify({
          boardId: targetBoardId,
          groupName: groupToCreate
        });

        await makePostRequest('https://freshtappything.com/.netlify/functions/create-group', {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(gpPayload)
        }, gpPayload).catch(function(e) {
          console.log('Group create error:', e);
        });

        return {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            reply: 'Done! Your ' + groupToCreate + ' section is live — check My World right now. What else is on your mind?'
          })
        };
      }
    }

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
      const webhookPayload = JSON.stringify({ body: prompt }); 
      makePostRequest('https://hook.us2.make.com/nubq7q917ondi9xh88wggb250jwk7af1', {'Content-Type':'application/json','Content-Length':Buffer.byteLength(webhookPayload)}, webhookPayload).catch(function(e){ console.log('Webhook error:',e); }); 
      return { 
        statusCode: 200, 
        headers: {"Access-Control-Allow-Origin":"*","Content-Type":"application/json"}, 
        body: JSON.stringify({ reply: 'Got it — delivered to Sissy.' }) 
      }; 
    }

    // ROUTE 4: BRAIN DUMP / CONVERSATION
    var systemInstruction = 'You are Fresh — the warm, confident Chief of Staff powering TappyThing. FIRST MESSAGE RULE: If the conversation history is empty, always open with this exact script before anything else: "Hi [use their name if given, or just Hi]! I am Fresh — your one place for everything. Work tasks, personal reminders, family stuff, follow ups — all in one spot. No more sticky notes, no more forgotten things. I am going to ask you a few things about your life. The more you tell me, the better I build your world. Let us start simple — what is your biggest daily headache right now?" AFTER FIRST MESSAGE: Respond with bold coach energy, under 3 sentences, ultra-punchy. Never auto-create drawers. Always ask permission first. Never mention Monday.com or board IDs.';
    var fullPrompt = systemInstruction + ' User says: ' + prompt;

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

    let reply = 'Fresh is thinking...'; 
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

    // BRAIN DUMP PARSER & INDIVIDUAL ITEM WEBHOOK TRIGGER
    const lines = prompt.split('\n').filter(function(l){ return l.trim().length > 5; });
    if(lines.length > 2){
      lines.forEach(function(line){
        const clean = line.replace(/^[-•*🔧✅📋📦🏠]\s*/,'').trim();
        if(clean.length > 5){
          const wpLoad = JSON.stringify({ body: clean });
          makePostRequest('https://hook.us2.make.com/nubq7q917ondi9xh88wggb250jwk7af1',{'Content-Type':'application/json','Content-Length':Buffer.byteLength(wpLoad)},wpLoad).catch(function(e){ console.log('Dump webhook error:',e); });
        }
      });
    }

    // PERMISSION-FIRST SUGGESTION (REPLACES AUTO-CREATION)
    const keywordGroups = [
      { keywords:['bill','bank','money','finance','financ'], group:'💰 Banking & Finance'},
      { keywords:['family','kids','children','husband','wife','son','daughter'], group:'👨‍👩‍👧 Family'},
      { keywords:['health','doctor','medicine','nurse','hospital','sick'], group:'🏥 Health'},
      { keywords:['home','house','chore','clean','repair home'], group:'🏠 Home Tasks'},
      { keywords:['work','job','business','client','customer','studio'], group:'💼 Business World'},
      { keywords:['private','personal','secret','vault'], group:'🔒 Private Vault'}
    ]; 

    const industryTemplates = [
      { keywords:['restaurant','cafe','food','kitchen','menu','table','waiter','dine'], groups:['🍽️ Tables & Reservations','📋 Orders & Kitchen','💰 Payments & Tips','🧑‍🍳 Staff Schedule','📦 Inventory & Supplies'] },
      { keywords:['property','landlord','tenant','rent','lease','apartment','unit','maintenance'], groups:['🏠 Properties','🔧 Maintenance Requests','💳 Rent Ledger','📞 Tenant Communications','📋 Lease Tracker'] },
      { keywords:['yoga','fitness','gym','trainer','class','studio','students','workout'], groups:['📅 Class Schedule','👥 Students','💰 Billing & Memberships','🧘 Curriculum','📣 Marketing'] },
      { keywords:['salon','hair','nails','beauty','spa','appointment','stylist'], groups:['📅 Appointments','💇 Services Menu','💰 Payments','👥 Client Cards','🛒 Product Inventory'] },
      { keywords:['retail','store','shop','inventory','product','sales','customer'], groups:['📦 Inventory','💰 Sales','👥 Customers','🚚 Orders & Shipping','📣 Marketing'] }
    ];

    let suggestedGroup = null;

    keywordGroups.forEach(function(kg){
      if(suggestedGroup) return;
      const matched = kg.keywords.some(function(kw){ return lower.includes(kw); });
      if(matched){
        suggestedGroup = kg.group;
      }
    });

    if(!suggestedGroup){
      industryTemplates.forEach(function(it){
        if(suggestedGroup) return;
        const matched = it.keywords.some(function(kw){ return lower.includes(kw); });
        if(matched){
          suggestedGroup = it.groups[0];
        }
      });
    }

    if(suggestedGroup){
      reply = reply + ' I can create a ' + suggestedGroup + ' section just for that — want me to add it now?';
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ reply: reply })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};
