#!/bin/bash

# Script to convert raw audio files to WAV format
# Usage: ./convert_audio.sh [raw_file]

if [ -z "$1" ]; then
  echo "Usage: ./convert_audio.sh <raw_audio_file>"
  echo "Example: ./convert_audio.sh debug_audio/audio_2025-11-19T12-30-45-123Z.raw"
  exit 1
fi

INPUT_FILE="$1"
OUTPUT_FILE="${INPUT_FILE%.raw}.wav"

echo "Converting $INPUT_FILE to $OUTPUT_FILE..."
echo "Audio format: 16-bit PCM, 16000 Hz, Mono"

# Convert using ffmpeg
# -f s16le: signed 16-bit little-endian PCM
# -ar 16000: sample rate 16000 Hz
# -ac 1: mono (1 channel)
ffmpeg -f s16le -ar 16000 -ac 1 -i "$INPUT_FILE" "$OUTPUT_FILE" -y

if [ $? -eq 0 ]; then
  echo "✅ Conversion successful!"
  echo "Output file: $OUTPUT_FILE"
  echo ""
  echo "To play the file:"
  echo "  afplay $OUTPUT_FILE"
else
  echo "❌ Conversion failed. Make sure ffmpeg is installed:"
  echo "  brew install ffmpeg"
fi

