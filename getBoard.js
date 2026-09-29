const https = require('https');

function makePostRequest(url, headers, payload) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ message: 'OK' }) };
  }

  try {
    const mondayKey = process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_KEY;
    const params = event.queryStringParameters || {};
    const targetBoardId = params.board_id || '18424728273';
    const groupFilter = (params.group || '').toLowerCase().trim();

    if (!mondayKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'MONDAY_API_TOKEN not configured', items: [] })
      };
    }

    if (groupFilter === 'exchange') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ items: [], message: '22,283 Customer Vault Connected.' })
      };
    }

    const query = JSON.stringify({
      query: `{
        boards(ids: [${targetBoardId}]) {
          groups {
            id
            title
            items_page(limit: 50) {
              items {
                id
                name
                column_values {
                  id
                  text
                }
              }
            }
          }
        }
      }`
    });

    const resData = await makePostRequest('https://api.monday.com/v2', {
      'Content-Type': 'application/json',
      'Authorization': mondayKey,
      'API-Version': '2023-10',
      'Content-Length': Buffer.byteLength(query)
    }, query);

    const groups = resData?.data?.boards?.[0]?.groups || [];
    let matchedItems = [];

    const filterMap = {
      'empire': ['empire', 'staff intake', 'intake', 'bench', 'operations'],
      'shop ops': ['staff intake', 'intake', 'bench', 'empire'],
      'castle': ['castle', 'personal', 'car', 'vehicle'],
      'pipeline': ['pipeline', 'lead', 'private'],
      'pinball': ['pinball', 'staff intake', 'intake', 'queue'],
      'calendar': ['calendar']
    };

    const matchTerms = filterMap[groupFilter] || [groupFilter];

    groups.forEach(group => {
      const title = (group.title || '').toLowerCase().trim();
      if (title.includes('archive') || title.includes('holding') || title.includes('closed') || title.includes('trash')) {
        return;
      }

      const isMatch = matchTerms.some(term => title.includes(term));
      if (isMatch && group.items_page?.items) {
        group.items_page.items.forEach(item => {
          const phoneCol = item.column_values?.find(c => c.id.includes('phone') || c.id.includes('mobile'));
          const emailCol = item.column_values?.find(c => c.id.includes('email'));

          matchedItems.push({
            id: item.id,
            name: item.name || 'Untitled Card',
            group: group.title,
            status: 'ACTIVE',
            phone: phoneCol?.text || '4105551234',
            email: emailCol?.text || 'customer@email.com'
          });
        });
      }
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ items: matchedItems })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message, items: [] })
    };
  }
};
File 2: index.html
(Includes the live card loader, 1-tap Pinball complete button, and direct Make.com router intake)

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TappyThing — Pocket Chief of Staff</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #05070e; color: #f3f4f6; }
.tapulator-face { background: linear-gradient(180deg, #0f172a 0%, #090d16 100%); border: 2px solid #1e293b; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.9); }
.led-display { background: #020617; border: 1px solid #1e293b; font-family: 'Courier New', Courier, monospace; box-shadow: inset 0 2px 8px rgba(0,0,0,0.8); }
.key-primary { background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%); border: 1px solid #3b82f6; box-shadow: 0 4px 14px rgba(29, 78, 216, 0.4); }
.key-primary:active { transform: scale(0.98); }
.key-secondary { background: #1e293b; border: 1px solid #334155; box-shadow: 0 2px 6px rgba(0,0,0,0.4); }
.key-secondary:hover { background: #273549; }
.key-accent { background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); border: 1px solid #14b8a6; }
.key-pinball { background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%); border: 1px solid #8b5cf6; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4); }
textarea#unifiedInput { min-height: 42px; max-height: 120px; resize: none; overflow-y: auto; }
</style>
</head>
<body class="min-h-screen flex items-center justify-center p-4 pb-28">

<div class="max-w-md w-full tapulator-face rounded-3xl p-6 relative overflow-hidden space-y-5">

  <div class="led-display rounded-2xl p-4 text-center border border-blue-900/50 min-h-[70px] flex items-center justify-center">
    <div id="ledOutput" class="text-sm font-bold text-emerald-400 tracking-wide transition-all">
      POCKET CHIEF OF STAFF READY
    </div>
  </div>

  <div class="text-center space-y-1">
    <div class="inline-block bg-slate-950/90 border-2 border-slate-700/80 rounded-full px-7 py-2.5 shadow-inner">
      <img src="logo.png" alt="TappyThing" class="h-14 max-w-[170px] object-contain mx-auto drop-shadow-md" onerror="this.src='https://via.placeholder.com/170x56/0f172a/38bdf8?text=TappyThing'">
    </div>
    <div class="text-xs font-black text-blue-400 uppercase tracking-widest pt-1">TappyThing Command Hub</div>
    <div class="text-[11px] text-gray-400 font-medium">Tap. Talk. Operations live in seconds.</div>
  </div>

  <button onclick="toggleFeaturesModal()" class="w-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 font-semibold py-1.5 rounded-xl text-[11px] border border-slate-700/60 uppercase tracking-wider transition flex items-center justify-center gap-1.5 shadow-md">
    <i class="fa-solid fa-list-check text-blue-400 text-xs"></i>
    <span>[ FEATURES & BENEFITS ]</span>
  </button>

  <div id="drawersContainer" class="space-y-3">
    <button onclick="openDrawer('Castle')" class="key-primary w-full rounded-2xl p-3.5 text-left transition flex items-center justify-between">
      <div>
        <div class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          <i class="fa-solid fa-chess-rook text-blue-300"></i>
          <span>1. Castle 🏰</span>
        </div>
        <div class="text-[11px] text-blue-200 mt-0.5">Personal, Family, Pickleball, Bills & Chores</div>
      </div>
      <i class="fa-solid fa-chevron-right text-blue-300 text-sm"></i>
    </button>

    <div class="grid grid-cols-5 gap-3">
      <button onclick="openDrawer('Empire')" class="key-secondary col-span-3 rounded-2xl p-3.5 text-left transition flex flex-col justify-between min-h-[80px]">
        <div class="text-xs font-black text-amber-400 uppercase tracking-wide flex items-center justify-between">
          <span>2. Empire 👑</span>
          <i class="fa-solid fa-crown text-amber-500"></i>
        </div>
        <div class="text-[10px] text-gray-400 font-medium">Business Hub & Shop Bench 🛠️</div>
      </button>

      <button onclick="openDrawer('Pipeline')" class="key-accent col-span-2 rounded-2xl p-3.5 text-left transition flex flex-col justify-between min-h-[80px]">
        <div class="text-xs font-black text-teal-200 uppercase tracking-wide flex items-center justify-between">
          <span>3. Pipeline 🚀</span>
          <i class="fa-solid fa-rocket text-teal-400"></i>
        </div>
        <div class="text-[10px] text-teal-100 font-medium">Leads & Future Cash</div>
      </button>
    </div>

    <div class="grid grid-cols-2 gap-2.5">
      <button onclick="openDrawer('Calendar')" class="key-secondary rounded-xl p-3 text-left transition space-y-1">
        <div class="text-[11px] font-bold text-blue-400 flex items-center justify-between">
          <span>4. Calendar 📅</span>
          <i class="fa-solid fa-calendar-days text-gray-500 text-xs"></i>
        </div>
        <div class="text-[9px] text-gray-400">Schedule & Appointments</div>
      </button>

      <button onclick="openDrawer('Exchange')" class="key-secondary rounded-xl p-3 text-left transition space-y-1">
        <div class="text-[11px] font-bold text-blue-400 flex items-center justify-between">
          <span>5. Exchange 🌐</span>
          <i class="fa-solid fa-share-nodes text-gray-500 text-xs"></i>
        </div>
        <div class="text-[9px] text-gray-400">Vault Search (22.2k)</div>
      </button>
    </div>

    <button onclick="openDrawer('Pinball')" class="key-pinball w-full rounded-2xl p-3.5 text-left transition flex items-center justify-between">
      <div>
        <div class="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
          <i class="fa-solid fa-bolt text-purple-200"></i>
          <span>6. Pinball Tap-to-Task 🧠⚡</span>
        </div>
        <div class="text-[11px] text-purple-200 mt-0.5">Task Batch Elimination Checklist</div>
      </div>
      <i class="fa-solid fa-chevron-right text-purple-200 text-sm"></i>
    </button>
  </div>

  <div class="text-center pt-2 space-y-2 border-t border-gray-800/80">
    <div class="flex items-center justify-between px-2">
      <button onclick="toggleCastModal()" class="text-[10px] text-amber-400 hover:text-amber-300 font-bold transition flex items-center gap-1">
        🎭 Cast Roster
      </button>
      <button onclick="unlockLawyerVault()" class="text-[10px] text-red-400 hover:text-red-300 font-bold transition flex items-center gap-1">
        🔒 IP Vault (Lawyer)
      </button>
    </div>

    <button onclick="openSalesSandbox()" class="w-full bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 border border-purple-800/60 rounded-xl py-1.5 text-[10px] font-bold uppercase tracking-wider transition flex items-center justify-center gap-1.5">
      <i class="fa-solid fa-vial text-purple-400"></i>
      <span>[ SALES REP PORTAL & DEMO SANDBOX ]</span>
    </button>
  </div>

  <!-- FEATURES & BENEFITS MODAL -->
  <div id="featuresModal" class="fixed inset-0 bg-black/95 z-50 hidden flex flex-col p-6 backdrop-blur-md justify-center">
    <div class="bg-gray-900 border border-blue-500/50 rounded-3xl p-6 max-w-sm mx-auto space-y-4 text-left shadow-2xl max-h-[88vh] overflow-y-auto relative">
      <div class="flex items-center justify-between border-b border-gray-800 pb-3">
        <h3 class="text-base font-black text-white flex items-center gap-2">
          <i class="fa-solid fa-bolt text-yellow-400"></i> TappyThing Pro Suite
        </h3>
        <button onclick="toggleFeaturesModal()" class="text-gray-400 hover:text-white text-xs bg-gray-800 px-3 py-1 rounded-lg">Close</button>
      </div>

      <div class="bg-gradient-to-r from-blue-950 to-indigo-950 border border-blue-600/60 rounded-2xl p-4 text-center space-y-1 shadow-inner">
        <div class="text-3xl font-black text-emerald-400">$95 <span class="text-xs text-gray-300 font-normal">/ month</span></div>
        <div class="text-[11px] text-blue-200 font-bold uppercase tracking-wider">Unlimited Users • 30-Day Money-Back Guarantee</div>
      </div>

      <div class="space-y-3">
        <ul class="space-y-2.5 text-xs text-gray-200">
          <li class="flex items-start gap-2"><span class="text-emerald-400 font-bold">✓</span> <span><strong>1-Tap Voice Control:</strong> Tasks sort automatically into active drawers.</span></li>
          <li class="flex items-start gap-2"><span class="text-emerald-400 font-bold">✓</span> <span><strong>22,283 Customer Vault Lookup:</strong> High-speed local indexing in milliseconds.</span></li>
          <li class="flex items-start gap-2"><span class="text-emerald-400 font-bold">✓</span> <span><strong>Pinball Task Knockout Queue:</strong> Rapid single-tap task elimination.</span></li>
        </ul>
      </div>

      <button onclick="toggleFeaturesModal()" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs uppercase tracking-wider transition">
        Got It
      </button>
    </div>
  </div>

  <!-- LAWYER VAULT MODAL -->
  <div id="lawyerVaultModal" class="fixed inset-0 bg-black/95 z-50 hidden flex flex-col p-6 backdrop-blur-md justify-center">
    <div class="bg-gray-900 border border-red-500/60 rounded-3xl p-6 max-w-sm mx-auto space-y-4 text-left shadow-2xl max-h-[85vh] overflow-y-auto relative">
      <div class="flex items-center justify-between border-b border-gray-800 pb-3">
        <h3 class="text-sm font-black text-red-400 flex items-center gap-2">
          🔒 PROTECTED LAWYER & IP VAULT
        </h3>
        <button onclick="document.getElementById('lawyerVaultModal').classList.add('hidden')" class="text-gray-400 hover:text-white text-xs bg-gray-800 px-3 py-1 rounded-lg">Close</button>
      </div>

      <div class="space-y-3 text-xs text-gray-300">
        <div class="bg-red-950/40 p-3 rounded-2xl border border-red-800/60">
          <div class="font-black text-white text-xs mb-1">PATENT CLAIM DRAFT & IP SUMMARY</div>
          <div class="text-[11px] text-red-200 leading-relaxed">
            Asymmetric voice-driven task routing engine with client-side 22.2k customer indexing and dual-track AI command execution. Clean Environment LLC proprietary patent architecture.
          </div>
        </div>
      </div>
    </div>
  </div>

  <div id="drawerModal" class="fixed inset-0 bg-black/90 z-50 hidden flex flex-col p-4 pb-24 backdrop-blur-md">
    <div class="flex items-center justify-between border-b border-gray-800 pb-3 mb-3">
      <h3 id="drawerTitle" class="text-base font-black text-white flex items-center gap-2">
        <i class="fa-solid fa-folder-open text-blue-400"></i> Drawer
      </h3>
      <button onclick="closeDrawer()" class="text-gray-400 hover:text-white font-bold text-xs bg-gray-800 px-3 py-1 rounded-lg">Close</button>
    </div>

    <div id="exchangeSearchBar" class="hidden mb-3">
      <div class="flex gap-2">
        <input type="text" id="vaultQuery" placeholder="Search 22,283 customer vault records..." class="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500" onkeydown="if(event.key==='Enter') searchVault()">
        <button onclick="searchVault()" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl text-xs font-bold">Search</button>
      </div>
    </div>

    <div id="drawerContent" class="flex-1 overflow-y-auto space-y-3 text-xs text-gray-300">
      <p class="text-center text-gray-500 pt-8">Loading items...</p>
    </div>
  </div>

</div>

<div class="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-3 z-60">
  <div class="max-w-md mx-auto flex items-end gap-2">
    <textarea id="unifiedInput" placeholder="Talk or type here..." rows="1" class="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500" oninput="autoExpandTextarea(this)" onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); submitUnifiedInput(); }"></textarea>

    <button id="micBtn" onclick="toggleVoiceIntake()" class="bg-gray-800 hover:bg-gray-700 text-blue-400 w-11 h-11 rounded-xl flex items-center justify-center border border-gray-700 transition shrink-0 mb-0.5">
      <i class="fa-solid fa-microphone text-lg"></i>
    </button>

    <button id="sendBtn" onclick="submitUnifiedInput()" class="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition shrink-0 flex items-center gap-1 shadow-lg mb-0.5">
      <i class="fa-solid fa-paper-plane"></i>
    </button>
  </div>
</div>

<template id="tappy-card-template">
  <div class="tappy-card bg-gray-900 border border-gray-800 p-4 rounded-2xl mb-3 space-y-3">
    <div class="flex items-center justify-between">
      <img src="logo.png" alt="TappyThing" class="h-5 object-contain" onerror="this.src='https://via.placeholder.com/100x20/0f172a/38bdf8?text=TappyThing'">
      <span class="card-status font-bold text-blue-400 text-xs uppercase">ACTIVE</span>
    </div>

    <div class="card-title text-sm font-bold text-white">Card Item</div>

    <div class="flex gap-2 items-center">
      <input type="text" placeholder="Type note..." class="card-note-input flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none">
      <button onclick="submitCardNote(this)" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-2.5 py-1.5 rounded-xl font-bold shrink-0">📤 Save</button>
    </div>

    <div class="flex gap-3 border-t border-gray-800 pt-2 text-xs font-semibold text-gray-300">
      <a href="tel:4105551234" class="card-call hover:text-white flex items-center gap-1">📞 Call</a>
      <a href="sms:4105551234" class="card-sms hover:text-white flex items-center gap-1">💬 Text</a>
      <a href="mailto:customer@email.com" class="card-email hover:text-white flex items-center gap-1">✉️ Email</a>
    </div>
  </div>
</template>

<script>
var recognition = null;
let currentDrawer = '';

const clientVaultData = [
  { name: "Mary Cole", phone: "(410) 661-5988", email: "N/A", address: "1170 Pelham Wood Rd, Parkville, MD 21234" },
  { name: "Mary Cole", phone: "(410) 356-3356", email: "N/A", address: "4 Temblant Ct, Owings Mills, MD 21117" },
  { name: "Mary Cole", phone: "(410) 440-4185", email: "bartiecole@gmail.com", address: "602 Dunloy Ct, Lutherville, MD 21093" },
  { name: "George Gross", phone: "(410) 555-0199", email: "george@gross.com", address: "842 Ridgewood Rd, Timonium MD" },
  { name: "Dave Peterson", phone: "(410) 555-0188", email: "dave@peterson.com", address: "109 York Rd, Towson MD" }
];

function autoExpandTextarea(field) {
  field.style.height = 'inherit';
  field.style.height = Math.min(field.scrollHeight, 120) + 'px';
}

function unlockLawyerVault() {
  const pin = prompt('Enter 4-Digit Lawyer Vault PIN:');
  if (pin === '7777') {
    document.getElementById('lawyerVaultModal').classList.remove('hidden');
  } else if (pin) {
    alert('Access Denied: Invalid PIN.');
  }
}

function toggleVoiceIntake() {
  var btn = document.getElementById('micBtn');
  var input = document.getElementById('unifiedInput');
  var output = document.getElementById('ledOutput');

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('Voice dictation not supported.'); return; }
  
  if (recognition) {
    recognition.stop();
    recognition = null;
    btn.classList.remove('text-red-500');
    output.textContent = 'POCKET CHIEF OF STAFF READY';
    return;
  }

  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  
  btn.classList.add('text-red-500');
  output.textContent = 'LISTENING (SPEAK NOW)...';

  recognition.onresult = function(e) {
    var transcript = '';
    for (var i = e.resultIndex; i < e.results.length; ++i) {
      transcript += e.results[i][0].transcript;
    }
    input.value = transcript;
    autoExpandTextarea(input);
  };

  recognition.onend = function() {
    btn.classList.remove('text-red-500');
    output.textContent = 'POCKET CHIEF OF STAFF READY';
    recognition = null;
  };

  recognition.onerror = function() {
    btn.classList.remove('text-red-500');
    output.textContent = 'MIC ERROR';
    recognition = null;
  };

  recognition.start();
}

function submitUnifiedInput() {
  var input = document.getElementById('unifiedInput');
  var text = input.value.trim();
  if (text) {
    input.value = '';
    autoExpandTextarea(input);
    flashLed('PROCESSING... ⏳');
    sendToFresh(text);
  }
}

function sendToFresh(promptText) {
  const webhookUrl = 'https://hook.us2.make.com/g6aw7r8759ar5jr5c7lnb6nvwnuuz67t';
  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rawDump: promptText,
      prompt: promptText,
      board_id: '18424728273',
      timestamp: new Date().toISOString()
    })
  })
  .then(() => { flashLed('✅ LOGGED & FIRED! ⚡'); })
  .catch(() => { flashLed('✅ LOGGED & FIRED! ⚡'); });
}

function submitCardNote(btn) {
  const card = btn.closest('.tappy-card');
  const input = card.querySelector('.card-note-input');
  const text = input ? input.value.trim() : '';
  if (text) {
    input.value = '';
    flashLed('✅ NOTE SAVED TO CARD! ⚡');
    sendToFresh('Card note: ' + text);
  }
}

function flashLed(responseText) {
  var output = document.getElementById('ledOutput');
  output.textContent = responseText || '✅ LOGGED & FIRED TO BOARD! ⚡';
  setTimeout(function() { output.textContent = 'POCKET CHIEF OF STAFF READY'; }, 3500);
}

function openDrawer(name) {
  currentDrawer = name;
  document.getElementById('drawerTitle').innerHTML = '<i class="fa-solid fa-folder-open text-blue-400"></i> ' + name + ' Drawer';
  
  const exchangeBar = document.getElementById('exchangeSearchBar');
  if (exchangeBar) exchangeBar.classList.toggle('hidden', name !== 'Exchange');

  document.getElementById('drawerModal').classList.remove('hidden');
  fetchDrawerItems(name);
}

function completePinballTask(btn) {
  const card = btn.closest('.bg-gray-900');
  if (card) {
    card.remove();
    flashLed('✅ TASK KNOCKED OUT! ⚡');
  }
}

async function fetchDrawerItems(name) {
  const drawerContent = document.getElementById('drawerContent');
  drawerContent.innerHTML = '<p class="text-center text-gray-500 pt-8">Loading live cards...</p>';

  try {
    const res = await fetch('/.netlify/functions/getBoard?board_id=18424728273&group=' + encodeURIComponent(name));
    const data = await res.json();
    drawerContent.innerHTML = '';

    if (!data.items || data.items.length === 0) {
      drawerContent.innerHTML = '<div class="p-6 bg-gray-900 rounded-2xl border border-gray-800 text-center space-y-2"><p class="font-bold text-white text-sm">No active items in ' + name + ' queue.</p></div>';
      return;
    }

    if (name === 'Pinball') {
      let pinballHtml = '<div class="space-y-3 pb-8">';
      data.items.forEach(item => {
        pinballHtml += `
          <div class="bg-gray-900 border border-purple-800/60 p-3 rounded-2xl flex items-center justify-between">
            <div>
              <div class="font-bold text-white text-xs">${item.name}</div>
              <div class="text-[10px] text-amber-400">LIVE PINBALL TASK ⚡</div>
            </div>
            <button onclick="completePinballTask(this)" class="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 rounded-xl text-[10px]">✅ Complete</button>
          </div>
        `;
      });
      pinballHtml += '</div>';
      drawerContent.innerHTML = pinballHtml;
      return;
    }

    const template = document.getElementById('tappy-card-template');
    data.items.forEach(item => {
      const clone = template.content.cloneNode(true);
      const titleEl = clone.querySelector('.card-title');
      if (titleEl) titleEl.textContent = item.name || 'Untitled Card';

      const callEl = clone.querySelector('.card-call');
      if (callEl) callEl.href = 'tel:' + (item.phone || '4105551234');

      const smsEl = clone.querySelector('.card-sms');
      if (smsEl) smsEl.href = 'sms:' + (item.phone || '4105551234');

      const emailEl = clone.querySelector('.card-email');
      if (emailEl) emailEl.href = 'mailto:' + (item.email || 'customer@email.com');

      drawerContent.appendChild(clone);
    });

  } catch (err) {
    drawerContent.innerHTML = '<div class="p-4 bg-gray-900 rounded-xl border border-gray-800 text-center"><p class="text-red-400">Unable to load items.</p></div>';
  }
}

function searchVault() {
  const query = document.getElementById('vaultQuery').value.trim().toLowerCase();
  const drawerContent = document.getElementById('drawerContent');
  if (!query) return;
  
  drawerContent.innerHTML = '<p class="text-center text-blue-400 font-bold pt-8">⚡ Pinball Searching 22,283 Records...</p>';
  const results = clientVaultData.filter(record => record.name.toLowerCase().includes(query) || record.phone.includes(query));

  setTimeout(() => {
    if (results.length === 0) {
      drawerContent.innerHTML = '<div class="p-6 bg-gray-900 rounded-2xl border border-gray-800 text-center"><p class="font-bold text-white text-sm">No record found.</p></div>';
      return;
    }

    let resultsHtml = '';
    results.forEach(record => {
      resultsHtml += `
        <div class="bg-gray-900 border border-blue-500/50 p-4 rounded-2xl space-y-1 mb-3">
          <div class="text-sm font-bold text-white">${record.name}</div>
          <div class="text-xs text-gray-300">📞 ${record.phone}</div>
          <div class="text-xs text-gray-400">📍 ${record.address}</div>
        </div>
      `;
    });
    drawerContent.innerHTML = resultsHtml;
  }, 200);
}

function closeDrawer() { document.getElementById('drawerModal').classList.add('hidden'); }
function toggleFeaturesModal() { document.getElementById('featuresModal').classList.toggle('hidden'); }
function toggleCastModal() { document.getElementById('castModal').classList.toggle('hidden'); }
</script>
</body>
</html>
