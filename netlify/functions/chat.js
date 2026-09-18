const https = require('https');

exports.handler = function(event, context, callback) {
  if (event.httpMethod !== 'POST') {
    return callback(null, { statusCode: 405, body: 'Method Not Allowed' });
  }

  var body = JSON.parse(event.body || '{}');
  var prompt = body.prompt || body.message || '';
  var apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return callback(null, {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: 'API key missing.' })
    });
  }

  var fullPrompt = 'You are Fresh, a sharp Digital Coordinator for William Sullivan at Aerus Home Wellness in Timonium MD. Be direct, helpful, and energetic. Max 3 sentences. User says: ' + prompt;

  var postData = JSON.stringify({
    contents: [{ parts: [{ text: fullPrompt }] }],
    generationConfig: { temperature: 0.9, maxOutputTokens: 200 }
  });

  var options = {
    hostname: 'generativelanguage.googleapis.com',
    path: '/v1beta/models/gemini-3.6-flash:generateContent?key=' + apiKey,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  var req = https.request(options, function(res) {
    var data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      try {
        var parsed = JSON.parse(data);
        var reply = parsed.candidates[0].content.parts[0].text;
        callback(null, {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reply: reply.trim() })
        });
      } catch(e) {
        callback(null, {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reply: 'ERROR: ' + data.substring(0, 200) })
        });
      }
    });
  });

  req.on('error', function(e) {
    callback(null, {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reply: 'Connection error: ' + e.message })
    });
  });

  req.write(postData);
  req.end();
};
