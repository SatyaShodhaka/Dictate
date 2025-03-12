(function() {

    // Check if the content script is loaded
    console.log('Content script loaded');

    let isRecording = false;
    let mediaRecorder;
    let audioChunks = [];
    let savedRange = null;
    let buttonPressed = false;

    // Global variable to keep track of the active text area or input
    let currentFocusedElement = null;
    
    // Inject mic button into Gmail compose area
    function injectMicButton() {
        const composeWindows = document.querySelectorAll('.GP');
    
        composeWindows.forEach(window => {
            if (window.querySelector('.voice-dictation-button')) return;
    
            // Use a div instead of a button to avoid focus issues
            const micButton = document.createElement('div');
            micButton.title = 'Start Voice Dictation';
            micButton.className = 'voice-dictation-button';
            micButton.setAttribute('tabindex', '-1'); // Ensure it's not focusable
            micButton.style.pointerEvents = 'auto'; // Ensure it's clickable

            micButton.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1C10.9 1 10 1.9 10 3V11C10 12.1 10.9 13 12 13C13.1 13 14 12.1 14 11V3C14 1.9 13.1 1 12 1Z" />
                <path d="M19 11C19 14.3 16.3 17 13 17H11C7.7 17 5 14.3 5 11" />
                <line x1="12" y1="17" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
                </svg>`;
    
            window.style.position = 'relative';
            window.appendChild(micButton);
    
            micButton.addEventListener('mousedown', (event) => {
                event.preventDefault();  // Prevents focus from changing
                buttonPressed = true;
                console.log("Mic button mousedown");    
                startRecording(micButton);
            });
    
            micButton.addEventListener('mouseup', (event) => {
                event.preventDefault();
                console.log("Mic button mouseup");
                stopRecording(micButton);
            });
        });
    }
    
    // Listen for focus events on editable fields
    document.addEventListener('focusin', function(event) {
        const el = event.target;

        if (buttonPressed) {
            buttonPressed = false;
            return;
        }
    
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
    async function startRecording(micButton) {
        // Start recording
        console.log('Recording started');
        try {
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
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' }); //wav is not supported in chrome
                
                // Send the audio to the API
                sendAudioToAPI(audioBlob);
            };

            mediaRecorder.start();
            isRecording = true;

            // Change the button color by adding listening class
            micButton.classList.add('listening');

        }
        catch (error) {
            console.error('Error starting audio recording:', error);
            alert('Failed to start audio recording. ' + error.message);
        }
    }

    // Function to handle the stop of the recording
    function stopRecording(micButton) {
        console.log('Stopping audio recording....');
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        isRecording = false;

        // Change the button color by removing the listening class
        micButton.classList.remove('listening');
    }

    // Function to send the audio to the API
    async function sendAudioToAPI(audioBlob) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.webm');
      
        try {
            const response = await fetch('http://localhost:8000/transcribe', {
                method: 'POST',
                body: formData
            });
        
            // Check for HTTP errors
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
        
            const data = await response.json();
        
            // Validate expected field exists in response
            if (!data.transcript) {
                console.warn('Invalid response format: "transcript" missing');
            }
            else {
                // Insert the text into the active element
                insertText(data.transcript);
            }
        } catch (error) {
            console.error('Error during audio transcription:', error);
        }
    }
      
    function insertText(text) {
        const el = currentFocusedElement;

        console.log("Current focused element while inserting: ", el);

        // Switch the focus to last element
        el.focus();

        if (!el) {
            console.warn('No focused element to insert text');
            return;
        }

        if (el.isContentEditable) {
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