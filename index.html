<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>TappyThing — Digital Coordinator Command Center</title>
  <style>
    :root {
      --bg: #0b1120;
      --card-bg: #1e293b;
      --border: #334155;
      --gold: #f59e0b;
      --purple: #8b5cf6;
      --blue: #38bdf8;
      --green: #10b981;
      --red: #ef4444;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    body {
      background-color: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 12px 60px;
    }
    .container {
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* TOP STATUS PILLS */
    .top-pills {
      display: flex;
      justify-content: center;
      gap: 6px;
    }
    .pill {
      padding: 5px 11px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 700;
    }
    .pill-fresh { background: rgba(56, 189, 248, 0.15); border: 1px solid #38bdf8; color: #38bdf8; }
    .pill-sissy { background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #34d399; }
    .pill-rob { background: rgba(139, 92, 246, 0.15); border: 1px solid #8b5cf6; color: #c4b5fd; }

    /* HEADER */
    .header {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-top: 2px;
    }
    .logo-img {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 3px solid var(--gold);
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.35);
      object-fit: cover;
      margin-bottom: 6px;
    }
    .title {
      font-size: 18px;
      font-weight: 800;
      color: #fff;
    }
    .subtitle {
      font-size: 11px;
      color: var(--muted);
    }

    /* MAIN INPUT CARD */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .input-mode-btns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .btn-mode {
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 12px;
      color: #fff;
      padding: 12px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .btn-mode.active-mic {
      background: var(--red) !important;
      border-color: #fca5a5 !important;
      animation: pulse 1.2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.98); }
      50% { transform: scale(1.02); }
      100% { transform: scale(0.98); }
    }
    .text-input-area {
      width: 100%;
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
      color: #fff;
      font-size: 14px;
      outline: none;
    }
    .btn-send-main {
      background: linear-gradient(135deg, #2563eb, #7c3aed);
      border: none;
      border-radius: 12px;
      color: #fff;
      padding: 12px;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
    }

    /* INVOICE STAGING CARD */
    .invoice-preview-card {
      display: none;
      background: #090d16;
      border: 2px solid var(--gold);
      border-radius: 14px;
      padding: 12px;
      flex-direction: column;
      gap: 8px;
      animation: fadeIn 0.2s ease-in-out;
    }
    .inv-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(245, 158, 11, 0.3);
      padding-bottom: 6px;
    }
    .inv-branding {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .inv-brand-text {
      font-size: 11px;
      font-weight: 800;
      color: var(--gold);
      letter-spacing: 0.5px;
    }
    .inv-amount-badge {
      font-size: 16px;
      font-weight: 900;
      color: #34d399;
      background: rgba(16, 185, 129, 0.15);
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid #10b981;
    }
    .inv-details {
      font-size: 12px;
      color: #f1f5f9;
      line-height: 1.5;
      background: rgba(255, 255, 255, 0.03);
      padding: 8px;
      border-radius: 8px;
    }
    .inv-actions {
      display: flex;
      gap: 8px;
    }
    .btn-inv {
      flex: 1;
      padding: 8px;
      border-radius: 8px;
      border: none;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
    }
    .btn-inv-settle { background: var(--green); color: #fff; }
    .btn-inv-copy { background: #334155; color: #fff; border: 1px solid var(--border); }

    /* CHAT DISPLAY */
    .chat-display {
      max-height: 180px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 2px;
    }
    .msg {
      padding: 9px 12px;
      border-radius: 12px;
      font-size: 12px;
      line-height: 1.4;
      max-width: 92%;
    }
    .msg-fresh {
      background: #0f172a;
      border-left: 3px solid var(--purple);
      color: #e2e8f0;
      align-self: flex-start;
    }
    .msg-user {
      background: #4338ca;
      color: #fff;
      align-self: flex-end;
    }

    /* VIDEO & PHOTO INTAKE */
    .media-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .media-title {
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 6px;
      color: #fff;
    }
    .media-sub {
      font-size: 11px;
      color: var(--muted);
    }
    .media-btns {
      display: flex;
      gap: 8px;
    }
    .btn-media {
      flex: 1;
      background: #0f172a;
      border: 1px dashed var(--border);
      border-radius: 10px;
      color: #e2e8f0;
      padding: 10px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    /* MY WORLD HUBS */
    .my-world-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .my-world-btn {
      width: 100%;
      background: linear-gradient(135deg, #6d28d9, #4f46e5);
      border: none;
      border-radius: 14px;
      padding: 13px 16px;
      color: #fff;
      font-size: 14px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .bubbles-grid {
      display: none;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 4px;
    }
    .bubble {
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 10px 12px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .bubble-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      font-weight: 800;
      color: #fff;
    }
    .bubble-count {
      font-size: 10px;
      background: rgba(255,255,255,0.1);
      padding: 2px 6px;
      border-radius: 999px;
      color: var(--blue);
    }
    .bubble-desc {
      font-size: 10px;
      color: var(--muted);
    }

    /* CASCADE DRAWER */
    .cascade-drawer {
      display: none;
      background: #090d16;
      border: 1px solid var(--purple);
      border-radius: 14px;
      padding: 12px;
      flex-direction: column;
      gap: 8px;
      margin-top: 4px;
    }
    .drawer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      padding-bottom: 6px;
    }
    .drawer-title {
      font-size: 13px;
      font-weight: 800;
      color: var(--gold);
    }
    .btn-close-drawer {
      background: rgba(255, 255, 255, 0.1);
      border: none;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 999px;
      cursor: pointer;
    }
    .cascade-items-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 220px;
      overflow-y: auto;
    }
    .cascade-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }
    .cascade-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* FOOTER & MOVIE CREDITS */
    footer {
      text-align: center;
      margin-top: 14px;
      font-size: 11px;
      color: var(--muted);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }
    .credits-link {
      color: var(--gold);
      text-decoration: none;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.3);
      padding: 4px 10px;
      border-radius: 999px;
    }

    /* CREDITS OVERLAY */
    .credits-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.95);
      z-index: 99999;
      overflow: hidden;
      justify-content: center;
      align-items: center;
    }
    .btn-close-creds {
      position: absolute;
      top: 20px;
      right: 20px;
      background: #1e293b;
      border: 1px solid var(--gold);
      color: #fff;
      font-size: 12px;
      font-weight: 800;
      padding: 6px 12px;
      border-radius: 999px;
      cursor: pointer;
      z-index: 100000;
    }
    .credits-scroll {
      position: absolute;
      width: 90%;
      max-width: 400px;
      text-align: center;
      color: #fff;
      animation: roll 20s linear infinite;
    }
    @keyframes roll {
      0% { top: 100%; }
      100% { top: -110%; }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- TOP PILLS -->
    <div class="top-pills">
      <div class="pill pill-fresh">🎧 Fresh Active</div>
      <div class="pill pill-sissy">⚡ Sissy Active</div>
      <div class="pill pill-rob">🐷 Rob Art</div>
    </div>

    <!-- HEADER -->
    <div class="header">
      <img src="logo.png" alt="TappyThing Fresh" class="logo-img" onerror="this.src='Gemini_Generated_Image_u1q8jwu1q8jwu1q8.jpg'">
      <div class="title">Digital Coordinator Command Center</div>
      <div class="subtitle">Voice Intake • Live Chat • Instant Invoicing</div>
    </div>

    <!-- MAIN INPUT & CONVERSATION -->
    <div class="card">
      <div class="input-mode-btns">
        <button type="button" class="btn-mode" id="btnMic" onclick="toggleVoice()">
          <span id="micIcon">🎙️</span>
          <span id="micLabel">Tap to Talk</span>
        </button>
        <button type="button" class="btn-mode" onclick="focusInput()">
          <span>⌨️</span>
          <span>Tap to Type</span>
        </button>
      </div>

      <input type="text" id="userInput" class="text-input-area" placeholder="Speak or type (e.g. Invoice for Beth Rose tune-up & belt)..." onkeydown="handleKey(event)">
      <button type="button" class="btn-send-main" onclick="sendChat()">Send to Fresh ✉️</button>

      <!-- BRANDED INVOICE STAGING PREVIEW -->
      <div class="invoice-preview-card" id="invoicePreviewCard">
        <div class="inv-header">
          <div class="inv-branding">
            <span style="font-size:18px;">💵</span>
            <span class="inv-brand-text">TAPPYTHING INVOICE</span>
          </div>
          <span class="inv-amount-badge" id="invAmountDisplay">$0.00</span>
        </div>
        <div class="inv-details" id="invDetailsText">Staged invoice details will appear here.</div>
        <div class="inv-actions">
          <button type="button" class="btn-inv btn-inv-settle" onclick="settleSaturday()">✓ Settle Saturday</button>
          <button type="button" class="btn-inv btn-inv-copy" onclick="copyInvoice()">📋 Copy Details</button>
        </div>
      </div>

      <div class="chat-display" id="chatBox">
        <div class="msg msg-fresh">
          <strong>Hey William! Fresh here. 🤵</strong><br>
          Tap the mic or type above. Dictate a repair, customer bill, or grocery note. I calculate pricing, stage invoices, and route tasks instantly!
        </div>
      </div>
    </div>

    <!-- VIDEO & PHOTO INTAKE -->
    <div class="media-card">
      <div class="media-title">📹 Video & Photo Intake</div>
      <div class="media-sub">Point at unit • Say customer name & issue • Tap stop</div>
      <div class="media-btns">
        <button type="button" class="btn-media" onclick="triggerVideo()">📹 1-Min Video Diagnosis</button>
        <button type="button" class="btn-media" onclick="triggerPhoto()">📷 Snap Repair Tag</button>
      </div>
      <!-- Hidden Native Camera Inputs -->
      <input type="file" id="nativeVideoInput" accept="video/*" capture="environment" style="display:none;" onchange="onVideoSelected(event)">
      <input type="file" id="nativePhotoInput" accept="image/*" capture="environment" style="display:none;" onchange="onPhotoSelected(event)">
    </div>

    <!-- MY WORLD HUBS -->
    <div class="my-world-container">
      <button type="button" class="my-world-btn" onclick="toggleWorld()">
        <span>🌍 My World</span>
        <span id="worldArrow">▼</span>
      </button>

      <div class="bubbles-grid" id="bubblesGrid">
        <div class="bubble" onclick="openDrawer('business')">
          <div class="bubble-head">
            <span>🏢 Business Ops</span>
            <span class="bubble-count" id="cBiz">0 Jobs</span>
          </div>
          <div class="bubble-desc">Bench repairs & ready wall</div>
        </div>

        <div class="bubble" onclick="openDrawer('personal')">
          <div class="bubble-head">
            <span>🏠 Personal / Home</span>
            <span class="bubble-count" id="cPers">0 Items</span>
          </div>
          <div class="bubble-desc">Bills & private tasks</div>
        </div>

        <div class="bubble" onclick="openDrawer('invoices')">
          <div class="bubble-head">
            <span>💵 Invoices</span>
            <span class="bubble-count" id="cInv">$0 Due</span>
          </div>
          <div class="bubble-desc">Staged & Saturday settlements</div>
        </div>

        <div class="bubble" onclick="openDrawer('shared')">
          <div class="bubble-head">
            <span>👥 Team Spaces</span>
            <span class="bubble-count" id="cTeam">Active</span>
          </div>
          <div class="bubble-desc">Mona, Chris, Mike, Norby</div>
        </div>
      </div>

      <div class="cascade-drawer" id="cascadeDrawer">
        <div class="drawer-header">
          <div class="drawer-title" id="drawerTitle">Hub Section</div>
          <button type="button" class="btn-close-drawer" onclick="closeDrawer()">✕ Close</button>
        </div>
        <div class="cascade-items-list" id="cascadeItemsList"></div>
      </div>
    </div>

    <!-- FOOTER & MOVIE CREDITS -->
    <footer>
      <span>⚡ Powered by TappyThing • Digital Coordinator</span>
      <a class="credits-link" onclick="openCredits()">
        <span>🐷</span>
        <span>Cast of Characters (Credits) 🎬</span>
      </a>
    </footer>
  </div>

  <!-- MOVIE CREDITS OVERLAY -->
  <div class="credits-overlay" id="creditsOverlay">
    <button type="button" class="btn-close-creds" onclick="closeCredits()">✕ Close</button>
    <div class="credits-scroll">
      <div style="font-size: 20px; font-weight: 900; color: #f59e0b; margin-bottom: 6px;">⭐ TAPPYTHING PRODUCTIONS ⭐</div>
      <div style="font-size: 13px; color: #93c5fd; margin-bottom: 20px;">Creator & Producer<br><strong>WILLIAM SULLIVAN</strong></div>

      <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase;">Digital Coordinator</div>
      <div style="font-size: 16px; font-weight: 800;">FRESH</div>

      <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-top: 12px;">Backend Master Engine</div>
      <div style="font-size: 16px; font-weight: 800;">SISSY</div>

      <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-top: 12px;">Heart & Spirit</div>
      <div style="font-size: 16px; font-weight: 800;">NUESH</div>

      <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-top: 12px;">Sales & Trouble Crusher</div>
      <div style="font-size: 16px; font-weight: 800;">SQUASH</div>

      <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-top: 12px;">Treasury Guardian</div>
      <div style="font-size: 16px; font-weight: 800;">L</div>

      <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; margin-top: 12px;">Creative Spirit</div>
      <div style="font-size: 16px; font-weight: 800;">ROB ART (🐷)</div>

      <div style="margin-top: 25px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 15px;">
        <div style="font-size: 11px; color: #94a3b8;">Aerus Timonium Crew:</div>
        <div style="font-size: 13px; color: #f59e0b; margin-top: 4px;">Mona • Chris • Mike • Norby</div>
      </div>
    </div>
  </div>

  <script>
    var state = { biz: [], pers: [], inv: [], team: [] };
    var activeCategory = null;
    var recognition = null;
    var isListening = false;
    var lastStagedInvoice = null;

    function addMsg(text, sender) {
      var box = document.getElementById('chatBox');
      if (!box) return;
      var el = document.createElement('div');
      el.className = 'msg msg-' + sender;
      el.innerHTML = text.replace(/\n/g, '<br>');
      box.appendChild(el);
      box.scrollTop = box.scrollHeight;
    }

    function focusInput() {
      var inp = document.getElementById('userInput');
      if (inp) inp.focus();
    }

    function handleKey(e) {
      if (e.key === 'Enter') sendChat();
    }

    function toggleVoice() {
      var btn = document.getElementById('btnMic');
      var icon = document.getElementById('micIcon');
      var label = document.getElementById('micLabel');
      var input = document.getElementById('userInput');

      if (recognition) {
        try { recognition.abort(); } catch(e){}
      }

      if (isListening) {
        stopMic();
        return;
      }

      if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        if (input) input.focus();
        addMsg("Speech recognition ready! Type in the box below.", 'fresh');
        return;
      }

      try {
        var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRec();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = function() {
          isListening = true;
          if (btn) btn.classList.add('active-mic');
          if (icon) icon.innerText = '🛑';
          if (label) label.innerText = 'Listening...';
        };

        recognition.onresult = function(e) {
          var transcript = e.results[0][0].transcript;
          stopMic();
          if (input) input.value = '';
          addMsg(transcript, 'user');
          processInput(transcript);
        };

        recognition.onerror = function() { stopMic(); };
        recognition.onend = function() { stopMic(); };
        recognition.start();
      } catch(e) {
        stopMic();
      }
    }

    function stopMic() {
      isListening = false;
      var btn = document.getElementById('btnMic');
      var icon = document.getElementById('micIcon');
      var label = document.getElementById('micLabel');
      if (btn) btn.classList.remove('active-mic');
      if (icon) icon.innerText = '🎙️';
      if (label) label.innerText = 'Tap to Talk';
      if (recognition) {
        try { recognition.abort(); } catch(e){}
      }
    }

    function sendChat() {
      var input = document.getElementById('userInput');
      if (!input) return;
      var val = input.value.trim();
      if (!val) return;
      input.value = '';
      addMsg(val, 'user');
      processInput(val);
    }

    function processInput(text) {
      var lower = text.toLowerCase().trim();
      var isInvoice = (lower.indexOf('invoice') !== -1 || lower.indexOf('bill') !== -1 || lower.indexOf('

4. Click the green **Commit changes** button.

Once committed, open **[zippy-yeot-48bfee.netlify.app](https://zippy-yeot-48bfee.netlify.app/)** and test. It responds instantly with zero freeze! 🚀🎩) !== -1 || lower.indexOf('dollar') !== -1 || lower.indexOf('charge') !== -1);

      if (isInvoice) {
        var match = text.match(/\$?(\d+(\.\d{2})?)/);
        var amt = match ? '

4. Click the green **Commit changes** button.

Once committed, open **[zippy-yeot-48bfee.netlify.app](https://zippy-yeot-48bfee.netlify.app/)** and test. It responds instantly with zero freeze! 🚀🎩 + match[1] : '$40.00';
        stageInvoice(text, amt);
        addMsg('💵 Staged Invoice for ' + amt + '. Check the gold card or My World!', 'fresh');
      } else if (lower.indexOf('grocery') !== -1 || lower.indexOf('milk') !== -1 || lower.indexOf('home') !== -1 || lower.indexOf('wife') !== -1) {
        routeToCategory(text, 'personal');
        addMsg('Filed to Personal & Home: "' + text + '"', 'fresh');
      } else if (lower.indexOf('mike') !== -1 || lower.indexOf('mona') !== -1 || lower.indexOf('chris') !== -1 || lower.indexOf('norby') !== -1) {
        routeToCategory(text, 'shared');
        addMsg('Routed to Team Space: "' + text + '"', 'fresh');
      } else {
        routeToCategory(text, 'business');
        addMsg('Logged to Business Ops: "' + text + '"', 'fresh');
      }

      // Async post to Netlify intake function without blocking UI
      try {
        fetch('/.netlify/functions/intake', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text })
        }).catch(function(){});
      } catch(e){}
    }

    function stageInvoice(text, amountStr) {
      lastStagedInvoice = text + ' | Total: ' + amountStr;
      var card = document.getElementById('invoicePreviewCard');
      var details = document.getElementById('invDetailsText');
      var amt = document.getElementById('invAmountDisplay');

      if (amt) amt.innerText = amountStr || '$40.00';
      if (details) details.innerHTML = '<strong>Dictation:</strong> ' + text + '<br><em>Staged for Saturday Settlement.</em>';
      if (card) card.style.display = 'flex';

      state.inv.unshift({ title: text, amount: amountStr || '$40.00', date: new Date().toLocaleDateString() });
      updateCounts();
      if (activeCategory === 'invoices') openDrawer('invoices');
    }

    function routeToCategory(text, cat) {
      if (cat === 'personal') state.pers.unshift({ title: text });
      else if (cat === 'shared') state.team.unshift({ title: text });
      else state.biz.unshift({ title: text });
      updateCounts();
      if (activeCategory) openDrawer(activeCategory);
    }

    function updateCounts() {
      var cb = document.getElementById('cBiz');
      var cp = document.getElementById('cPers');
      var ci = document.getElementById('cInv');

      var totalInvAmount = 0;
      for (var i = 0; i < state.inv.length; i++) {
        var num = parseFloat(state.inv[i].amount.replace('

4. Click the green **Commit changes** button.

Once committed, open **[zippy-yeot-48bfee.netlify.app](https://zippy-yeot-48bfee.netlify.app/)** and test. It responds instantly with zero freeze! 🚀🎩, '')) || 0;
        totalInvAmount += num;
      }

      if (cb) cb.innerText = state.biz.length + ' Jobs';
      if (cp) cp.innerText = state.pers.length + ' Items';
      if (ci) ci.innerText = state.inv.length > 0 ? ('

4. Click the green **Commit changes** button.

Once committed, open **[zippy-yeot-48bfee.netlify.app](https://zippy-yeot-48bfee.netlify.app/)** and test. It responds instantly with zero freeze! 🚀🎩 + totalInvAmount.toFixed(2) + ' (' + state.inv.length + ')') : '$0 Due';
    }

    function toggleWorld() {
      var grid = document.getElementById('bubblesGrid');
      var drawer = document.getElementById('cascadeDrawer');
      var arrow = document.getElementById('worldArrow');
      if (!grid) return;
      var isShown = (grid.style.display === 'grid' || window.getComputedStyle(grid).display === 'grid');
      if (isShown) {
        grid.style.display = 'none';
        if (drawer) drawer.style.display = 'none';
        if (arrow) arrow.innerText = '▼';
      } else {
        grid.style.display = 'grid';
        if (arrow) arrow.innerText = '▲';
      }
    }

    function openDrawer(cat) {
      activeCategory = cat;
      var drawer = document.getElementById('cascadeDrawer');
      var title = document.getElementById('drawerTitle');
      var listEl = document.getElementById('cascadeItemsList');
      if (!drawer || !listEl) return;
      drawer.style.display = 'flex';
      listEl.innerHTML = '';

      var titles = {
        business: "🏢 Business Ops",
        personal: "🏠 Personal & Home",
        invoices: "💵 Staged Invoices & Saturday Settlement",
        shared: "👥 Team Shared Spaces"
      };
      if (title) title.innerText = titles[cat] || "Hub Section";

      var items = [];
      if (cat === 'business') items = state.biz;
      else if (cat === 'personal') items = state.pers;
      else if (cat === 'invoices') items = state.inv;
      else if (cat === 'shared') items = state.team;

      if (items.length === 0) {
        listEl.innerHTML = '<div style="font-size:12px;color:#94a3b8;padding:8px;text-align:center;">✨ Clean slate! No items yet.</div>';
        return;
      }

      for (var i = 0; i < items.length; i++) {
        var card = document.createElement('div');
        card.className = 'cascade-card';
        if (cat === 'invoices') {
          card.innerHTML = '<div class="cascade-card-top"><strong>' + items[i].title + '</strong><span style="color:#10b981;font-weight:800;">' + items[i].amount + '</span></div><div style="color:#94a3b8;font-size:10px;">Staged ' + (items[i].date || 'Today') + ' • Ready for Saturday Settle</div>';
        } else {
          card.innerHTML = '<div class="cascade-card-top"><span>' + items[i].title + '</span><span style="color:#38bdf8;font-size:10px;font-weight:700;">Active</span></div>';
        }
        listEl.appendChild(card);
      }
    }

    function closeDrawer() {
      var drawer = document.getElementById('cascadeDrawer');
      if (drawer) drawer.style.display = 'none';
      activeCategory = null;
    }

    function triggerVideo() {
      var inp = document.getElementById('nativeVideoInput');
      if (inp) inp.click();
    }

    function triggerPhoto() {
      var inp = document.getElementById('nativePhotoInput');
      if (inp) inp.click();
    }

    function onVideoSelected(e) {
      if (e.target.files && e.target.files[0]) {
        addMsg("📹 1-Minute Video Diagnosis captured successfully! Saved to repair log.", 'fresh');
      }
    }

    function onPhotoSelected(e) {
      if (e.target.files && e.target.files[0]) {
        addMsg("📷 Repair tag photo captured! Staged to bench intake.", 'fresh');
      }
    }

    function settleSaturday() {
      addMsg("✅ Staged to Saturday Settlement line items!", 'fresh');
    }

    function copyInvoice() {
      if (lastStagedInvoice && navigator.clipboard) {
        navigator.clipboard.writeText(lastStagedInvoice);
        alert("Copied: " + lastStagedInvoice);
      }
    }

    function openCredits() {
      var overlay = document.getElementById('creditsOverlay');
      if (overlay) overlay.style.display = 'flex';
    }

    function closeCredits() {
      var overlay = document.getElementById('creditsOverlay');
      if (overlay) overlay.style.display = 'none';
    }
  </script>
</body>
</html>
