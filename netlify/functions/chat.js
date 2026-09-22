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
    var systemInstruction = 'You are Fresh — the warm, sharp, confident Chief of Staff powering TappyThing. When a subscriber brain dumps about their life or business, respond with bold coach energy and total clarity. Never ask timid questions; make confident, benefit-focused statements that prove you are taking admin chaos off their plate. Instantly announce what live drawers or action items were created from their words, point them directly to their open board, and challenge them to hit the mic with their next thought. Never preach or show raw board code. Keep every response under 3 sentences max, ultra-punchy, human, and high-energy.';
    var fullPrompt = systemInstruction + ' User says: ' + prompt;

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

    // AUTOMATIC KEYWORD DETECT & GROUP CREATION TRIGGER
    const keywordGroups = [
      { keywords:['bill','bank','money','finance','financ'], group:'💰 Banking & Finance'},
      { keywords:['family','kids','children','husband','wife','son','daughter'], group:'👨‍👩‍👧 Family'},
      { keywords:['health','doctor','medicine','nurse','hospital','sick'], group:'🏥 Health'},
      { keywords:['home','house','chore','clean','repair home'], group:'🏠 Home Tasks'},
      { keywords:['work','job','business','client','customer','studio'], group:'💼 Business World'},
      { keywords:['private','personal','secret','vault'], group:'🔒 Private Vault'}
    ]; 

    keywordGroups.forEach(function(kg){ 
      const matched = kg.keywords.some(function(kw){ return lower.includes(kw); }); 
      if(matched){ 
        const gpPayload = JSON.stringify({ boardId: targetBoardId, groupName: kg.group }); 
        makePostRequest('https://freshtappything.com/.netlify/functions/create-group', {'Content-Type':'application/json','Content-Length':Buffer.byteLength(gpPayload)}, gpPayload).catch(function(e){ console.log('Group create error:',e); }); 
      } 
    });

    // INDUSTRY TEMPLATES AUTO-CASCADE BLOCK
    const industryTemplates = [
      { keywords:['restaurant','cafe','food','kitchen','menu','table','waiter','dine'], groups:['🍽️ Tables & Reservations','📋 Orders & Kitchen','💰 Payments & Tips','🧑‍🍳 Staff Schedule','📦 Inventory & Supplies'] },
      { keywords:['property','landlord','tenant','rent','lease','apartment','unit','maintenance'], groups:['🏠 Properties','🔧 Maintenance Requests','💳 Rent Ledger','📞 Tenant Communications','📋 Lease Tracker'] },
      { keywords:['yoga','fitness','gym','trainer','class','studio','students','workout'], groups:['📅 Class Schedule','👥 Students','💰 Billing & Memberships','🧘 Curriculum','📣 Marketing'] },
      { keywords:['salon','hair','nails','beauty','spa','appointment','stylist'], groups:['📅 Appointments','💇 Services Menu','💰 Payments','👥 Client Cards','🛒 Product Inventory'] },
      { keywords:['retail','store','shop','inventory','product','sales','customer'], groups:['📦 Inventory','💰 Sales','👥 Customers','🚚 Orders & Shipping','📣 Marketing'] }
    ];

    industryTemplates.forEach(function(it){
      const matched = it.keywords.some(function(kw){ return lower.includes(kw); });
      if(matched){
        it.groups.forEach(function(grpName){
          const gpPayload = JSON.stringify({ boardId: targetBoardId, groupName: grpName });
          makePostRequest('https://freshtappything.com/.netlify/functions/create-group',{'Content-Type':'application/json','Content-Length':Buffer.byteLength(gpPayload)},gpPayload).catch(function(e){ console.log('Industry group error:',e); });
        });
      }
    });

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
