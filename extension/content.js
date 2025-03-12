(function() {

    // Check if the content script is loaded

    console.log('Content script loaded');

    let isRecording = false;
    let mediaRecorder;
    let audioChunks = [];

    // Global variable to keep track of the active text area or input
    let currentFocusedElement = null;
    
    // Inject mic button into Gmail compose area
    function injectMicButton() {
        const composeWindows = document.querySelectorAll('.GP');

        composeWindows.forEach(window => {
            if (window.querySelector('.voice-dictation-button')) return;

            const micButton = document.createElement('div');
            micButton.title = 'Start Voice Dictation';
            micButton.className = 'voice-dictation-button';

            micButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1C10.9 1 10 1.9 10 3V11C10 12.1 10.9 13 12 13C13.1 13 14 12.1 14 11V3C14 1.9 13.1 1 12 1Z" />
                <path d="M19 11C19 14.3 16.3 17 13 17H11C7.7 17 5 14.3 5 11" />
                <line x1="12" y1="17" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
                </svg>`;


            window.style.position = 'relative';
            window.appendChild(micButton);

            // Mouse events
            micButton.addEventListener('mousedown', () => {
                startRecording(micButton);
            });
            micButton.addEventListener('mouseup', () => {
                stopRecording(micButton);
            });
            micButton.addEventListener('mouseleave', () => {
                if (isListening) stopRecording(micButton);
            });
        });
    }

    // Listen for focus events on editable fields
    document.addEventListener('focusin', function(event) {
        const el = event.target;
    
        if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
        currentFocusedElement = el;
        }
    });

    // Function to inject the mic button
    const observer = new MutationObserver(() => {
        injectMicButton();
    });

    // Inject the mic button
    observer.observe(document.body, {childList: true, subtree: true});

    // Function to handle the start of the recording
    async function startRecording() {

        // Start recording
        console.log('Recording started');
    
        // Get the audio stream
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        

        mediaRecorder.onstart = () => {
            audioChunks = [];
        };

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            
            // Send the audio to the API
            sendAudioToAPI(audioBlob);

        };

        mediaRecorder.start();
        isRecording = true;

    }


    // Function to send the audio to the API
    async function sendAudioToAPI(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob);
      
        try {
          const response = await fetch('http://localhost:5000/transcribe', {
            method: 'POST',
            body: formData
          });
      
          // Check for HTTP errors
          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
      
          const data = await response.json();
      
          // Validate expected field exists in response
          if (!data.transcribedText || typeof data.transcribedText !== 'string') {
            throw new Error('Invalid response format: "transcribedText" missing');
          }
      
          console.log('Transcription received:', data.transcribedText);
          insertText(data.transcribedText);
      
        } catch (error) {
          console.error('Error during audio transcription:', error);
      
          // Optionally show feedback to the user
          alert(`Failed to transcribe audio. ${error.message}`);
        }
    }
      
    
    function stopRecording() {
      mediaRecorder.stop();
      isRecording = false;
      
    }
    
    function insertText(text) {
        const el = lastFocusedElement;
        if (!el) {
            console.warn('No focused element to insert text');
            return;
        }

        if (el.isContentEditable) {
            el.focus();
            const selection = window.getSelection();
            if (!selection || !selection.rangeCount) {
                console.warn('No valid selection range found');
                return;
            }

            const range = selection.getRangeAt(0);
            range.deleteContents();
            const textNode = document.createTextNode(text + " ");
            range.insertNode(textNode);
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);

        } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            const cursorPos = el.selectionStart;
            const value = el.value;
            el.value = value.slice(0, cursorPos) + text + value.slice(cursorPos);
            el.selectionStart = el.selectionEnd = cursorPos + text.length;
            el.focus();
        } else {
            console.warn('Element is not editable');
        }
    }
    

})();