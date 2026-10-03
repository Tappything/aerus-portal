const querystring = require('querystring');

exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'text/xml'
  };

  try {
    // 1. Parse Twilio POST body (form-urlencoded)
    let bodyData = {};
    if (event.isBase64Encoded) {
      bodyData = querystring.parse(Buffer.from(event.body || '', 'base64').toString('utf-8'));
    } else {
      bodyData = querystring.parse(event.body || '');
    }

    const fromNumber = bodyData.From || bodyData.from || '';
    const messageBody = bodyData.Body || bodyData.body || '';

    const token = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY || process.env.MONDAY_TOKEN;
    const boardId = "18424728273";

    if (!fromNumber || !token) {
      return {
        statusCode: 200,
        headers,
        body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
      };
    }

    const cleanPhone = fromNumber.replace(/\D/g, '');
    const shortPhone = cleanPhone.length > 10 ? cleanPhone.slice(-10) : cleanPhone;

    // 2. Search Monday board for existing card by Phone column
    const searchQuery = `query {
      boards(ids: [${boardId}]) {
        items_page(query_params: { rules: [{ column_id: "phone", compare_value: ["${fromNumber}", "${shortPhone}"], operator: contains_text }] }) {
          items {
            id
            name
          }
        }
      }
    }`;

    const searchRes = await fetch('https://api.monday.com/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
        'API-Version': '2023-10'
      },
      body: JSON.stringify({ query: searchQuery })
    });

    const searchData = await searchRes.json();
    const existingItems = searchData.data?.boards?.[0]?.items_page?.items || [];

    if (existingItems.length > 0) {
      // 3. If found: Append message as update thread to existing card
      const itemId = existingItems[0].id;
      const updateText = `📱 INCOMING SMS (${fromNumber}):\n${messageBody}`;
      const sanitizedBody = updateText.replace(/"/g, '\\"');

      const updateMutation = `mutation {
        create_update(item_id: ${itemId}, body: "${sanitizedBody}") {
          id
        }
      }`;

      await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'API-Version': '2023-10'
        },
        body: JSON.stringify({ query: updateMutation })
      });
    } else {
      // 4. If not found: Create new card in Staff Intake group (group_mm6b77as)
      const targetGroup = "group_mm6b77as";
      const cardTitle = `📱 SMS from ${fromNumber}: ${messageBody}`;
      const sanitizedTitle = cardTitle.replace(/"/g, '\\"').replace(/\n/g, ' ');

      const createMutation = `mutation {
        create_item(board_id: ${boardId}, group_id: "${targetGroup}", item_name: "${sanitizedTitle}") {
          id
        }
      }`;

      await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
          'API-Version': '2023-10'
        },
        body: JSON.stringify({ query: createMutation })
      });
    }

    // 5. Return Twilio-formatted XML response
    return {
      statusCode: 200,
      headers,
      body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    };
  } catch (err) {
    console.error('Twilio webhook handler error:', err);
    return {
      statusCode: 200,
      headers,
      body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'
    };
  }
};
