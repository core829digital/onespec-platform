import sys, glob, numpy as np, soundfile as sf, sherpa_onnx
m = "/tmp/asr/sherpa-onnx-whisper-small/"
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=m+"small-encoder.int8.onnx", decoder=m+"small-decoder.int8.onnx",
    tokens=m+"small-tokens.txt", language="it", task="transcribe", num_threads=4)
for f in sorted(glob.glob(sys.argv[1] + "/l*.wav")):
    x, sr = sf.read(f, dtype="float32")
    s = rec.create_stream(); s.accept_waveform(sr, x); rec.decode_stream(s)
    print(f.split("/")[-1], "|", s.result.text.strip())
