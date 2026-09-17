<script>
    let isListening = false;
    let recognition = null;
    let finalSpeechText = "";

    // STEP 1: Capture User Spoken Text
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = false; // Stops automatically when user finishes speaking
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalSpeechText += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            const currentText = finalSpeechText || interimTranscript;
            document.getElementById('userSpeech').innerText = currentText;
        };

        recognition.onend = () => {
            if (isListening) {
                stopMicUI();
                sendToFresh();
            }
        };
    }

    function toggleVoice() {
        if (!recognition) return alert("Speech recognition not supported on this browser.");
        if (!isListening) {
            finalSpeechText = "";
            document.getElementById('userSpeech').innerText = "Listening...";
            recognition.start();
            isListening = true;
            document.getElementById('micBtn').classList.add('animate-pulse', 'bg-red-600');
            document.getElementById('voiceStatus').innerText = "Fresh is listening... Speak your command!";
            document.getElementById('transcriptBox').classList.remove('hidden');
            document.getElementById('sendVoiceBtn').classList.remove('hidden');
        } else {
            stopMicUI();
            sendToFresh();
        }
    }

    function stopMicUI() {
        if (recognition && isListening) {
            recognition.stop();
            isListening = false;
        }
        document.getElementById('micBtn').classList.remove('animate-pulse', 'bg-red-600');
        document.getElementById('voiceStatus').innerText = "Tap to speak directly to Fresh";
    }

    // STEP 4: Speak Response Text Out Loud
    function speakText(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Clear queued speech
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
        }
    }

    // STEPS 2, 3, & 5: Post to Netlify Function -> Render -> Speak Out Loud
    async function sendToFresh() {
        stopMicUI();
        const userPrompt = finalSpeechText || document.getElementById('userSpeech').innerText;
        if (!userPrompt || userPrompt === "Listening...") return;

        // UI Loading Indicator
        document.getElementById('freshResponse').classList.remove('hidden');
        document.getElementById('freshResponseText').innerText = "Fresh is thinking...";

        try {
            // STEP 2: POST to Netlify Gemini Function
            const res = await fetch('/.netlify/functions/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userPrompt })
            });

            const data = await res.json();
            const freshReply = data.reply || "Fresh is online and ready for the next play!";

            // STEP 5: Display response text on screen
            document.getElementById('freshResponseText').innerText = freshReply;

            // STEP 4: Speak response out loud
            speakText(freshReply);

        } catch (err) {
            console.error(err);
            const errorMsg = "Glitch in the connection. Check your Netlify GEMINI_API_KEY settings!";
            document.getElementById('freshResponseText').innerText = errorMsg;
            speakText(errorMsg);
        }
    }

    function toggleCabinet(id) { document.getElementById(id).classList.toggle('hidden'); }
    function toggleModal(id) { document.getElementById(id).classList.toggle('hidden'); }
</script>
