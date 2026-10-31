/**
 * Netlify Serverless Function: /.netlify/functions/intake
 * Role: Fresh 🤵 Autonomous Digital Coordinator Brain
 * Engine: 100% Gemini 3.8 Flash (v1beta) -> Monday.com GraphQL Mutations
 * Features:
 *  - Zero hardcoded regex tripwires; full AI natural language routing
 *  - Quote-Aware 22,283 Customer Vault Auto-Matcher
 *  - Intelligent Intent: INTAKE, CARD_MANAGEMENT, or CONVERSATION
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const MONDAY_API_URL = 'https://api.monday.com/v2';
const MONDAY_API_KEY = process.env.MONDAY_API_KEY || process.env.MONDAY_TOKEN;
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || '18424728273';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Monday Board Groups
const GROUP_INTAKE = 'group_mm6b77as';     // 📥 Counter Intake / Showroom
const GROUP_CALENDAR = 'group_mm7maw66';   // 📅 Calendar / Field / Route
const GROUP_WORKBENCH = 'group_mm76qbbh';  // 🛠️ Bench / Shop Diagnostic
const GROUP_ARCHIVE = 'group_mm6xs2fx';    // 📦 Archive

// Monday Column IDs
const COL_LONG_TEXT = 'long_text_mm5vbykc';
const COL_ADDRESS = 'text_mm6aq4rg';
const COL_PHONE = 'text_mm6a7420';
const COL_DATE = 'date';

let cachedVault = null;

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim().replace(/^"|"$/g, ''));
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur.trim().replace(/^"|"$/g, ''));
  return result;
}

function loadVaultRecords() {
  if (cachedVault) return cachedVault;
  cachedVault = [];

  const possiblePaths = [
    path.join(__dirname, 'export_export (34).csv'),
    path.join(process.cwd(), 'export_export (34).csv'),
    path.join(__dirname, '../../export_export (34).csv')
  ];

  let filePath = possiblePaths.find(p => fs.existsSync(p));
  if (!filePath) return cachedVault;

  try {
    const rawCSV = fs.readFileSync(filePath, 'utf8');
    const lines = rawCSV.split(/\r?\n/);
    if (lines.length < 2) return cachedVault;

    const headers = parseCSVLine(lines[0]);
    const nameIdx = headers.indexOf('Name');
    const addrIdx = headers.indexOf('Address');
    const phoneIdx = headers.indexOf('Phone');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cleanRow = parseCSVLine(line);
      const name = cleanRow[nameIdx] || '';
      const address = cleanRow[addrIdx] || '';
      const phone = cleanRow[phoneIdx] || '';

      if (name) {
        cachedVault.push({
          name: name,
          cleanName: name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim(),
          address: address,
          phone: phone
        });
      }
    }
  } catch (err) {
    console.error('[FRESH VAULT ERROR]', err.message);
  }

  return cachedVault;
}

function matchCustomerVault(clientName) {
  if (!clientName) return { address: '', phone: '' };

  const records = loadVaultRecords();
  if (!records || records.length === 0) return { address: '', phone: '' };

  const target = clientName.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  const targetTokens = target.split(' ').filter(t => t.length > 1 && !['mrs', 'mr', 'ms', 'dr'].includes(t));

  let match = records.find(r => r.cleanName === target);

  if (!match && targetTokens.length >= 2) {
    match = records.find(r => targetTokens.every(tok => r.cleanName.includes(tok)));
  }

  if (!match && targetTokens.length === 1 && targetTokens[0].length >= 4) {
    match = records.find(r => {
      const tokens = r.cleanName.split(' ');
      return tokens.includes(targetTokens[0]);
    });
  }

  return match ? { address: match.address || '', phone: match.phone || '' } : { address: '', phone: '' };
}

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
      return resolve({
        error: 'GEMINI_API_KEY is missing in Netlify environment variables.',
        clientName: 'Key Missing',
        notes: transcript,
        freshResponse: 'Coach, GEMINI_API_KEY is missing in your Netlify settings!'
      });
    }

    const todayISO = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are Fresh, the sharp AI Digital Coordinator for William Sullivan at Aerus Home Wellness.
Today's Date: ${todayISO}.
Analyze William's voice transcript with full human context:
"${transcript}"

Determine the true action:
1. "INTAKE": Routine customer repair, drop-off, bench test, delivery, or scheduled service visit.
   - clientName: Customer full name or honorific + last name only (e.g. "Tom Amann", "Mrs. Donley"). Strip time/day words.
   - address: Explicit customer address if stated, else "".
   - phone: Explicit phone if stated, else "".
   - equipment: Item or issue mentioned.
   - notes: Clean notes describing the job.
   - destination: "calendar" (if date/time/pickup mentioned), "bench" (if repair/diagnostic), or "intake" (counter drop-off).
   - status: "intake" | "bench" | "parts" | "route".
   - time: Time if stated (e.g. "11:30 AM"), else "Pending".
   - targetDate: Target date in YYYY-MM-DD format if scheduled, else null.
   - freshResponse: Direct, motivating 1-sentence confirmation. If a schedule note lacks a time, ask William directly.

2. "COMMAND_SWEEP_FLOOR": William explicitly orders a sweep or clear of the active shop floor/test cards.
   - freshResponse: Direct confirmation that the deck is being cleared.

3. "COMMAND_ARCHIVE_SPECIFIC": William wants to archive or remove a specific customer card or duplicate.
   - targetClient: Name of the customer card to locate and archive.
   - freshResponse: Direct confirmation of archiving that specific record.

4. "CONVERSATION": Questions, coaching, check-ins, or unclear requests.
   - freshResponse: High-energy, direct answer or question to guide William forward.

Return pure JSON only (no markdown code blocks):
{
  "action": "INTAKE" | "COMMAND_SWEEP_FLOOR" | "COMMAND_ARCHIVE_SPECIFIC" | "CONVERSATION",
  "clientName": "...",
  "targetClient": "...",
  "address": "...",
  "phone": "...",
  "equipment": "...",
  "notes": "...",
  "destination": "calendar" | "bench" | "intake",
  "status": "intake" | "bench" | "parts" | "route",
  "time": "...",
  "targetDate": "...",
  "freshResponse": "..."
}`;

    const postData = JSON.stringify({
      contents: [{ parts: [{ text: systemPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    });

    const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`);

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
          if (parsed.error) {
            return resolve({
              error: parsed.error.message,
              freshResponse: `Gemini reported: ${parsed.error.message}`
            });
          }
          const rawText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          const cleanJSON = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          resolve(JSON.parse(cleanJSON));
        } catch (e) {
          resolve({
            error: e.message,
            freshResponse: `Could not parse AI response: ${e.message}`
          });
        }
      });
    });

    req.on('error', (err) => {
      resolve({
        error: err.message,
        freshResponse: `Network error connecting to Gemini: ${err.message}`
      });
    });

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
        body: JSON.stringify({ error: 'No transcript provided.' })
      };
    }

    // 100% of every message goes straight to the Gemini Coordinator
    const decision = await callGeminiCoordinator(rawTranscript);

    if (decision.error) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: Date.now(),
          clientName: 'Coordinator Check',
          notes: rawTranscript,
          freshResponse: decision.freshResponse
        })
      };
    }

    // Action 1: Sweep entire shop floor (Explicit intent understood by AI)
    if (decision.action === 'COMMAND_SWEEP_FLOOR') {
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
          freshResponse: decision.freshResponse || `Shop floor swept clean! Archived ${activeItems.length} active cards.`
        })
      };
    }

    // Action 2: Archive specific customer or duplicate card
    if (decision.action === 'COMMAND_ARCHIVE_SPECIFIC') {
      const target = (decision.targetClient || decision.clientName || '').toLowerCase().trim();
      const fetchQuery = `
        query {
          boards(ids: [${MONDAY_BOARD_ID}]) {
            items_page(limit: 100) {
              items {
                id
                name
                group { id }
              }
            }
          }
        }
      `;
      const boardRes = await callMondayGraphQL(fetchQuery);
      const items = boardRes?.data?.boards?.[0]?.items_page?.items || [];
      const matchingItems = items.filter(i => i.group?.id !== GROUP_ARCHIVE && i.name.toLowerCase().includes(target));

      for (const item of matchingItems) {
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
          action: 'ARCHIVE_SPECIFIC',
          archivedCount: matchingItems.length,
          freshResponse: decision.freshResponse || `Archived ${matchingItems.length} card(s) matching "${decision.targetClient}".`
        })
      };
    }

    // Action 3: Pure conversation or clarification
    if (decision.action === 'CONVERSATION') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          action: 'CONVERSATION',
          freshResponse: decision.freshResponse
        })
      };
    }

    // Action 4: Standard Intake (Creates board card with verified Vault data)
    let targetGroup = GROUP_INTAKE;
    if (decision.destination === 'calendar') targetGroup = GROUP_CALENDAR;
    if (decision.destination === 'bench') targetGroup = GROUP_WORKBENCH;

    const cleanCardTitle = decision.clientName || 'Direct Intake';
    const noteContent = decision.notes || rawTranscript;

    const matchedVault = matchCustomerVault(decision.clientName);
    const finalAddress = decision.address || matchedVault.address || '';
    const finalPhone = decision.phone || matchedVault.phone || '';

    const colValuesObj = {
      [COL_LONG_TEXT]: { text: noteContent },
      [COL_ADDRESS]: finalAddress,
      [COL_PHONE]: finalPhone
    };

    if (decision.destination === 'calendar' && decision.targetDate) {
      colValuesObj[COL_DATE] = { date: decision.targetDate };
    }

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
        address: finalAddress,
        phone: finalPhone,
        equipment: decision.equipment || '',
        destination: decision.destination || 'intake',
        status: decision.status || 'intake',
        time: decision.time || 'Pending',
        freshResponse: decision.freshResponse || `Card locked down for ${cleanCardTitle}!`
      })
    };

  } catch (error) {
    console.error('[INTAKE HANDLER CRASH]', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Intake execution failure' })
    };
  }
};
