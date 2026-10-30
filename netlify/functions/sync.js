exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Generic multi-tenant failsafe queue if token or network is unavailable
  const fallbackFloor = {
    pinball: [
      {
        id: 'DEMO-101',
        clientName: "Valued Customer",
        text: "Sample intake assessment and equipment checkup.",
        phone: "",
        address: "On File",
        status: "intake",
        time: "In Shop",
        timestamp: "Active",
        lineItems: [
          { desc: "Standard Equipment Diagnostic & Labor", qty: 1, price: 50.00, isTaxable: false }
        ],
        totalAmount: 50.00
      }
    ],
    scheduled: []
  };

  const MONDAY_TOKEN = process.env.MONDAY_API_TOKEN;
  const BOARD_ID = process.env.MONDAY_BOARD_ID || '18424728273';

  if (!MONDAY_TOKEN) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(fallbackFloor)
    };
  }

  const query = `
    query {
      boards(ids: [${BOARD_ID}]) {
        items_page(limit: 50) {
          items {
            id
            name
            group {
              title
            }
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

  try {
    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": MONDAY_TOKEN,
        "API-Version": "2024-01"
      },
      body: JSON.stringify({ query })
    });

    const data = await response.json();
    const rawItems = data?.data?.boards?.[0]?.items_page?.items;

    if (!rawItems || rawItems.length === 0) {
      return { statusCode: 200, headers, body: JSON.stringify(fallbackFloor) };
    }

    const pinball = [];
    const scheduled = [];

    rawItems.forEach(item => {
      const clientName = item.name ? item.name.trim() : "Valued Customer";
      let textNote = "";
      let phone = "";
      let address = "";
      let status = "intake";
      let time = "In Shop";
      let isScheduled = false;

      (item.column_values || []).forEach(col => {
        const lowerId = (col.id || "").toLowerCase();
        const lowerText = (col.text || "").toLowerCase();

        if (lowerId.includes("text") || lowerId.includes("note") || lowerId.includes("desc")) {
          if (col.text) textNote = col.text.trim();
        } else if (lowerId.includes("phone") || lowerId.includes("cell") || lowerId.includes("contact")) {
          if (col.text) phone = col.text.trim();
        } else if (lowerId.includes("address") || lowerId.includes("location")) {
          if (col.text) address = col.text.trim();
        } else if (lowerId.includes("status") || lowerId.includes("lane")) {
          if (lowerText.includes("bench")) status = "bench";
          else if (lowerText.includes("part")) status = "parts";
          else if (lowerText.includes("ready")) status = "ready";
          else status = "intake";
        } else if (lowerId.includes("date") || lowerId.includes("time") || lowerId.includes("schedule")) {
          if (col.text) {
            time = col.text.trim();
            isScheduled = true;
          }
        }
      });

      const card = {
        id: item.id,
        clientName: clientName,
        text: textNote || clientName,
        phone: phone,
        address: address,
        status: status,
        time: time,
        timestamp: "Active",
        lineItems: [
          { desc: textNote || "Service Diagnostic & Labor", qty: 1, price: 50.00, isTaxable: false }
        ],
        totalAmount: 50.00
      };

      if (isScheduled || (item.group?.title && item.group.title.toLowerCase().includes("schedule"))) {
        scheduled.push(card);
      } else {
        pinball.push(card);
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ pinball, scheduled })
    };

  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(fallbackFloor)
    };
  }
};
