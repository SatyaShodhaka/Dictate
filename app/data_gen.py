import os
import json
from datasets import load_dataset
from gtts import gTTS

# Create output directories.
os.makedirs("synthetic_data/audio", exist_ok=True)
os.makedirs("synthetic_data/transcripts", exist_ok=True)

# Load the CoNLL-2003 dataset.
dataset = load_dataset("conll2003", split="train")
ner_labels = dataset.features["ner_tags"].feature.names


# Function to extract samples across the ENTITY tags.
def extract_samples(entity_tags, num_samples=100):
    samples = []
    for example in dataset:
        tokens = example["tokens"]
        tags = example["ner_tags"]
        # Check if any token is tagged with a desired entity type.
        if any(ner_labels[tag] in entity_tags for tag in tags):
            sentence = " ".join(tokens)
            samples.append(sentence)
            if len(samples) >= num_samples:
                break
    return samples

# Define the entity types.
person_tags = {"B-PER", "I-PER"}
org_tags = {"B-ORG", "I-ORG"}
loc_tags = {"B-LOC", "I-LOC"}

# Extract samples (100 per category).
person_samples = extract_samples(person_tags, num_samples=100)
org_samples = extract_samples(org_tags, num_samples=100)
loc_samples = extract_samples(loc_tags, num_samples=100)

# Combine all samples with their category.
all_samples = (
    [("person", s) for s in person_samples] +
    [("org", s) for s in org_samples] +
    [("loc", s) for s in loc_samples]
)

data_entries = []
for idx, (category, sentence) in enumerate(all_samples):
    try:
        # Generate synthetic audio using gTTS.
        tts = gTTS(text=sentence, lang='en')
        audio_filename = f"synthetic_data/audio/sample_{idx}.mp3"
        tts.save(audio_filename)
        
        # Save transcript.
        transcript_filename = f"synthetic_data/transcripts/sample_{idx}.txt"
        with open(transcript_filename, "w") as f:
            f.write(sentence)
        
        # Record metadata.
        data_entries.append({
            "audio_filepath": audio_filename,
            "transcript": sentence,
            "category": category
        })
        print(f"Generated sample {idx} for {category}.")
    except Exception as e:
        print(f"Error processing sample {idx}: {e}")

# Save metadata as JSONL for dataset usage.
with open("synthetic_data/dataset.jsonl", "w") as f:
    for entry in data_entries:
        f.write(json.dumps(entry) + "\n")

print("Dataset generation complete: Total samples =", len(data_entries))
