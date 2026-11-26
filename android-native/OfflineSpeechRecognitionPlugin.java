package com.englishdiploma.app;

import android.Manifest;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.os.SystemClock;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import com.k2fsa.sherpa.onnx.OnlineModelConfig;
import com.k2fsa.sherpa.onnx.OnlineRecognizer;
import com.k2fsa.sherpa.onnx.OnlineRecognizerConfig;
import com.k2fsa.sherpa.onnx.OnlineStream;
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "OfflineSpeechRecognition",
    permissions = {
        @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO })
    }
)
public class OfflineSpeechRecognitionPlugin extends Plugin {
    private static final int SAMPLE_RATE = 16000;
    private static final String MODEL_DIR = "sherpa-onnx-en";

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void recognize(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "microphonePermissionResult");
            return;
        }
        recognizeOnDevice(call);
    }

    @PermissionCallback
    private void microphonePermissionResult(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            recognizeOnDevice(call);
        } else {
            call.reject("لم يتم السماح باستخدام الميكروفون");
        }
    }

    private void recognizeOnDevice(PluginCall call) {
        executor.execute(() -> {
            AudioRecord recorder = null;
            OnlineRecognizer recognizer = null;
            OnlineStream stream = null;
            try {
                OnlineTransducerModelConfig transducer = new OnlineTransducerModelConfig();
                transducer.setEncoder(MODEL_DIR + "/encoder-epoch-99-avg-1.int8.onnx");
                transducer.setDecoder(MODEL_DIR + "/decoder-epoch-99-avg-1.onnx");
                transducer.setJoiner(MODEL_DIR + "/joiner-epoch-99-avg-1.int8.onnx");

                OnlineModelConfig model = new OnlineModelConfig();
                model.setTransducer(transducer);
                model.setTokens(MODEL_DIR + "/tokens.txt");
                model.setModelType("zipformer");
                model.setDebug(false);

                OnlineRecognizerConfig config = new OnlineRecognizerConfig();
                config.setModelConfig(model);
                recognizer = new OnlineRecognizer(getContext().getAssets(), config);
                stream = recognizer.createStream("");

                int minBytes = AudioRecord.getMinBufferSize(
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT
                );
                if (minBytes <= 0) {
                    throw new IllegalStateException("تعذر تهيئة الميكروفون على هذا الجهاز");
                }

                recorder = new AudioRecord(
                    MediaRecorder.AudioSource.MIC,
                    SAMPLE_RATE,
                    AudioFormat.CHANNEL_IN_MONO,
                    AudioFormat.ENCODING_PCM_16BIT,
                    Math.max(minBytes * 2, SAMPLE_RATE)
                );
                if (recorder.getState() != AudioRecord.STATE_INITIALIZED) {
                    throw new IllegalStateException("تعذر فتح الميكروفون");
                }

                short[] pcm = new short[1600];
                boolean speechDetected = false;
                long startedAt = SystemClock.elapsedRealtime();
                long lastSpeechAt = startedAt;
                String recognized = "";

                recorder.startRecording();
                while (SystemClock.elapsedRealtime() - startedAt < 15000) {
                    int count = recorder.read(pcm, 0, pcm.length);
                    if (count <= 0) continue;

                    float[] samples = new float[count];
                    double energy = 0;
                    for (int i = 0; i < count; i++) {
                        samples[i] = pcm[i] / 32768.0f;
                        energy += samples[i] * samples[i];
                    }
                    double rms = Math.sqrt(energy / count);
                    if (rms > 0.012) {
                        speechDetected = true;
                        lastSpeechAt = SystemClock.elapsedRealtime();
                    }

                    stream.acceptWaveform(samples, SAMPLE_RATE);
                    while (recognizer.isReady(stream)) {
                        recognizer.decode(stream);
                    }

                    recognized = recognizer.getResult(stream).getText();
                    long now = SystemClock.elapsedRealtime();
                    if (speechDetected && now - lastSpeechAt > 1100 && now - startedAt > 900) {
                        break;
                    }
                }

                // Flush a short silence tail so the final spoken word can be decoded.
                float[] tail = new float[8000];
                stream.acceptWaveform(tail, SAMPLE_RATE);
                while (recognizer.isReady(stream)) {
                    recognizer.decode(stream);
                }
                recognized = recognizer.getResult(stream).getText();

                if (recognized == null || recognized.trim().isEmpty()) {
                    call.reject("لم أتمكن من تمييز الكلام. حاول التحدث بوضوح وبالقرب من الميكروفون.");
                    return;
                }

                JSObject result = new JSObject();
                result.put("text", recognized.trim());
                result.put("offline", true);
                call.resolve(result);
            } catch (Exception error) {
                call.reject("تعذر تشغيل التعرف الصوتي المحلي: " + error.getMessage(), error);
            } finally {
                if (recorder != null) {
                    try { if (recorder.getRecordingState() == AudioRecord.RECORDSTATE_RECORDING) recorder.stop(); } catch (Exception ignored) {}
                    try { recorder.release(); } catch (Exception ignored) {}
                }
                if (stream != null) {
                    try { stream.release(); } catch (Exception ignored) {}
                }
            }
        });
    }
}
