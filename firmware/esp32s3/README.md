# ESP32-S3 build wrapper: synthetic demonstration only

This ESP-IDF v5.x wrapper reuses the integer sparse Goertzel / centroid / verifier C11 source from the host tests. It synthesizes one multitone STOP input directly on the device. The test generator uses floating-point sine only to make example input; inference uses integer math. **No microphone, TTS, real Vietnamese speech, GPIO or motor/actuator output is implemented.**

```bash
cd firmware/esp32s3
idf.py set-target esp32s3
idf.py build
idf.py -p YOUR_SERIAL_PORT flash monitor
```

This wrapper has not been cross-compiled or flashed on physical ESP32-S3 by this prototype. Thus no verified RAM/flash use, latency, power consumption or board-level result can be claimed. To study voice command recognition, add a separately verified I2S PCM driver, VAD, real speaker-disjoint recorded data, watchdog, hard motor limits, physical stop mechanism, benchmark timer and safety testing before enabling motion.
