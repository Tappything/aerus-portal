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

// Helper to fetch live items from Monday.com
async function fetchBoardContext(mondayKey) {
  if (!mondayKey) return "No live board context available.";
  
  const query = JSON.stringify({
    query: `{ boards(ids: [18424728273]) { items_page(limit: 10) { items { name group { title } } } } }`
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

    // Pull live board items from Monday.com
    const boardContext = await fetchBoardContext(mondayKey);

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

    // ROUTE 4: BRAIN DUMP / CONVERSATION (Passed to Gemini AI)
    var fullPrompt = 'You are Sissy — the intelligent brain behind TappyThing. You serve William Sullivan who runs Aerus Home Wellness in Timonium MD, a vacuum and air purifier repair shop. His team: Mona (front desk), Chris (bench repairs), Mike (field tech), Norby (virtual assistant). TappyThing costs $95/month and replaces all business software.\n\nMODE 3 — BRAIN DUMP: Respond warmly to introductions, descriptions of life, or business ideas (example: I am a yoga teacher, I run a pizza shop). Ask one smart follow-up question to learn more and build their world. Be warm, sharp and personal. Max 2 sentences.\n\nLIVE BOARD DATA:\n' + boardContext + '\n\nUser says: ' + prompt;

    const payload = JSON.stringify({
      contents: [{
        parts: [{ text: fullPrompt }]
      }]
    });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`;

    const resData = await makePostRequest(url, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }, payload);

    console.log('Gemini raw response:', JSON.stringify(resData));

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
    const boardId = data.board_id || '18424728273'; 
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
        const gpPayload = JSON.stringify({ boardId: boardId, groupName: kg.group }); 
        makePostRequest('https://freshtappything.com/.netlify/functions/create-group', {'Content-Type':'application/json','Content-Length':Buffer.byteLength(gpPayload)}, gpPayload).catch(function(e){ console.log('Group create error:',e); }); 
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
