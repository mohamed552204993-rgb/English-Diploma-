import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

/*
 * Native speech adapters for the Capacitor APK.
 * The website/PWA keeps its existing browser implementation.
 */
if (Capacitor.isNativePlatform()) {
  window.NativeSpeechRecognition = SpeechRecognition;
  window.NativeTextToSpeech = TextToSpeech;

  // Build a public lookup from the existing embedded recordings in index.html.
  const embeddedAudio = {};
  try {
    for (const key in AUDIO) embeddedAudio[normalizeText(key)] = AUDIO[key];
  } catch (_) {}

  // Replace the browser recognizer with a Web Speech-compatible adapter that
  // exclusively uses the platform's on-device model. No popup or cloud fallback.
  class LocalSpeechRecognitionAdapter {
    constructor() {
      this.lang = 'en-US';
      this.maxAlternatives = 3;
      this.interimResults = false;
      this.continuous = false;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
    }
    async start() {
      try {
        const permission = await SpeechRecognition.requestPermissions();
        if (!permission || permission.speechRecognition !== 'granted') throw new Error('permission denied');
        const local = await SpeechRecognition.isOnDeviceRecognitionAvailable({ language: this.lang });
        if (!local || !local.available) throw new Error('ON_DEVICE_RECOGNITION_UNAVAILABLE');
        const result = await SpeechRecognition.start({
          language: this.lang,
          maxResults: this.maxAlternatives || 3,
          partialResults: false,
          popup: false,
          useOnDeviceRecognition: true
        });
        const matches = Array.isArray(result.matches) ? result.matches.filter(Boolean) : [];
        if (matches.length && typeof this.onresult === 'function') {
          const alternatives = matches.map(transcript => ({ transcript }));
          alternatives.isFinal = true;
          this.onresult({ resultIndex: 0, results: [alternatives] });
        }
      } catch (error) {
        const message = String(error && (error.message || error.code) || error || '');
        const code = /ON_DEVICE_RECOGNITION_UNAVAILABLE/i.test(message)
          ? 'service-not-allowed'
          : /permission|denied/i.test(message) ? 'not-allowed' : 'service-not-allowed';
        if (typeof this.onerror === 'function') this.onerror({ error: code });
      } finally {
        if (typeof this.onend === 'function') this.onend();
      }
    }
    stop() { return SpeechRecognition.stop(); }
    abort() { return SpeechRecognition.forceStop ? SpeechRecognition.forceStop() : SpeechRecognition.stop(); }
  }
  window.NativeSpeechRecognitionAdapter = LocalSpeechRecognitionAdapter;
  window.SpeechRecognition = LocalSpeechRecognitionAdapter;
  window.webkitSpeechRecognition = undefined;

  const oldSpeak = window.speak;
  let voiceCache = null;

  function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[.,!?;:"]/g, '').replace(/\s+/g, ' ').trim();
  }
  function currentAccent() {
    try { return S.accent === 'UK' ? 'UK' : 'US'; } catch (_) { return 'US'; }
  }
  function normalizeLocale(value) {
    return String(value || '').replace(/_/g, '-').toLowerCase();
  }
  async function voiceIndexFor(locale) {
    try {
      if (!voiceCache) {
        const result = await TextToSpeech.getSupportedVoices();
        voiceCache = Array.isArray(result.voices) ? result.voices : [];
      }
      const exact = voiceCache.findIndex(v => normalizeLocale(v.lang) === locale.toLowerCase());
      return exact >= 0 ? exact : undefined;
    } catch (_) {
      return undefined;
    }
  }

  if (typeof oldSpeak === 'function') {
    let currentClipAudio = null;
    window.speak = function (text, slow, quiet) {
      const phrase = String(text || '');
      const accent = currentAccent();
      const locale = accent === 'UK' ? 'en-GB' : 'en-US';
      const isSlow = slow === true || (typeof S !== 'undefined' && !!S.slow);
      (async () => {
        try {
          await TextToSpeech.stop();
          if (currentClipAudio) {
            currentClipAudio.pause();
            currentClipAudio = null;
          }

          // Keep every existing embedded American recording; use native TTS if a clip cannot play.
          let clip = null;
          try { if (accent !== 'UK') clip = embeddedAudio[normalizeText(phrase)] || null; } catch (_) {}
          if (clip) {
            const audio = new Audio('data:audio/mpeg;base64,' + clip);
            audio.playbackRate = isSlow ? 0.7 : 1;
            audio.preservesPitch = true;
            currentClipAudio = audio;
            try {
              await audio.play();
              return;
            } catch (_) {
              if (currentClipAudio === audio) currentClipAudio = null;
            }
          }

          const voice = await voiceIndexFor(locale);
          const options = {
            text: phrase,
            lang: locale,
            rate: isSlow ? 0.72 : 0.92,
            pitch: 1,
            volume: 1
          };
          if (voice !== undefined) options.voice = voice;
          await TextToSpeech.speak(options);
        } catch (error) {
          if (typeof oldSpeak === 'function') oldSpeak(text, slow, quiet);
        }
      })();
    };
  }

  const oldRenderSpeak = window.renderSpeak;
  if (typeof oldRenderSpeak === 'function') {
    window.renderSpeak = function (ex, host, previous, callback) {
      host.innerHTML = '';
      const question = document.createElement('div');
      question.className = 'q';
      question.textContent = 'استمع للجملة ثم اضغط الميكروفون وكرّرها بصوتك';
      const questionRow = document.createElement('div');
      questionRow.className = 'qrow';
      const speaker = document.createElement('button');
      speaker.type = 'button';
      speaker.className = 'spk';
      speaker.setAttribute('aria-label', 'استمع إلى الجملة');
      speaker.textContent = '🔊';
      speaker.addEventListener('click', () => window.speak(ex.s));
      questionRow.append(question, speaker);
      const sentence = document.createElement('div');
      sentence.className = 'en';
      sentence.dir = 'ltr';
      sentence.style.cssText = 'font-size:20px;margin:8px 0';
      sentence.textContent = ex.s;
      const status = document.createElement('div');
      status.className = 'note';
      status.setAttribute('role', 'status');
      status.textContent = 'سيستخدم التطبيق التعرف المحلي على الجهاز فقط، دون فتح نافذة Google أو إرسال التسجيل إلى خدمة خارجية.';
      const row = document.createElement('div');
      row.className = 'row';
      const mic = document.createElement('button');
      mic.type = 'button';
      mic.className = 'btn';
      mic.textContent = '🎤 ابدأ التسجيل';
      const slow = document.createElement('button');
      slow.type = 'button';
      slow.className = 'btn ghost';
      slow.textContent = '🐢 ببطء';
      slow.addEventListener('click', () => window.speak(ex.s, true));
      row.append(mic, slow);
      host.append(questionRow, sentence, row, status);

      function finish(heard) {
        const clean = value => normalizeText(value).replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);
        const target = clean(ex.s);
        const words = clean(heard);
        if (!words.length) {
          status.textContent = 'لم ألتقط كلاماً واضحاً. اقترب من الميكروفون وحاول مرة أخرى.';
          mic.disabled = false;
          return;
        }
        const rows = Array.from({ length: target.length + 1 }, (_, i) => [i, ...Array(words.length).fill(0)]);
        for (let j = 1; j <= words.length; j++) rows[0][j] = j;
        for (let i = 1; i <= target.length; i++) {
          for (let j = 1; j <= words.length; j++) {
            rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1,
              rows[i - 1][j - 1] + (target[i - 1] === words[j - 1] ? 0 : 1));
          }
        }
        const ratio = 1 - rows[target.length][words.length] / Math.max(target.length, words.length, 1);
        if (ratio < 0.35) {
          status.textContent = 'التعرف المحلي لم يلتقط الجملة بشكل موثوق. لن نحسبها خطأ؛ حاول مرة أخرى.';
          mic.disabled = false;
          return;
        }
        const passed = ratio >= 0.8;
        mic.hidden = true;
        if (callback) callback({ ok: passed, heard, score: Math.round(ratio * 100) });
        if (typeof fb === 'function') {
          fb(host, passed, ex.s, 'سمعتُ: <span class="en" dir="ltr">' +
            String(heard).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])) +
            '</span><br>دقة تطابق الكلمات وترتيبها: ' + Math.round(ratio * 100) + '%');
        }
      }

      async function startNativeRecognition() {
        mic.disabled = true;
        status.textContent = 'جارٍ طلب إذن الميكروفون...';
        try {
          const permission = await SpeechRecognition.requestPermissions();
          if (!permission || permission.speechRecognition !== 'granted') {
            status.textContent = 'لم يتم منح إذن الميكروفون. افتح إعدادات التطبيق واسمح باستخدام الميكروفون ثم أعد المحاولة.';
            mic.disabled = false;
            return;
          }
          const language = currentAccent() === 'UK' ? 'en-GB' : 'en-US';
          const availability = await SpeechRecognition.isOnDeviceRecognitionAvailable({ language });
          if (!availability || !availability.available) {
            status.textContent = 'التعرف الصوتي المحلي غير متاح حالياً لهذا الجهاز أو اللغة. لن نستخدم Google أو خدمة خارجية. يمكنك تجربة التسجيل الذاتي أو تنزيل نموذج التعرف المحلي من إعدادات خدمات الكلام في الجهاز.';
            mic.disabled = false;
            return;
          }
          status.textContent = '🎙️ يستمع التطبيق محلياً...';
          const result = await SpeechRecognition.start({
            language,
            maxResults: 3,
            partialResults: false,
            popup: false,
            useOnDeviceRecognition: true,
            contextualStrings: cleanWords(ex.s)
          });
          const matches = Array.isArray(result.matches) ? result.matches.filter(Boolean) : [];
          if (matches.length) {
            const score = value => {
              const heardWords = cleanWords(value);
              return cleanWords(ex.s).filter(word => heardWords.includes(word)).length;
            };
            finish(matches[0]);
          } else {
            status.textContent = 'لم ألتقط كلاماً واضحاً. اقترب من الميكروفون وحاول مرة أخرى.';
            mic.disabled = false;
          }
        } catch (error) {
          const message = String(error && (error.message || error.code) || error || '');
          status.textContent = /denied|permission/i.test(message)
            ? 'إذن الميكروفون مرفوض. اسمح به من إعدادات التطبيق ثم أعد المحاولة.'
            : 'تعذر تشغيل التعرف على الكلام. تأكد من اتصال الإنترنت وتفعيل خدمة التعرف على الكلام في الجهاز، ثم أعد المحاولة.';
          mic.disabled = false;
        }
      }
      function cleanWords(value) {
        try { return norm(value).split(' ').filter(Boolean); }
        catch (_) { return String(value).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean); }
      }
      mic.addEventListener('click', startNativeRecognition);

      if (previous) {
        mic.hidden = true;
        finish(previous.heard || '');
      }
    };
  }
}
