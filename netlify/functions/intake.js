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

    // 1. Dynamic Extraction Regex
    const nameMatch = rawTranscript.match(
      /(?:customer|client|for|name is|this is)\s+([a-zA-Z\.\s]+?)(?=\s+(?:at|on|for|needs|with|\$|\.|$))/i
    );
    const scheduleMatch = rawTranscript.match(
      /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d{1,2}:\d{2}\s*(?:am|pm)?|\d{1,2}\s*(?:am|pm))\b/i
    );
    const isPinball = /\b(pinball|quick note|task|reminder)\b/i.test(rawTranscript) || payload.destination === "pinball";
    const isBench = /\b(bench|workbench|mike)\b/i.test(rawTranscript) || payload.destination === "workbench";

    // 2. Resolve Client Name (preserves Mrs. / Dr. / Full Names)
    let extractedName = (payload.clientName || "").trim();
    if (!extractedName || extractedName.toLowerCase() === "valued customer") {
      if (nameMatch) {
        extractedName = nameMatch[1].trim();
      } else {
        const cleanedWords = rawTranscript
          .replace(/^(?:intake for|intake|repair for|job for|note for|service for|schedule for)\s+/i, "")
          .split(/\s+/)
          .filter(Boolean);

        if (cleanedWords.length >= 2) {
          extractedName = `${cleanedWords[0]} ${cleanedWords[1]}`;
        } else if (cleanedWords.length === 1) {
          extractedName = cleanedWords[0];
        } else {
          extractedName = isPinball ? "Quick Task" : "New Service Lead";
        }
      }
    }

    // Clean formatting and title-case
    const finalClientName = extractedName
      .replace(/[^a-zA-Z\.\s]/g, "")
      .trim()
      .split(/\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    // 3. Resolve Destination Group
    const boardId = 18424728273;
    let groupId = "group_mm6b77as"; // Default: Counter Intake

    if (isPinball) {
      groupId = "group_mm7mmekt"; // Pinball Queue
    } else if (scheduleMatch || payload.isScheduled || payload.destination === "calendar") {
      groupId = "group_mm7maw66"; // Calendar
    } else if (isBench) {
      groupId = "group_mm76qbbh"; // Mike's Workbench
    }

    // 4. Build Column Values
    const columnValues = {
      long_text_mm5vbykc: { text: rawTranscript },
    };

    // If scheduled for today, attach today's date so Calendar integration fires
    if (scheduleMatch || payload.isScheduled) {
      const today = new Date().toISOString().slice(0, 10);
      columnValues.date = { date: today };
    }

    // 5. Direct Mutation Write
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
      columnValues: JSON.stringify(columnValues),
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
        destination: groupId,
        isScheduled: Boolean(scheduleMatch),
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
