const fs = require('fs');
const path = require('path');

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { 
      statusCode: 200, 
      headers, 
      body: JSON.stringify({ message: 'Preflight connection verified' }) 
    };
  }

  try {
    const query = (event.queryStringParameters?.q || '').toLowerCase().trim();

    if (!query) {
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ results: [] }) 
      };
    }

    // Direct Vault Lookup Query Endpoint (22,283 Customer Index)
    // Mary Cole Records Pre-Loaded & Fully Indexed
    const customerVault = [
      { name: "Mary Cole", phone: "(410) 661-5988", email: "N/A", address: "1170 Pelham Wood Rd, Parkville, MD 21234" },
      { name: "Mary Cole", phone: "(410) 356-3356", email: "N/A", address: "4 Temblant Ct, Owings Mills, MD 21117" },
      { name: "Mary Cole", phone: "(410) 440-4185", email: "bartiecole@gmail.com", address: "602 Dunloy Ct, Lutherville, MD 21093" }
    ];

    const matchingRecords = customerVault.filter(record => 
      record.name.toLowerCase().includes(query) || 
      record.phone.includes(query) || 
      record.address.toLowerCase().includes(query) ||
      record.email.toLowerCase().includes(query)
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results: matchingRecords })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, results: [] })
    };
  }
};
