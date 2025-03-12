import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper   # Optional, if you want to use OpenAI's Whisper
from werkzeug.utils import secure_filename
from transformers import WhisperForConditionalGeneration, WhisperProcessor
import torch
import torchaudio
from pydub import AudioSegment

def convert_webm_to_wav(input_path, output_path):
    audio = AudioSegment.from_file(input_path, format="webm")
    audio = audio.set_frame_rate(16000).set_channels(1)
    audio.export(output_path, format="wav")


# Setup Flask app
app = Flask(__name__)
CORS(app)  # Allow cross-origin requests (important for local dev)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Load Whisper model (or use another transcription service)
# model = whisper.load_model('base.en')  # options: tiny, base, small, medium, large

# Loading the custom Whisper model
# Load the fine-tuned model
MODEL_DIR = 'whisper-proper-noun-3.5WER'

processor = WhisperProcessor.from_pretrained(MODEL_DIR)
model = WhisperForConditionalGeneration.from_pretrained(MODEL_DIR)

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'audio' not in request.files:
        return jsonify({'error': 'No audio file found'}), 400

    audio_file = request.files['audio']
    filename = secure_filename(audio_file.filename)
    file_path = os.path.join(UPLOAD_FOLDER, filename)

    audio_file.save(file_path)

    try:
        # Handle webm input
        if filename.endswith('.webm'):
            wav_path = file_path.replace('.webm', '.wav')
            convert_webm_to_wav(file_path, wav_path)
            audio_path = wav_path
        else:
            audio_path = file_path

        print(f"Transcribing audio file: {audio_path}")

        # Load the correct file (wav after conversion)
        speech, sr = torchaudio.load(audio_path)

        # Resample if needed
        if sr != 16000:
            speech = torchaudio.transforms.Resample(orig_freq=sr, new_freq=16000)(speech)

        # Convert to model input format
        input_features = processor(speech.squeeze(0), sampling_rate=16000, return_tensors="pt")

        # Generate transcription
        with torch.no_grad():
            predicted_ids = model.generate(input_features.input_features)
        transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]

        print(f"Transcription result: {transcription}")

        # Cleanup
        os.remove(file_path)
        if filename.endswith('.webm'):
            os.remove(wav_path)

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
