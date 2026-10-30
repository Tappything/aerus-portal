exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: "Method Not Allowed" }),
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const rawTranscript = (payload.transcript || "").trim();
    let clientName = (payload.clientName || "").trim();

    // 1. NLP / Regex Extraction: Isolate customer name if defaulted or missing
    if (!clientName || clientName.toLowerCase() === "valued customer" || clientName.toLowerCase() === "direct intake") {
      const match = rawTranscript.match(/^(?:intake for\s+|customer\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
      if (match) {
        clientName = match[1].trim();
      } else {
        clientName = "Valued Customer";
      }
    }

    const notes = rawTranscript;
    const boardId = 18424728273;
    const groupId = "group_mm6b77as";

    // 2. Direct GraphQL Mutation to Monday.com with exact column ID
    const query = `
      mutation createIntakeCard($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) {
          id
        }
      }
    `;

    const variables = {
      boardId: boardId,
      groupId: groupId,
      itemName: clientName,
      columnValues: JSON.stringify({
        long_text_mm5vbykc: { text: notes }
      }),
    };

    const response = await fetch("https://api.monday.com/v2", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: process.env.MONDAY_API_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    });

    const result = await response.json();

    if (result.errors) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ ok: false, errors: result.errors, fallbackClient: clientName }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        itemId: result.data?.create_item?.id || Date.now().toString(),
        clientName: clientName,
        notes: notes,
        status: "intake",
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
