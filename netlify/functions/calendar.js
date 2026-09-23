const https = require('https');

// Helper to make HTTPS requests returning a Promise
function makeHttpRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// 1. Fetch fresh Access Token using OAuth Refresh Token
async function getAccessToken(clientId, clientSecret, refreshToken) {
  const postData = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  }).toString();

  const options = {
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const res = await makeHttpRequest(options, postData);
  if (!res.access_token) {
    throw new Error(res.error_description || 'Failed to refresh Google access token');
  }
  return res.access_token;
}

// 2. Fetch list of ALL user calendars
async function getAllCalendars(accessToken) {
  const options = {
    hostname: 'www.googleapis.com',
    path: '/calendar/v3/users/me/calendarList',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  };

  const res = await makeHttpRequest(options);
  return (res.items || []).map(cal => cal.id);
}

// 3. Fetch today's events for a single calendar in America/New_York timezone
async function getTodayEventsForCalendar(accessToken, calendarId, timeMin, timeMax) {
  const path = `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` + new URLSearchParams({
    timeMin: timeMin,
    timeMax: timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    timeZone: 'America/New_York'
  }).toString();

  const options = {
    hostname: 'www.googleapis.com',
    path: path,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  };

  try {
    const res = await makeHttpRequest(options);
    const now = new Date();

    return (res.items || []).map(item => {
      const startStr = item.start?.dateTime || item.start?.date;
      const endStr = item.end?.dateTime || item.end?.date;
      
      const startDate = new Date(startStr);
      const endDate = new Date(endStr);

      const isPast = endDate < now;
      const isCurrent = startDate <= now && endDate >= now;

      const formattedTime = item.start?.dateTime 
        ? startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })
        : 'All Day';

      return {
        summary: item.summary || 'Busy',
        start: startStr,
        end: endStr,
        time: formattedTime,
        isPast: isPast,
        isCurrent: isCurrent
      };
    });
  } catch (err) {
    console.log(`Error fetching calendar ${calendarId}:`, err);
    return [];
  }
}

exports.handler = async function(event, context) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      return {
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ success: false, error: "Google OAuth credentials not configured" })
      };
    }

    // Step 1: Refresh Access Token
    const accessToken = await getAccessToken(clientId, clientSecret, refreshToken);

    // Step 2: Calculate start and end of today in New York timezone
    const now = new Date();
    const nyDateStr = now.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    const todayNY = new Date(nyDateStr);

    const startOfDay = new Date(todayNY.getFullYear(), todayNY.getMonth(), todayNY.getDate(), 0, 0, 0);
    const endOfDay = new Date(todayNY.getFullYear(), todayNY.getMonth(), todayNY.getDate(), 23, 59, 59);

    const timeMin = startOfDay.toISOString();
    const timeMax = endOfDay.toISOString();

    // Step 3: Fetch all calendars
    const calendarIds = await getAllCalendars(accessToken);

    // Step 4: Fetch events from all calendars in parallel
    const eventPromises = calendarIds.map(calId => getTodayEventsForCalendar(accessToken, calId, timeMin, timeMax));
    const rawEventArrays = await Promise.all(eventPromises);

    // Step 5: Merge and deduplicate
    const mergedEvents = [];
    const seenKeys = new Set();

    rawEventArrays.flat().forEach(ev => {
      const uniqueKey = `${ev.summary}-${ev.start}`;
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        mergedEvents.push(ev);
      }
    });

    // Step 6: Sort chronologically by start time
    mergedEvents.sort((a, b) => new Date(a.start) - new Date(b.start));

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ success: true, events: mergedEvents })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
};
