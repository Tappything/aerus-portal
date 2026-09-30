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

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch(e) {}

  let text = (body.prompt || body.text || "").trim();
  if (!text) {
    return { statusCode: 400, headers, body: JSON.stringify({ reply: "No prompt provided" }) };
  }
  if (!token) {
    return { statusCode: 500, headers, body: JSON.stringify({ reply: "❌ MONDAY_API_TOKEN missing in Netlify." }) };
  }

  // Clean voice triggers
  text = text.replace(/^(fresh,?\sprocess\sthis\srun:?\s|fresh,?\s*)/i, '').replace(/["“”]/g, '').trim();

  // Protect Honorifics
  let safeText = text.replace(/(Mrs|Mr|Ms|Dr)\./gi, "$1___DOT___");

  // Targeted Conjunction & Sentence Splitting
  const splitRegex = /(?:\. |\n|;|\band pay\b|\band also\b|\band then\b|\band remind\b|\band tell\b|\band mark\b|, (?=[a-zA-Z]{3,}))/i;
  const rawParts = safeText.split(splitRegex);

  const tasks = rawParts
    .map(p => p.replace(/___DOT___/g, ".").trim())
    .filter(p => p.length > 2);

  if (tasks.length === 0) {
    return { statusCode: 200, headers, body: JSON.stringify({ reply: "✅ Queue ready!" }) };
  }

  // Precise Group ID Routing Engine
  const routeTask = (t) => {
    const lower = t.toLowerCase();

    // 1. Castle (Personal / Home)
    if (lower.match(/mortgage|home|personal|family|gas|electric|bills|pickleball/)) {
      return 'group_mm7mv0yv';
    }
    // 2. Parts Needed
    if (lower.match(/parts|order|cord|hose|filter|belt|amazon|desco/)) {
      return 'group_mm6bv2h0';
    }
    // 3. Bench Repairs
    if (lower.match(/bench|repair|breakdown|shampooer|canister|upright|check unit|diagnostic/)) {
      return 'group_mm76qbbh';
    }
    // 4. Ready Wall / Delivery
    if (lower.match(/ready|deliver|delivery|pickup|drop off/)) {
      return 'group_mm6s961c';
    }
    // 5. Calendar
    if (lower.match(/tomorrow|\bat\b\s*\d+|\bam\b|\bpm\b|noon|schedule|appointment|water test/)) {
      return 'group_mm7maw66';
    }
    // 6. Pipeline (Deals, Forever Cards, Retention)
    if (lower.match(/forever card|follow up|job completed|lead|sale|quote|deposit|check/)) {
      return 'group_mm7myd0b';
    }
    // 7. Housekeeping
    if (lower.match(/cleaning|chores|upkeep|clean|inventory check|trash/)) {
      return 'group_mm6b77as';
    }
    // 8. Pinball Mode
    if (lower.match(/pinball|rapid|knockout/)) {
      return 'group_mm7mmekt';
    }
    // 9. Empire General Ops (Default Shop Fallback)
    return 'group_mm7mfbre';
  };

  // Batched GraphQL Mutation Payload (0.4s Execution)
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
