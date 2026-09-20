const https = require('https');

// Simple regex parser for iCal format to avoid heavy external dependencies
function parseICS(icsData) {
  const events = [];
  const now = new Date();
  const veventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let match;

  while ((match = veventRegex.exec(icsData)) !== null) {
    const eventContent = match[1];
    
    const summaryMatch = eventContent.match(/SUMMARY:(.*)/);
    const dtstartMatch = eventContent.match(/DTSTART(?:;[^:]*)?:(.*)/);
    const dtendMatch = eventContent.match(/DTEND(?:;[^:]*)?:(.*)/);

    if (dtstartMatch) {
      const summary = summaryMatch ? summaryMatch[1].trim() : 'Event';
      const startDateStr = parseiCalDate(dtstartMatch[1].trim());
      const endDateStr = dtendMatch ? parseiCalDate(dtendMatch[1].trim()) : startDateStr;

      const startDate = new Date(startDateStr);
      const endDate = new Date(endDateStr);

      const isPast = endDate < now;
      const isCurrent = startDate <= now && endDate >= now;

      events.push({
        summary,
        start: startDateStr,
        end: endDateStr,
        isPast,
        isCurrent
      });
    }
  }
  return events;
}

function parseiCalDate(dateStr) {
  // Converts YYYYMMDDTHHMMSSZ or YYYYMMDD to ISO string
  if (dateStr.length === 8) {
    const y = dateStr.substring(0, 4);
    const m = dateStr.substring(4, 6);
    const d = dateStr.substring(6, 8);
    return `${y}-${m}-${d}T00:00:00.000Z`;
  }
  const y = dateStr.substring(0, 4);
  const m = dateStr.substring(4, 6);
  const d = dateStr.substring(6, 8);
  const h = dateStr.substring(9, 11) || '00';
  const min = dateStr.substring(11, 13) || '00';
  const s = dateStr.substring(13, 15) || '00';
  return `${y}-${m}-${d}T${h}:${min}:${s}.000Z`;
}

exports.handler = async function(event, context) {
  const calendarId = 'william@towsonhealthyhomes.com';
  const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;

  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsedEvents = parseICS(data);
          resolve({
            statusCode: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ success: true, events: parsedEvents })
          });
        } catch (err) {
          resolve({
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ success: false, error: err.message })
          });
        }
      });
    }).on('error', (e) => {
      resolve({
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: false, error: e.message })
      });
    });
  });
};
