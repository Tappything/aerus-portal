exports.handler = async (event, context) => {
  try {
    const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Missing Google Calendar OAuth environment variables.');
    }

    // Step 1: Exchange Refresh Token for an Access Token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      throw new Error(`Failed to obtain access token: ${JSON.stringify(tokenData)}`);
    }

    const accessToken = tokenData.access_token;

    // Step 2: Set boundaries for TODAY only
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const timeMin = encodeURIComponent(startOfDay.toISOString());
    const timeMax = encodeURIComponent(endOfDay.toISOString());

    // Step 3: Fetch today's events from Google Calendar REST API
    const calendarUrl = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;

    const calResponse = await fetch(calendarUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const calData = await calResponse.json();

    if (calData.error) {
      throw new Error(`Calendar API Error: ${calData.error.message}`);
    }

    // Step 4: Map events with rolling flags (isPast, isCurrent)
    const events = (calData.items || []).map(evt => {
      const startTime = new Date(evt.start.dateTime || evt.start.date);
      const endTime = new Date(evt.end.dateTime || evt.end.date);

      return {
        ...evt,
        isPast: endTime < now,
        isCurrent: startTime <= now && endTime >= now
      };
    });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        events
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
