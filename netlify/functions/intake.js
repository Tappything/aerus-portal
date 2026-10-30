/**
 * Netlify Serverless Function: /.netlify/functions/intake
 * Role: Fresh 🤵 Autonomous Digital Coordinator Brain
 * Engine: Gemini AI (Intent & Parsing) -> Monday.com GraphQL Mutations
 */

const https = require('https');

// Environment & Board Setup
const MONDAY_API_URL = 'https://api.monday.com/v2';
const MONDAY_API_KEY = process.env.MONDAY_API_KEY || process.env.MONDAY_TOKEN;
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || '18424728273';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Monday Group Targets
const GROUP_INTAKE = 'group_mm6b77as';     // 2. 📥 Counter Intake / Showroom
const GROUP_CALENDAR = 'group_mm7maw66';   // 📅 Calendar / Field / Route
const GROUP_WORKBENCH = 'group_mm76qbbh';  // 🛠️ Bench / Shop Diagnostic
const GROUP_ARCHIVE = 'group_mm6xs2fx';    // 📦 Archive

// Target Long-Text Notes Column
const COL_LONG_TEXT = 'long_text_mm5vbykc';

function callMondayGraphQL(query, variables = {}) {
  return new Promise((resolve, reject) => {
    if (!MONDAY_API_KEY) return resolve({ error: 'Missing MONDAY_API_KEY' });

    const postData = JSON.stringify({ query, variables });
    const url = new URL(MONDAY_API_URL);

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': MONDAY_API_KEY,
        'API-Version': '2023-10',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(rawData));
        } catch (e) {
          resolve({ error: 'Failed to parse Monday response', raw: rawData });
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(postData);
    req.end();
  });
}

function callGeminiCoordinator(transcript) {
  return new Promise((resolve) => {
    if (!GEMINI_API_KEY) {
      const isCmd = /clean|clear|archive/i.test(transcript);
      const isBench = /bench|motor|repair|diagnostic|spark/i.test(transcript);
      const isSched = /today|tomorrow|\d{1,2}(:\d{2})?\s*(am|pm)/i.test(transcript);

      return resolve({
        intent: isCmd ? 'COMMAND' : 'INTAKE',
        command: isCmd ? 'ARCHIVE_ALL' : null,
        clientName: transcript.split(/\s+/).slice(0, 2).join(' ') || 'Direct Intake',
        equipment: 'Aerus / Vacuum Unit',
        notes: transcript,
        destination: isSched ? 'calendar' : (isBench ? 'bench' : 'intake'),
        status: isBench ? 'bench' : 'intake',
        time: isSched ? 'Scheduled' : 'Pending',
        freshResponse: `Locked in note: "${transcript}"`
      });
    }

    const prompt = `You are Fresh, the sharp, proactive AI Digital Coordinator for William Sullivan at Aerus Home Wellness.
Analyze this voice transcript from William:
"${transcript}"

Classify into one of 3 INTENTS:
1. "COMMAND":
   - Triggers: "clean shop floor", "archive test cards", "clear board", "wipe screen", "archive everything".
   - Set command="ARCHIVE_ALL".

2. "INTAKE":
   - Triggers: Customer intakes, service calls, bench repairs, pickups, deliveries, parts notes.
   - Extract:
     * clientName: Clean customer name ONLY (preserve honorifics like "Mrs. Donley", strip temporal words like "Today", "Tomorrow").
     * equipment: What machine/issue is mentioned (e.g., "Hoover Upright", "Guardian Air", "Filter cleanout").
     * notes: Full detailed description of the job or customer request.
     * destination: "calendar" (if time/date/pickup scheduled), "bench" (if bench test/motor repair needed), or "intake" (general showroom/counter intake).
     * status: "intake", "bench", "parts", or "route".
     * time: Specific time if mentioned (e.g. "11:00 AM"), else "Pending".
     * freshResponse: A crisp, professional, motivating 1-2 sentence response confirming what you locked down. If an appointment is mentioned without a time, ask for the arrival time directly.

3. "CONVERSATION":
   - Questions, check-ins, or unclear comments.
   - Set freshResponse to guide William forward with high energy.

Respond ONLY with pure JSON (no markdown ticks, no backticks, no wrapping):
{
  "intent": "INTAKE" | "COMMAND" | "CONVERSATION",
  "command": "ARCHIVE_ALL" | null,
  "clientName": "...",
  "equipment": "...",
  "notes": "...",
  "destination": "calendar" | "bench" | "intake",
  "status": "intake" | "bench" | "parts" | "route",
  "time": "...",
  "freshResponse": "..."
}`;

    const postData = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    });

    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`);

    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let rawData = '';
      res.on('data', chunk => rawData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(rawData);
          const rawText = parsed.candidates[0].content.parts[0].text;
          const cleanedText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          resolve(JSON.parse(cleanedText));
        } catch (e) {
          resolve({
            intent: 'INTAKE',
            clientName: 'Direct Intake',
            notes: transcript,
            destination: 'intake',
            status: 'intake',
            time: 'Pending',
            freshResponse: `Note captured: "${transcript}"`
          });
        }
      });
    });

    req.on('error', () => resolve({
      intent: 'INTAKE',
      clientName: 'Direct Intake',
      notes: transcript,
      destination: 'intake',
      status: 'intake',
      time: 'Pending',
      freshResponse: `Got it locked down: "${transcript}"`
    }));

    req.write(postData);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const rawTranscript = (payload.transcript || payload.text || payload.message || '').trim();

    if (!rawTranscript) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No transcript provided' })
      };
    }

    // 1. Run Gemini Intent Brain
    const decision = await callGeminiCoordinator(rawTranscript);

    // 2. Handle System Commands (Bulk Move to Archive)
    if (decision.intent === 'COMMAND' && decision.command === 'ARCHIVE_ALL') {
      const fetchQuery = `
        query {
          boards(ids: [${MONDAY_BOARD_ID}]) {
            items_page(limit: 100) {
              items {
                id
                group { id }
              }
            }
          }
        }
      `;
      const boardRes = await callMondayGraphQL(fetchQuery);
      const items = boardRes?.data?.boards?.[0]?.items_page?.items || [];
      const activeItems = items.filter(i => i.group?.id !== GROUP_ARCHIVE);

      for (const item of activeItems) {
        await callMondayGraphQL(`
          mutation {
            move_item_to_group(item_id: ${item.id}, group_id: "${GROUP_ARCHIVE}") {
              id
            }
          }
        `);
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          action: 'CLEAN_FLOOR',
          archivedCount: activeItems.length,
          freshResponse: `Shop floor swept clean! Archived ${activeItems.length} active cards. Launchpad is open and ready to roll! 💥`
        })
      };
    }

    // 3. Resolve Destination Group
    let targetGroup = GROUP_INTAKE;
    if (decision.destination === 'calendar') targetGroup = GROUP_CALENDAR;
    if (decision.destination === 'bench') targetGroup = GROUP_WORKBENCH;

    const cleanCardTitle = decision.clientName || 'Direct Intake';
    const noteContent = decision.notes || rawTranscript;

    // 4. Create Card & Attach Detailed Notes to long_text_mm5vbykc
    const colValuesObj = {};
    colValuesObj[COL_LONG_TEXT] = { text: noteContent };

    const createMutation = `
      mutation CreateCard($boardId: ID!, $groupId: String!, $itemName: String!, $colValues: JSON!) {
        create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $colValues) {
          id
          name
        }
      }
    `;

    const mondayRes = await callMondayGraphQL(createMutation, {
      boardId: MONDAY_BOARD_ID,
      groupId: targetGroup,
      itemName: cleanCardTitle.slice(0, 255),
      colValues: JSON.stringify(colValuesObj)
    });

    const newId = mondayRes?.data?.create_item?.id || Date.now();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: newId,
        clientName: cleanCardTitle,
        notes: noteContent,
        equipment: decision.equipment || '',
        destination: decision.destination || 'intake',
        status: decision.status || 'intake',
        time: decision.time || 'Pending',
        freshResponse: decision.freshResponse || `Card locked in for ${cleanCardTitle}!`
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Intake execution failure' })
    };
  }
};
