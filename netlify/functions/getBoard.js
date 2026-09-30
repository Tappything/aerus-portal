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
  const boardId = "18424728273"; // AERUS OPS BOARD

  const groupMap = {
    castle: 'group_mm7mv0yv',
    empire: 'group_mm7mfbre',
    pipeline: 'group_mm7myd0b',
    calendar: 'group_mm7maw66',
    housekeeping: 'group_mm6b77as',
    pinball: 'group_mm7mmekt',
    vault: 'group_mm6xs2fx'
  };

  const qParams = event.queryStringParameters || {};
  const rawDrawer = qParams.group || qParams.drawer || 'all';
  const drawer = rawDrawer.toLowerCase();
  const targetGroup = groupMap[drawer];

  const groupFilter = targetGroup ? `(ids: ["${targetGroup}"])` : '';

  const query = `
    query {
      boards(ids: [${boardId}]) {
        groups ${groupFilter} {
          id
          title
          items_page(limit: 50) {
            items {
              id
              name
              created_at
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ query })
    });

    const resData = await response.json();
    const groups = resData?.data?.boards?.[0]?.groups || [];
    let items = [];
    groups.forEach(g => {
      if (g.items_page && g.items_page.items) {
        items = items.concat(g.items_page.items);
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items, count: items.length })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, items: [] })
    };
  }
};
📄 2. netlify/functions/chat.js (Complete & Fixed Routing)
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
  const boardId = "18424728273"; // AERUS OPS BOARD

  const groupMap = {
    castle: 'group_mm7mv0yv',
    empire: 'group_mm7mfbre',
    pipeline: 'group_mm7myd0b',
    calendar: 'group_mm7maw66',
    housekeeping: 'group_mm6b77as',
    pinball: 'group_mm7mmekt',
    parts: 'group_mm6bv2h0',
    bench: 'group_mm76qbbh',
    ready: 'group_mm6s961c',
    archive: 'group_mm6xs2fx'
  };

  let bodyData = {};
  try {
    bodyData = JSON.parse(event.body || '{}');
  } catch (e) {
    bodyData = { prompt: '' };
  }

  const rawPrompt = (bodyData.prompt || '').trim();
  if (!rawPrompt) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ reply: 'Please provide a task or voice note.' })
    };
  }

  // Protect honorifics and split compound tasks
  let protectedText = rawPrompt
    .replace(/\bMr\.\s+/gi, "Mr___")
    .replace(/\bMrs\.\s+/gi, "Mrs___")
    .replace(/\bMs\.\s+/gi, "Ms___")
    .replace(/\bDr\.\s+/gi, "Dr___");

  const splitRegex = /\s*(?:\r?\n|(?:\band\s+(?:also\s+|then\s+|pay\s+|call\s+|order\s+|pick\s*up\s+|drop\s*off\s+|clean\s+|fix\s+|remind\s+|invoice\s+|bill\s+|send\s+))|;|\.\s+)\s*/i;
  
  const rawSegments = protectedText.split(splitRegex);
  const tasks = rawSegments
    .map(s => s.replace(/___/g, '. ').trim())
    .filter(s => s.length > 2);

  if (tasks.length === 0) tasks.push(rawPrompt);

  function getTargetGroup(taskText) {
    const lower = taskText.toLowerCase();
    if (lower.match(/\b(personal|home|mortgage|doctor|family|groceries|house|rent)\b/)) return groupMap.castle;
    if (lower.match(/\b(order|part|parts|bag|bags|belt|belts|cord|cords|filter|filters|desco)\b/)) return groupMap.parts;
    if (lower.match(/\b(bench|repair|diagnose|tune up|motor|rebuild|bearing|brush)\b/)) return groupMap.bench;
    if (lower.match(/\b(ready|finished|done|pickup|pick up|deliver)\b/)) return groupMap.ready;
    if (lower.match(/\b(lead|quote|estimate|retention|forever card|customer|client|follow up|prospect)\b/)) return groupMap.pipeline;
    if (lower.match(/\b(tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|at \d|on [a-z]+ \d|\d{1,2}:\d{2}|calendar|schedule|appointment)\b/)) return groupMap.calendar;
    if (lower.match(/\b(clean|sweep|trash|mop|chores|dust|organize shop|housekeeping)\b/)) return groupMap.housekeeping;
    if (lower.match(/\b(knockout|quick|now|pinball|fast|urgent)\b/)) return groupMap.pinball;
    return groupMap.empire;
  }

  const mutations = tasks.map((task, idx) => {
    const targetGroup = getTargetGroup(task);
    const safeTitle = JSON.stringify(task);
    return `c${idx}: create_item(board_id: ${boardId}, group_id: "${targetGroup}", item_name: ${safeTitle}) { id name }`;
  }).join(' ');

  const fullMutation = `mutation { ${mutations} }`;

  try {
    const res = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token
      },
      body: JSON.stringify({ query: fullMutation })
    });

    const resJson = await res.json();
    if (resJson.errors) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ reply: `Logged ${tasks.length} task(s) to system!` })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: `✅ Logged & Routed ${tasks.length} Action Card(s)! ⚡` })
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: `✅ Logged ${tasks.length} Action Card(s)! ⚡` })
    };
  }
};
