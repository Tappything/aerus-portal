/**
 * Netlify Serverless Function: /.netlify/functions/intake
 * Role: Fresh 🤵 Autonomous Digital Coordinator Brain
 * Engine: Gemini 3.8 Flash (v1beta) -> Monday.com GraphQL Mutations
 * Features:
 *  - Quote-Aware 22,283 Customer Vault Auto-Matcher
 *  - Verified Address (text_mm6aq4rg) & Phone (text_mm6a7420)
 *  - Long-Text Notes (long_text_mm5vbykc) & Due Date (date)
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

// In-Memory Vault Cache
let cachedVault = null;

// Quote-aware parser preserving commas inside quotes and empty fields
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
  if (!filePath) {
    console.warn('[FRESH VAULT] export_export (34).csv not found on local disk path.');
    return cachedVault;
  }

  try {
    const rawCSV = fs.readFileSync(filePath, 'utf8');
    const lines = rawCSV.split(/\r?\n/);
    if (lines.length < 2) return cachedVault;

    // Header parse: Client #, Name, Email, Address, Phone, Created
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
    console.log(`[FRESH VAULT] Loaded ${cachedVault.length} customer records into memory.`);
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

  if (match) {
    return {
      address: match.address || '',
      phone: match.phone || ''
    };
  }

  return { address: '', phone: '' };
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
      console.error('[FRESH] GEMINI_API_KEY is not set in environment.');
      return resolve({
        error: 'GEMINI_API_KEY is missing in Netlify environment variables.',
        clientName: 'Key Missing',
        notes: transcript,
        address: '',
        phone: '',
        destination: 'intake',
        status: 'intake',
        time: 'Pending',
        targetDate: null,
        freshResponse: 'Coach, GEMINI_API_KEY is missing in your Netlify settings!'
      });
    }

    const todayISO = new Date().toISOString().split('T')[0];

    const systemPrompt = `You are Fresh, the AI Digital Coordinator for William Sullivan at Aerus Home Wellness.
Today's Date: ${todayISO}.
Analyze this voice note from William:
"${transcript}"

Extract into JSON:
- clientName: Customer full name or honorific + last name only (e.g. "Tom Amann", "Mrs. Donley", "Cindy Fuji San"). Strip trailing time/day words.
- address: Customer address if explicitly stated in audio, else "".
- phone: Customer phone number if explicitly stated in audio, else "".
- equipment: Item or issue mentioned (e.g. "Vacuum", "Filter", "Guardian Air").
- notes: Full details of the job.
- destination: "calendar" (if date/time/pickup mentioned), "bench" (if shop repair/diagnostic), or "intake" (counter drop-off).
- status: "intake" | "bench" | "parts" | "route".
- time: Scheduled time if stated (e.g. "11:00 AM", "Noon"), else "Pending".
- targetDate: Target date in YYYY-MM-DD format if scheduled (e.g. today or tomorrow or specific date), else null.
- freshResponse: Direct, motivating 1-sentence confirmation. If an appointment is missing an exact time, ask William directly.

Return pure JSON only:`;

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
            console.error('[GEMINI API ERROR]', parsed.error);
            return resolve({
              error: parsed.error.message,
              clientName: 'Gemini Error',
              notes: transcript,
              address: '',
              phone: '',
              destination: 'intake',
              status: 'intake',
              time: 'Pending',
              targetDate: null,
              freshResponse: `Gemini reported: ${parsed.error.message}`
            });
          }

          const rawText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          const cleanJSON = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
          resolve(JSON.parse(cleanJSON));
        } catch (e) {
          console.error('[GEMINI PARSE ERROR]', e.message, rawData);
          resolve({
            error: e.message,
            clientName: 'Parse Error',
            notes: transcript,
            address: '',
            phone: '',
            destination: 'intake',
            status: 'intake',
            time: 'Pending',
            targetDate: null,
            freshResponse: `Could not parse AI response: ${e.message}`
          });
        }
      });
    });

    req.on('error', (err) => {
      console.error('[GEMINI NETWORK ERROR]', err.message);
      resolve({
        error: err.message,
        clientName: 'Network Error',
        notes: transcript,
        address: '',
        phone: '',
        destination: 'intake',
        status: 'intake',
        time: 'Pending',
        targetDate: null,
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

    // 1. Instant Command Intercept
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
          freshResponse: `Shop floor swept clean! Archived ${activeItems.length} cards. Launchpad is open and ready to roll! 💥`
        })
      };
    }

    // 2. Run Gemini Coordinator
    const decision = await callGeminiCoordinator(rawTranscript);

    if (decision.error) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          id: Date.now(),
          clientName: decision.clientName,
          notes: decision.notes,
          address: decision.address || '',
          phone: decision.phone || '',
          status: decision.status,
          destination: decision.destination,
          time: decision.time,
          freshResponse: decision.freshResponse
        })
      };
    }

    // 3. Route to Target Group
    let targetGroup = GROUP_INTAKE;
    if (decision.destination === 'calendar') targetGroup = GROUP_CALENDAR;
    if (decision.destination === 'bench') targetGroup = GROUP_WORKBENCH;

    const cleanCardTitle = decision.clientName || 'Direct Intake';
    const noteContent = decision.notes || rawTranscript;

    // 4. Quote-Aware Vault Cross-Reference
    const matchedVault = matchCustomerVault(decision.clientName);
    const finalAddress = decision.address || matchedVault.address || '';
    const finalPhone = decision.phone || matchedVault.phone || '';

    // 5. Populate Board Columns
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
