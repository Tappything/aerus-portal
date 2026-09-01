const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    const API_KEY = process.env.MONDAY_API_KEY;
    const body = JSON.parse(event.body || '{}');
    const boardId = body.boardId || '18424728273';

    const query = `query { boards(ids: ${boardId}) { items_page { items { id name column_values { title text } } } } }`;

    try {
        const response = await fetch('https://api.monday.com/v2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': API_KEY
            },
            body: JSON.stringify({ query })
        });
        const data = await response.json();
        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify(data)
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
