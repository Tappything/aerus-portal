exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ ok: false, error: "Method Not Allowed" }),
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const rawTranscript = (payload.transcript || "").trim();

    // 1. Case-Insensitive Pattern Matching for Voice Transcripts
    const nameMatch = rawTranscript.match(
      /(?:customer|client|for|name is|this is)\s+([a-z]+(?:\s+[a-z]+)*)/i
    );
    const scheduleMatch = rawTranscript.match(
      /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i
    );

    // 2. Dynamic Name Extraction (Handles lowercase speech cleanly)
    let extractedName = (payload.clientName || "").trim();

    if (!extractedName || extractedName.toLowerCase() === "valued customer") {
      if (nameMatch) {
        extractedName = nameMatch[1].trim();
      } else {
        // Strip common voice intake opening filler words
        const cleanedWords = rawTranscript
          .replace(/^(?:intake for|intake|repair for|job for|note for|service for)\s+/i, "")
          .split(/\s+/)
          .filter(Boolean);

        if (cleanedWords.length >= 2) {
          extractedName = `${cleanedWords[0]} ${cleanedWords[1]}`;
        } else if (cleanedWords.length === 1) {
          extractedName = cleanedWords[0];
        } else {
          extractedName = "New Service Lead";
        }
      }
    }

    // Clean punctuation and title-case the resolved name
    const finalClientName = extractedName
      .replace(/[^a-zA-Z\s]/g, "")
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");

    // 3. Direct Board Write (Persists card to command hub)
    const boardId = 18424728273;
    const groupId = "group_mm6b77as";

    const query = `
      mutation createIntakeItem($boardId: ID!, $groupId: String!, $itemName: String!, $columnValues: JSON!) {
        create_item(board_id: $boardId, group_id: $groupId, item_name: $itemName, column_values: $columnValues) {
          id
        }
      }
    `;

    const variables = {
      boardId: boardId,
      groupId: groupId,
      itemName: finalClientName,
      columnValues: JSON.stringify({
        long_text_mm5vbykc: { text: rawTranscript },
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
        statusCode: 500,
        body: JSON.stringify({ ok: false, errors: result.errors }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        itemId: result.data.create_item.id,
        clientName: finalClientName,
        notes: rawTranscript,
        isScheduled: Boolean(scheduleMatch),
        status: "intake",
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
