exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const token = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY || process.env.MONDAY_TOKEN;
  const boardId = "18424728273";

  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ reply: 'Monday API token missing' }) };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch(e) {
    body = {};
  }

  const prompt = (body.prompt || body.text || '').trim();
  if (!prompt) {
    return { statusCode: 400, headers, body: JSON.stringify({ reply: 'Empty brain dump' }) };
  }

  // Protect honorifics from splitting
  let safeText = prompt.replace(/(Mrs|Mr|Ms|Dr)\./gi, "$1___DOT___");

  // Decompose compound stream
  let rawParts = safeText
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])|\band\s+(?=[a-z0-9])|;\s*|\n+/i)
    .map(t => t.replace(/___DOT___/g, ".").trim().replace(/^and\s+/i, ''))
    .filter(t => t.length > 2);

  let tasks = rawParts.length > 0 ? rawParts : [prompt.replace(/___DOT___/g, ".")];

  // Precision 7-Drawer Routing Map
  const routeTask = (task) => {
    const lower = task.toLowerCase();
    
    // 1. Castle 🏰 (PIN Personal / Bills / Family)
    if (lower.match(/personal|mortgage|insurance|bill|doctor|family|private|home|tax|pickleball/)) {
      return 'group_mm7mv0yv';
    }
    // 2. Calendar 📅 (Dates / Times / Appointments / Runs)
    if (lower.match(/tomorrow|\bat\b\s*\d+|\bam\b|\bpm\b|noon|schedule|appointment|water test|friday|monday|tuesday|wednesday|thursday|saturday|sunday/)) {
      return 'group_mm7maw66';
    }
    // 3. Pipeline 🚀 (Sales / Quotes / Money / Forever Cards)
    if (lower.match(/forever card|follow up|lead|sale|quote|deposit|\$|invoice|collect/)) {
      return 'group_mm7myd0b';
    }
    // 4. Housekeeping 🧹 (Chores / Upkeep / Cleaning)
    if (lower.match(/cleaning|chores|upkeep|clean|showroom|trash|vacuum floor/)) {
      return 'group_mm6b77as';
    }
    // 5. Pinball ⚡ (Rapid knockout)
    if (lower.match(/pinball|rapid|knockout/)) {
      return 'group_mm7mmekt';
    }
    // 6. Empire 👑 (Default Core Operations / Bench / Tech Repairs)
    return 'group_mm7mfbre';
  };

  const mutations = tasks.map((task, idx) => {
    const groupId = routeTask(task);
    let cleanName = task.charAt(0).toUpperCase() + task.slice(1);
    const safeName = cleanName.replace(/"/g, '\\"');
    return `c${idx}: create_item(board_id: ${boardId}, group_id: "${groupId}", item_name: "${safeName}") { id }`;
  }).join("\n");

  const query = `mutation {\n${mutations}\n}`;

  try {
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2023-10'
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        reply: `✅ LOGGED ${tasks.length} ACTION CARDS! ⚡`,
        count: tasks.length,
        tasks: tasks,
        mondayResponse: data
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ reply: 'Error processing intake: ' + err.message })
    };
  }
};
