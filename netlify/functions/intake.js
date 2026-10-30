/**
 * Netlify Serverless Function: /.netlify/functions/intake
 * Engine Brain: Routes spoken/text requests via Gemini LLM
 * Capabilities:
 *  1. Natural Language Intent Parsing (Intake vs Command vs Conversation)
 *  2. Direct Monday.com Mutations (Create Card, Calendar Slot, or Bulk Archive)
 *  3. Conversational Follow-up via freshResponse
 */

const https = require('https');

const MONDAY_API_URL = 'https://api.monday.com/v2';
const MONDAY_API_KEY = process.env.MONDAY_API_KEY || process.env.MONDAY_TOKEN;
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || '18424728273';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Monday Groups
const GROUP_INTAKE = 'group_mm6b77as';     // 2. 📥 Counter Intake / Showroom
const GROUP_CALENDAR = 'group_mm7maw66';   // Today's Schedule / Field Lane
const GROUP_ARCHIVE = 'group_mm6xs2fx';    // Archived Cards Lane

function callMondayGraphQL(query, variables = {}) {
  return new Promise((resolve, reject) => {
    if (!MONDAY_API_KEY) return resolve({ error: 'Missing Monday API Key' });

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

function callGeminiBrain(transcript) {
  return new Promise((resolve) => {
    if (!GEMINI_API_KEY) {
      const isCmd = /clean|clear|archive/i.test(transcript);
      return resolve({
        intent: isCmd ? 'COMMAND' : 'INTAKE',
        command: isCmd ? 'ARCHIVE_ALL' : null,
        clientName: transcript.split(/\s+/).slice(0, 2).join(' '),
        notes: transcript,
        destination: /today|tomorrow|\d{1,2}(:\d{2})?\s*(am|pm)/i.test(transcript) ? 'schedule' : 'pinball',
        status: 'intake',
        time: 'Pending',
        freshResponse: `Locked in note: "${transcript}"`
      });
    }

    const prompt = `You are Fresh, the AI Digital Coordinator for Aerus Home Wellness.
Analyze this spoken transcript from William Sullivan:
"${transcript}"

Classify into one of 3 INTENTS:
1. "COMMAND": If William says to clear the board, clean the shop floor, archive dummy/test cards, or wipe cards. Return command="ARCHIVE_ALL".
2. "INTAKE": If William dictates a customer repair, pickup, delivery, part request, or appointment.
   - Extract: clientName, notes, time (e.g., "11:00 AM", or "Pending"), destination ("schedule" if time/date mentioned, else "pinball"), status ("intake", "bench", "parts", or "route").
   - If time or critical info is missing, write a short, punchy Girard-style conversational reply in "freshResponse".
3. "CONVERSATION": Simple chat, check-ins, or questions. Return conversational "freshResponse".

Respond ONLY with valid JSON (no markdown fences):
{
  "intent": "INTAKE" | "COMMAND" | "CONVERSATION",
  "command": "ARCHIVE_ALL" | null,
  "clientName": "...",
  "notes": "...",
  "destination": "schedule" | "pinball",
  "status": "intake",
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
          const textPayload = parsed.candidates[0].content.parts[0].text;
          resolve(JSON.parse(textPayload));
        } catch (e) {
          resolve({
            intent: 'INTAKE',
            clientName: 'Direct Intake',
            notes: transcript,
            destination: 'pinball',
            status: 'intake',
            time: 'Pending',
            freshResponse: `Note recorded: "${transcript}"`
          });
        }
      });
    });

    req.on('error', () => resolve({
      intent: 'INTAKE',
      clientName: 'Direct Intake',
      notes: transcript,
      destination: 'pinball',
      status: 'intake',
      time: 'Pending',
      freshResponse: `Captured note: "${transcript}"`
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
        body: JSON.stringify({ error: 'No transcript received.' })
      };
    }

    // 1. Pass through Gemini Brain
    const aiDecision = await callGeminiBrain(rawTranscript);

    // 2. Handle System Commands (Bulk Archive / Clear Floor)
    if (aiDecision.intent === 'COMMAND' && aiDecision.command === 'ARCHIVE_ALL') {
      const getActiveItemsQuery = `
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
      const boardData = await callMondayGraphQL(getActiveItemsQuery);
      const items = boardData?.data?.boards?.[0]?.items_page?.items || [];
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
          freshResponse: `Shop floor cleared! Archived ${activeItems.length} cards. Deck is clean and ready to roll! 💥`
        })
      };
    }

    // 3. Handle Intake Mutation to Monday
    const targetGroup = aiDecision.destination === 'schedule' ? GROUP_CALENDAR : GROUP_INTAKE;
    const cardTitle = aiDecision.clientName || 'Direct Intake';

    const createItemMutation = `
      mutation CreateCard($boardId: ID!, $groupId: String!, $itemName: String!) {
        create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName) {
          id
          name
        }
      }
    `;

    const mondayItem = await callMondayGraphQL(createItemMutation, {
      boardId: MONDAY_BOARD_ID,
      groupId: targetGroup,
      itemName: cardTitle.slice(0, 255)
    });

    const newId = mondayItem?.data?.create_item?.id || Date.now();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: newId,
        clientName: cardTitle,
        notes: aiDecision.notes || rawTranscript,
        status: aiDecision.status || 'intake',
        destination: aiDecision.destination || 'pinball',
        time: aiDecision.time || 'Pending',
        freshResponse: aiDecision.freshResponse || `Card locked in for ${cardTitle}!`
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err.message || 'Intake processing error'
      })
    };
  }
};
