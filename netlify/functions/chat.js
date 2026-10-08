// netlify/functions/chat.js
const https = require('https');

function mondayApi(query, variables = {}) {
  const apiKey = process.env.MONDAY_API_KEY || '';
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    const req = https.request('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
        'API-Version': '2023-10'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: body });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { prompt = '', card_id, board_id = '18424728273', customer = '', amount = '', doc_type = 'Invoice' } = body;
    const apiKey = process.env.MONDAY_API_KEY;

    // RULE 1: IF CARD_ID IS PRESENT -> POST UPDATE DIRECTLY TO EXISTING CARD (NEVER CREATE NEW ITEM)
    if (card_id && String(card_id).trim() !== '') {
      const updateMutation = `
        mutation ($itemId: ID!, $body: String!) {
          create_update (item_id: $itemId, body: $body) {
            id
          }
        }
      `;
      
      let noteText = prompt;
      if (prompt === "GENERATE_STRIPE_LINK") {
        noteText = `[STRIPE LINK REQUESTED] ${doc_type} Total: ${amount}`;
      } else if (prompt === "SEND_SMS_INVOICE") {
        noteText = `[SMS SENT] ${doc_type} Total: ${amount}`;
      }

      const res = await mondayApi(updateMutation, {
        itemId: String(card_id),
        body: noteText
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'success',
          action: 'create_update',
          card_id: card_id,
          result: res
        })
      };
    }

    // RULE 2: EXTRACT CUSTOMER NAME & QUERY MONDAY BOARD TO FIND EXISTING FOREVER CARD
    let extractedName = customer;
    if (!extractedName && prompt.includes('[')) {
      const match = prompt.match(/\[(.*?)\]/);
      if (match) extractedName = match[1];
    }
    
    extractedName = (extractedName || '')
      .replace(/Note:.*/i, '')
      .replace(/Schedule.*appointment for /i, '')
      .replace(/Okay let's add.*/i, '')
      .replace(/for noon today.*/i, '')
      .replace(/for today.*/i, '')
      .replace(/at .*/i, '')
      .trim();

    let targetCardId = null;

    if (extractedName && apiKey) {
      const searchQuery = `
        query ($boardId: [ID!], $itemName: String!) {
          boards (ids: $boardId) {
            items_page (query: {rules: [{column_id: "name", compare_value: [$itemName], operator: contains_text}]}) {
              items {
                id
                name
              }
            }
          }
        }
      `;
      
      const searchRes = await mondayApi(searchQuery, {
        boardId: [board_id],
        itemName: extractedName
      });

      const items = searchRes?.data?.boards?.[0]?.items_page?.items || [];
      if (items.length > 0) {
        targetCardId = items[0].id;
      }
    }

    // IF FOREVER CARD EXISTS -> CONSOLIDATE UPDATE ON EXISTING CARD
    if (targetCardId) {
      const updateMutation = `
        mutation ($itemId: ID!, $body: String!) {
          create_update (item_id: $itemId, body: $body) {
            id
          }
        }
      `;
      const res = await mondayApi(updateMutation, {
        itemId: String(targetCardId),
        body: prompt
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'success',
          action: 'create_update',
          card_id: targetCardId,
          matched_customer: extractedName,
          result: res
        })
      };
    }

    // IF NO CARD EXISTS -> CREATE ONE NEW MASTER FOREVER CARD
    const createMutation = `
      mutation ($boardId: ID!, $itemName: String!) {
        create_item (board_id: $boardId, item_name: $itemName) {
          id
        }
      }
    `;
    const newItemName = extractedName || prompt.slice(0, 50) || 'New Customer Intake';
    const createRes = await mondayApi(createMutation, {
      boardId: board_id,
      itemName: newItemName
    });

    const newCardId = createRes?.data?.create_item?.id;

    if (newCardId) {
      const updateMutation = `
        mutation ($itemId: ID!, $body: String!) {
          create_update (item_id: $itemId, body: $body) {
            id
          }
        }
      `;
      await mondayApi(updateMutation, {
        itemId: String(newCardId),
        body: prompt
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: 'success',
        action: 'create_item',
        card_id: newCardId,
        result: createRes
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
