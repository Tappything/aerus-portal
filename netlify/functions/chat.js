const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Global cache so CSV is loaded into RAM once per cold start (0.01ms lookup time)
let customerDatabase = null;

// Helper function to load and parse export (34).csv
async function loadCustomerDatabase() {
  if (customerDatabase) return customerDatabase;

  const records = [];
  const csvFilePath = path.join(__dirname, 'export_export (34).csv');

  return new Promise((resolve, reject) => {
    if (!fs.existsSync(csvFilePath)) {
      console.warn('Customer CSV file not found at path:', csvFilePath);
      return resolve([]);
    }

    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (data) => records.push(data))
      .on('end', () => {
        // Clean and index phone numbers for instant matching
        customerDatabase = records.map(row => ({
          clientNum: row['Client #'] || '',
          name: row['Name'] || '',
          email: row['Email'] || '',
          address: row['Address'] || '',
          phoneRaw: row['Phone'] || '',
          phoneClean: (row['Phone'] || '').replace(/\D/g, '') // Strips symbols: 4102566949
        }));
        console.log(`Loaded ${customerDatabase.length} customer records into RAM.`);
        resolve(customerDatabase);
      })
      .on('error', (err) => reject(err));
  });
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

    // Load 22,283 Customer Database into memory
    const db = await loadCustomerDatabase();

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

      const moveVariables = {
        itemId: itemId,
        groupId: groupId
      };

      const moveResponse = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Authorization': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: moveQuery, variables: moveVariables })
      });

      const moveData = await moveResponse.json();

      if (moveData.errors) {
        console.error('Monday API Move Errors:', moveData.errors);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: 'Failed to move item on Monday.com', details: moveData.errors })
        };
      }

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reply: 'Card Routed! ⚡',
          item: moveData.data.move_item_to_group
        })
      };
    }

    // 2. REAL-TIME CUSTOMER LOOKUP MATCHING
    let matchedCustomer = null;
    const extractedDigits = prompt.replace(/\D/g, ''); // Extract phone digits if spoken/typed

    if (extractedDigits.length >= 7) {
      // Search by Phone Number matching
      matchedCustomer = db.find(c => c.phoneClean && extractedDigits.includes(c.phoneClean));
    }

    if (!matchedCustomer && prompt.length > 2) {
      // Search by Name matching
      const promptLower = prompt.toLowerCase();
      matchedCustomer = db.find(c => c.name && promptLower.includes(c.name.toLowerCase()));
    }

    // 3. ENRICH ITEM NAME WITH REAL-TIME DATABASE DETAILS
    let finalItemName = prompt;
    if (matchedCustomer) {
      finalItemName = `${prompt} | 📍 ${matchedCustomer.address} | 📞 ${matchedCustomer.phoneRaw} | Client #${matchedCustomer.clientNum}`;
    }

    // DEFAULT ROUTE: All standard intakes go directly to Learning Drawer
    const groupId = 'group_mm6b77as';

    const query = `
      mutation ($boardId: ID!, $groupId: String!, $itemName: String!) {
        create_item (board_id: $boardId, group_id: $groupId, item_name: $itemName) {
          id
          name
        }
      }
    `;

    const variables = {
      boardId: boardId,
      groupId: groupId,
      itemName: finalItemName
    };

    const response = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query, variables })
    });

    const resData = await response.json();

    if (resData.errors) {
      console.error('Monday API Errors:', resData.errors);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create item on Monday.com', details: resData.errors })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reply: matchedCustomer ? 'Logged with Customer Auto-Lookup! ⚡' : 'Logged! ⚡',
        item: resData.data.create_item,
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
