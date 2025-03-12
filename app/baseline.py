import torch
from transformers import WhisperProcessor, WhisperForConditionalGeneration
from datasets import load_dataset, Audio, load_metric

# Load the pre-trained Whisper base.en model and processor.
model_name = "openai/whisper-base.en"
processor = WhisperProcessor.from_pretrained(model_name)
model = WhisperForConditionalGeneration.from_pretrained(model_name)
model.eval()
if torch.cuda.is_available():
    model.to("cuda")

# Load synthetic dataset using the built-in Audio feature.
dataset = load_dataset("json", data_files="synthetic_data/dataset.jsonl", split="train")
# Rename the 'audio_filepath' column to 'audio' for compatibility.
dataset = dataset.rename_column("audio_filepath", "audio")
# Cast the 'audio' column so that each file is loaded as an audio array with 16kHz.
dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))

# Initialize the WER metric.
wer_metric = load_metric("wer")
all_references = []
all_predictions = []

# Loop over each sample.
for sample in dataset:
    reference = sample["transcript"]
    # Get the audio array and sampling rate from the casted column.
    audio_array = sample["audio"]["array"]
    sr = sample["audio"]["sampling_rate"]
    
    # Process the audio using the Whisper processor.
    inputs = processor(audio_array, sampling_rate=sr, return_tensors="pt")
    if torch.cuda.is_available():
        inputs = {k: v.to("cuda") for k, v in inputs.items()}
    
    # Generate transcription.
    with torch.no_grad():
        predicted_ids = model.generate(**inputs)
    prediction = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
    
    # Collect references and predictions.
    all_references.append(reference)
    all_predictions.append(prediction)
    print(f"Reference: {reference}\nPrediction: {prediction}\n{'-'*40}")

# Compute and display the overall WER.
wer = wer_metric.compute(predictions=all_predictions, references=all_references)
print("Baseline WER on synthetic dataset:", wer)