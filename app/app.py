import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper   # Optional, if you want to use OpenAI's Whisper
from werkzeug.utils import secure_filename

# Setup Flask app
app = Flask(__name__)
CORS(app)  # Allow cross-origin requests (important for local dev)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load Whisper model (or use another transcription service)
model = whisper.load_model('base')  # options: tiny, base, small, medium, large

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file found'}), 400

    audio_file = request.files['audio']
    filename = secure_filename(audio_file.filename)
    file_path = os.path.join(UPLOAD_FOLDER, filename)

    audio_file.save(file_path)

    try:
        # Whisper transcription
        result = model.transcribe(file_path)
        transcription = result['text']
        print(f"Transcription result: {transcription}")

        # Cleanup after transcription
        os.remove(file_path)

        return jsonify({'transcript': transcription})

    except Exception as e:
        print(f"Error during transcription: {str(e)}")
        return jsonify({'error': 'Transcription failed', 'details': str(e)}), 500

# Health check endpoint
@app.route('/')
def index():
    return 'Transcription server is running!'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
