/**
 * Netlify Serverless Function: /.netlify/functions/intake
 * Role: Fresh 🤵 Autonomous Digital Coordinator Brain
 * Priority 1: Zero-dependency command execution (wipe/clean/archive)
 * Priority 2: Gemini AI intake & routing -> Monday.com mutations
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
      const isBench = /\b(bench|motor|repair|diagnostic|spark|smoke|cord|belt)\b/i.test(transcript);
      const isSched = /\b(today|tomorrow|\d{1,2}(:\d{2})?\s*(am|pm))\b/i.test(transcript);

      return resolve({
        intent: 'INTAKE',
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

Extract intake details:
- clientName: Clean customer name ONLY (preserve honorifics like "Mrs. Donley", strip temporal words like "Today", "Tomorrow").
- equipment: Machine or item mentioned.
- notes: Detailed description of the job.
- destination: "calendar" (if time/date/pickup scheduled), "bench" (if bench test/motor repair needed), or "intake" (general counter intake).
- status: "intake", "bench", "parts", or "route".
- time: Specific time if mentioned (e.g. "11:00 AM"), else "Pending".
- freshResponse: Crisp, motivating 1-2 sentence confirmation. If time is missing on a schedule request, ask directly.

Respond ONLY with pure JSON (no markdown backticks):
{
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
      clientName: 'Direct Intake',
      notes: transcript,
      destination: 'intake',
      status: 'intake',
      time: 'Pending',
      freshResponse: `Got it: "${transcript}"`
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

    // 1. Immediate Command Execution (Zero API dependencies)
    const isCleanCommand = /\b(clean|clear|archive|wipe)\b/i.test(rawTranscript);
    if (isCleanCommand) {
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
          freshResponse: `Shop floor cleared! Archived ${activeItems.length} cards.`
        })
      };
    }

    // 2. Normal Intake Routing via Coordinator
    const decision = await callGeminiCoordinator(rawTranscript);

    let targetGroup = GROUP_INTAKE;
    if (decision.destination === 'calendar') targetGroup = GROUP_CALENDAR;
    if (decision.destination === 'bench') targetGroup = GROUP_WORKBENCH;

    const cleanCardTitle = decision.clientName || 'Direct Intake';
    const noteContent = decision.notes || rawTranscript;

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
