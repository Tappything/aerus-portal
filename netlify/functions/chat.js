const fs = require('fs');
const path = require('path');

// Global cache for customer database in RAM
let customerDatabase = null;

// Pure native JS CSV parser - ZERO external packages needed!
function loadCustomerDatabase() {
  if (customerDatabase) return customerDatabase;

  const csvFilePath = path.join(__dirname, 'export_export (34).csv');
  if (!fs.existsSync(csvFilePath)) {
    console.warn('Customer CSV file not found at path:', csvFilePath);
    customerDatabase = [];
    return customerDatabase;
  }

  try {
    const fileContent = fs.readFileSync(csvFilePath, 'utf8');
    const lines = fileContent.split('\n');
    const records = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Native CSV regex split supporting quoted commas
      const cols = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
      if (cols && cols.length >= 2) {
        const clientNum = (cols[0] || '').replace(/"/g, '').trim();
        const name = (cols[1] || '').replace(/"/g, '').trim();
        const phone = (cols[4] || '').replace(/"/g, '').trim();
        const address = (cols[3] || '').replace(/"/g, '').trim();

        if (name) {
          records.push({
            clientNum: clientNum,
            name: name,
            address: address,
            phoneRaw: phone,
            phoneClean: phone.replace(/\D/g, '')
          });
        }
      }
    }

    customerDatabase = records;
    console.log(`Loaded ${customerDatabase.length} customer records into memory.`);
  } catch (err) {
    console.error('Error reading customer CSV:', err);
    customerDatabase = [];
  }

  return customerDatabase;
}

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const prompt = body.prompt || '';
    const boardId = body.board_id || '18424728273';
    const apiKey = process.env.MONDAY_API_KEY;

    if (!prompt) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Prompt is required' })
      };
    }

    // Load customer database into RAM
    const db = loadCustomerDatabase();

    // 1. HANDLE MOVE_CARD MUTATION
    if (prompt === 'MOVE_CARD') {
      const itemId = body.item_id;
      const groupId = body.group_id;

      if (!itemId || !groupId) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'item_id and group_id are required for MOVE_CARD' })
        };
      }

      const moveQuery = `
        mutation ($itemId: ID!, $groupId: String!) {
          move_item_to_group (item_id: $itemId, group_id: $groupId) {
            id
          }
        }
      `;

      const moveResponse = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: moveQuery, variables: { itemId, groupId } })
      });

      const moveData = await moveResponse.json();

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply: 'Card Routed! ⚡',
          item: moveData.data ? moveData.data.move_item_to_group : null
        })
      };
    }

    // 2. REAL-TIME CUSTOMER LOOKUP
    let matchedCustomer = null;
    const extractedDigits = prompt.replace(/\D/g, '');

    if (extractedDigits.length >= 7) {
      matchedCustomer = db.find(c => c.phoneClean && extractedDigits.includes(c.phoneClean));
    }

    if (!matchedCustomer && prompt.length > 2) {
      const promptLower = prompt.toLowerCase();
      matchedCustomer = db.find(c => c.name && promptLower.includes(c.name.toLowerCase()));
    }

    let finalItemName = prompt;
    if (matchedCustomer) {
      finalItemName = `${prompt} | 📍 ${matchedCustomer.address} | 📞 ${matchedCustomer.phoneRaw} | Client #${matchedCustomer.clientNum}`;
    }

    const groupId = 'group_mm6b77as'; // Learning Drawer

    const query = `
      mutation ($boardId: ID!, $groupId: String!, $itemName: String!) {
        create_item (board_id: $boardId, group_id: $groupId, item_name: $itemName) {
          id
          name
        }
      }
    `;

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables: { boardId, groupId, itemName: finalItemName } })
    });

    const resData = await response.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reply: matchedCustomer ? 'Logged with Customer Auto-Lookup! ⚡' : 'Logged! ⚡',
        item: resData.data ? resData.data.create_item : null,
        matchedCustomer: matchedCustomer || null
      })
    };
  } catch (error) {
    console.error('Chat function error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
