/**
 * Netlify Serverless Function: /.netlify/functions/intake
 * Role: Fresh 🤵 Autonomous Digital Coordinator Brain
 * Engine: Gemini 3.8 Flash (v1beta) -> Monday.com GraphQL Mutations
 * Features:
 *  - Sissy's Internal Audit Gate (Zero meta-command leakage)
 *  - Intelligent Note Synthesis (APPEND vs. REPLACE mode)
 *  - One Customer = One Card Law (Upsert with Lane & Data Defense)
 *  - Internal/Supplier errands (FOAS, Desco, Amazon) -> William Sullivan Card
 *  - Quote-Aware 22,283 Customer Vault Auto-Matcher (Address & Phone)
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
    path.join(__dirname, '../../export_export (34).csv'),
    path.join(__dirname, 'export_export (35).csv'),
    path.join(process.cwd(), 'export_export (35).csv'),
    path.join(__dirname, '../../export_export (35).csv')
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
  if (!clientName || clientName === 'William Sullivan') return { address: '', phone: '' };

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
        freshResponse: 'Coach, GEMINI_API_KEY is missing in your Netlify settings!'
      });
    }

    const todayISO = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are Fresh & Sissy, the AI Digital Coordinator & Quality Audit Gate for William Sullivan at Aerus Home Wellness.
Today's Date: ${todayISO}.
Analyze William's voice note or typed text:
"${transcript}"

AUDIT GATE RULES (CRITICAL):
1. ZERO META-COMMAND LEAKAGE:
   - When William says meta-instructions like "match her location", "clean out the placeholder note", "update address to X", or "fix the card", STRIP THOSE WORDS OUT.
   - The "notes" field must contain ONLY the clean, polished, professional customer or service job description. Never allow administrative chatter into the note.
2. NOTE MODE SYNTHESIS:
   - "REPLACE": If William is correcting, editing, rewriting, or saying "clean up note", "update note to", or "replace note".
   - "APPEND": If William is providing additional info, saying "also customer said", adding an update, or dropping routine new details.
3. INTERNAL TASKS:
   - Supplier orders (FOAS, Desco, Amazon, parts sourcing) or general William errands -> set clientName: "William Sullivan", destination: "intake", explicitDestinationChange: false.

Classify into one of these actions:
1. "INTAKE": Distinct jobs, customer appointments, parts orders, bench repairs, or shop errands.
   - Extract EVERY DISTINCT task into the "cards" array.
   - Each card must have:
     * clientName: Clean customer name (e.g. "Tom Amann", "Mrs. Donley") or "William Sullivan".
     * address: Customer address if explicitly spoken/typed, else "".
     * phone: Customer phone if explicitly spoken/typed, else "".
     * equipment: Machine or item mentioned.
     * notes: Clean, professional job note ONLY (zero meta-banter).
     * noteMode: "APPEND" | "REPLACE".
     * destination: "calendar" | "bench" | "intake".
     * explicitDestinationChange: true if transcript explicitly demands a move to bench/calendar/route, false otherwise.
     * status: "intake" | "bench" | "parts" | "route".
     * time: Time if stated (e.g. "11:30 AM"), else "Pending".
     * targetDate: YYYY-MM-DD format if scheduled date mentioned, else null.
   - freshResponse: Punchy, motivational 1-sentence confirmation.

2. "COMMAND_SWEEP_FLOOR": William explicitly orders to sweep, clear, or archive the entire active floor.
3. "COMMAND_ARCHIVE_SPECIFIC": William wants to archive a specific record or duplicate (provide "targetClient").
4. "CONVERSATION": Questions, coaching, check-ins. Provide motivating "freshResponse".

Return pure JSON only (no markdown code blocks):
{
  "action": "INTAKE" | "COMMAND_SWEEP_FLOOR" | "COMMAND_ARCHIVE_SPECIFIC" | "CONVERSATION",
  "cards": [
    {
      "clientName": "...",
      "address": "...",
      "phone": "...",
      "equipment": "...",
      "notes": "...",
      "noteMode": "APPEND" | "REPLACE",
      "destination": "calendar" | "bench" | "intake",
      "explicitDestinationChange": true | false,
      "status": "intake" | "bench" | "parts" | "route",
      "time": "...",
      "targetDate": "..."
    }
  ],
  "targetClient": "...",
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

    // Action 1: Sweep entire shop floor
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

    // Action 2: Archive specific customer or duplicate
    if (decision.action === 'COMMAND_ARCHIVE_SPECIFIC') {
      const target = (decision.targetClient || '').toLowerCase().trim();
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

    // Action 3: Conversation
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

    // Action 4: Multi-Card Intake Processing with Audit Gate
    const cardsToProcess = Array.isArray(decision.cards) && decision.cards.length > 0 
      ? decision.cards 
      : [{
          clientName: decision.clientName || 'Direct Intake',
          notes: decision.notes || rawTranscript,
          noteMode: 'APPEND',
          address: decision.address || '',
          phone: decision.phone || '',
          destination: decision.destination || 'intake',
          explicitDestinationChange: false,
          status: decision.status || 'intake',
          time: decision.time || 'Pending',
          targetDate: decision.targetDate || null
        }];

    // Fetch active cards to check for existing customer cards
    const activeBoardQuery = `
      query {
        boards(ids: [${MONDAY_BOARD_ID}]) {
          items_page(limit: 100) {
            items {
              id
              name
              group { id }
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
    const activeBoardRes = await callMondayGraphQL(activeBoardQuery);
    const existingItems = activeBoardRes?.data?.boards?.[0]?.items_page?.items || [];
    const activeExisting = existingItems.filter(i => i.group?.id !== GROUP_ARCHIVE);

    const createdResults = [];

    for (const card of cardsToProcess) {
      let targetGroup = GROUP_INTAKE;
      if (card.destination === 'calendar') targetGroup = GROUP_CALENDAR;
      if (card.destination === 'bench') targetGroup = GROUP_WORKBENCH;

      const cleanCardTitle = card.clientName || 'Direct Intake';
      const noteContent = card.notes || rawTranscript;
      const targetLower = cleanCardTitle.toLowerCase().trim();

      const existingCard = activeExisting.find(item => item.name.toLowerCase().trim() === targetLower);

      if (existingCard) {
        // --- UPSERT: AUDIT GATE NOTE SYNTHESIS + LANE & DATA DEFENSE ---

        // 1. Lane Preservation
        const shouldChangeGroup = Boolean(card.explicitDestinationChange || (card.destination === 'calendar' && card.targetDate));
        const finalGroup = shouldChangeGroup ? targetGroup : (existingCard.group?.id || targetGroup);

        if (existingCard.group?.id !== finalGroup) {
          await callMondayGraphQL(`
            mutation {
              move_item_to_group(item_id: ${existingCard.id}, group_id: "${finalGroup}") {
                id
              }
            }
          `);
        }

        // 2. Extract current values
        let existingNotes = '';
        let existingAddress = '';
        let existingPhone = '';

        if (Array.isArray(existingCard.column_values)) {
          const cNote = existingCard.column_values.find(c => c.id === COL_LONG_TEXT);
          if (cNote && cNote.text) existingNotes = cNote.text.trim();

          const cAddr = existingCard.column_values.find(c => c.id === COL_ADDRESS);
          if (cAddr && cAddr.text) existingAddress = cAddr.text.trim();

          const cPhone = existingCard.column_values.find(c => c.id === COL_PHONE);
          if (cPhone && cPhone.text) existingPhone = cPhone.text.trim();
        }

        // 3. Sissy's Intelligent Edit vs. Append
        let updatedNotes = noteContent;
        if (card.noteMode === 'REPLACE' || !existingNotes) {
          updatedNotes = noteContent;
        } else {
          const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          updatedNotes = `${existingNotes}\n\n[${timestampStr}] ${noteContent}`;
        }

        const updateColValues = {
          [COL_LONG_TEXT]: { text: updatedNotes }
        };

        // 4. Preserve Address & Phone
        if (card.address && card.address.trim()) {
          updateColValues[COL_ADDRESS] = card.address.trim();
        } else if (!existingAddress) {
          const matchedVault = matchCustomerVault(card.clientName);
          if (matchedVault.address) updateColValues[COL_ADDRESS] = matchedVault.address;
        }

        if (card.phone && card.phone.trim()) {
          updateColValues[COL_PHONE] = card.phone.trim();
        } else if (!existingPhone) {
          const matchedVault = matchCustomerVault(card.clientName);
          if (matchedVault.phone) updateColValues[COL_PHONE] = matchedVault.phone;
        }

        // 5. Preserve Date
        if (card.targetDate) {
          updateColValues[COL_DATE] = { date: card.targetDate };
        }

        await callMondayGraphQL(`
          mutation UpdateCard($boardId: ID!, $itemId: ID!, $colValues: JSON!) {
            change_multiple_column_values(board_id: $boardId, item_id: $itemId, column_values: $colValues) {
              id
            }
          }
        `, {
          boardId: MONDAY_BOARD_ID,
          itemId: existingCard.id,
          colValues: JSON.stringify(updateColValues)
        });

        createdResults.push({
          id: existingCard.id,
          clientName: cleanCardTitle,
          notes: updatedNotes,
          destination: finalGroup === GROUP_CALENDAR ? 'calendar' : (finalGroup === GROUP_WORKBENCH ? 'bench' : 'intake'),
          status: card.status || 'intake',
          time: card.time || 'Pending',
          updatedExisting: true
        });

      } else {
        // --- NEW CARD CREATION: Full Vault Match & Clean Note ---
        const matchedVault = matchCustomerVault(card.clientName);
        const finalAddress = card.address || matchedVault.address || '';
        const finalPhone = card.phone || matchedVault.phone || '';

        const colValuesObj = {
          [COL_LONG_TEXT]: { text: noteContent },
          [COL_ADDRESS]: finalAddress,
          [COL_PHONE]: finalPhone
        };

        if (card.destination === 'calendar' && card.targetDate) {
          colValuesObj[COL_DATE] = { date: card.targetDate };
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

        activeExisting.push({
          id: newId,
          name: cleanCardTitle,
          group: { id: targetGroup },
          column_values: [
            { id: COL_LONG_TEXT, text: noteContent },
            { id: COL_ADDRESS, text: finalAddress },
            { id: COL_PHONE, text: finalPhone }
          ]
        });

        createdResults.push({
          id: newId,
          clientName: cleanCardTitle,
          notes: noteContent,
          address: finalAddress,
          phone: finalPhone,
          destination: card.destination || 'intake',
          status: card.status || 'intake',
          time: card.time || 'Pending',
          updatedExisting: false
        });
      }
    }

    const firstCard = createdResults[0] || {};
    const defaultResponse = createdResults.length > 1
      ? `Locked down ${createdResults.length} tasks across your board, Coach!`
      : (firstCard.updatedExisting ? `Polished record updated for ${firstCard.clientName}!` : `Card locked down for ${firstCard.clientName || 'Direct Intake'}!`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        id: firstCard.id || Date.now(),
        clientName: firstCard.clientName || 'Direct Intake',
        notes: firstCard.notes || rawTranscript,
        address: firstCard.address || '',
        phone: firstCard.phone || '',
        destination: firstCard.destination || 'intake',
        status: firstCard.status || 'intake',
        time: firstCard.time || 'Pending',
        createdCards: createdResults,
        freshResponse: decision.freshResponse || defaultResponse
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
