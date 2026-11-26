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

  // Provide a Web Speech-compatible facade backed by the native Android TTS
  // plugin. Several existing lessons call speechSynthesis directly.
  // Some Android WebViews expose the property name but leave it unusable.
  // Install the native facade unless both the synthesizer and constructor work.
  if (!window.speechSynthesis || typeof window.speechSynthesis.speak !== 'function' ||
      typeof window.speechSynthesis.cancel !== 'function' ||
      typeof window.SpeechSynthesisUtterance !== 'function') {
    class NativeSpeechSynthesisUtterance {
      constructor(text) {
        this.text = String(text || '');
        this.lang = 'en-US';
        this.rate = 1;
        this.pitch = 1;
        this.volume = 1;
        this.voice = null;
        this.onstart = null;
        this.onend = null;
        this.onerror = null;
        this.onboundary = null;
      }
    }
    let nativeVoices = [];
    let activeUtterance = null;
    let speaking = false;
    TextToSpeech.getSupportedVoices().then(result => {
      nativeVoices = Array.isArray(result.voices) ? result.voices : [];
      try { window.dispatchEvent(new Event('voiceschanged')); } catch (_) {}
    }).catch(() => {});
    window.SpeechSynthesisUtterance = NativeSpeechSynthesisUtterance;
    window.speechSynthesis = {
      getVoices() { return nativeVoices; },
      get speaking() { return speaking; },
      get pending() { return false; },
      get paused() { return false; },
      cancel() {
        activeUtterance = null;
        speaking = false;
        TextToSpeech.stop().catch(() => {});
      },
      pause() { TextToSpeech.stop().catch(() => {}); speaking = false; },
      resume() {},
      speak(utterance) {
        if (!utterance) return;
        activeUtterance = utterance;
        speaking = true;
        const locale = String(utterance.lang || 'en-US').replace(/_/g, '-');
        const selected = nativeVoices.findIndex(v =>
          normalizeLocale(v.lang) === normalizeLocale(locale));
        const options = {
          text: String(utterance.text || ''),
          lang: locale,
          rate: Math.max(0.1, Math.min(2, Number(utterance.rate) || 1)),
          pitch: Math.max(0, Math.min(2, Number(utterance.pitch) || 1)),
          volume: Math.max(0, Math.min(1, Number(utterance.volume) || 1))
        };
        if (selected >= 0) options.voice = selected;
        Promise.resolve().then(() => {
          if (activeUtterance === utterance && typeof utterance.onstart === 'function') {
            utterance.onstart(new Event('start'));
          }
          return TextToSpeech.speak(options);
        }).then(() => {
          if (activeUtterance === utterance) {
            speaking = false;
            activeUtterance = null;
            if (typeof utterance.onend === 'function') utterance.onend(new Event('end'));
          }
        }).catch(error => {
          if (activeUtterance === utterance) {
            speaking = false;
            activeUtterance = null;
            if (typeof utterance.onerror === 'function') {
              utterance.onerror({ error: 'synthesis-failed', message: String(error || '') });
            }
          }
        });
      }
    };
  }

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
        const availability = await SpeechRecognition.available();
        if (!availability || !availability.available) throw new Error('SPEECH_RECOGNITION_UNAVAILABLE');
        const result = await SpeechRecognition.start({
          language: this.lang,
          maxResults: 1,
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
      status.textContent = 'سيعمل التسجيل داخل التطبيق دون فتح نافذة منفصلة. يعتمد التعرف على خدمة الكلام المتاحة في جهازك.';
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
      const skip = document.createElement('button');
      skip.type = 'button';
      skip.className = 'btn ghost';
      skip.textContent = '⏭ لا أستطيع التحدث الآن';
      skip.addEventListener('click', () => {
        mic.hidden = true;
        skip.hidden = true;
        status.textContent = 'تم تخطي التمرين. لن تُحتسب إجابة خاطئة.';
        if (callback) callback({ ok: true, heard: '', skipped: true, score: null, attempts });
      });
      row.append(mic, slow);
      host.append(questionRow, sentence, row, skip, status);

      let attempts = 0;
      const maxAttempts = 3;

      function finish(heard) {
        const clean = value => normalizeText(value).replace(/[^a-z0-9' ]/g, ' ').split(/\s+/).filter(Boolean);
        const target = clean(ex.s);
        const words = clean(heard);
        if (!words.length) {
          status.textContent = 'لم ألتقط كلاماً واضحاً. اقترب من الميكروفون وتحدث بوضوح؛ لم تُحتسب هذه محاولة.';
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
          status.textContent = 'لم أتمكن من تمييز الجملة بوضوح. اقترب من الميكروفون وجرّب مرة أخرى؛ لم تُحتسب هذه محاولة.';
          mic.disabled = false;
          return;
        }

        attempts += 1;
        const score = Math.round(ratio * 100);
        const passed = ratio >= 0.8;
        const safeHeard = String(heard).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

        if (!passed && attempts < maxAttempts) {
          status.textContent = 'قريب! سمعتُ: "' + heard + '". راجع الجملة وحاول مرة أخرى. المحاولة ' + attempts + ' من ' + maxAttempts + '.';
          mic.textContent = '🎤 المحاولة التالية';
          mic.disabled = false;
          return;
        }

        mic.hidden = true;
        if (callback) callback({ ok: passed, heard, score, attempts, exhausted: !passed && attempts >= maxAttempts });
        if (typeof fb === 'function') {
          const note = passed
            ? 'أحسنت! تطابق الكلمات وترتيبها: ' + score + '% — المحاولات: ' + attempts + ' من ' + maxAttempts
            : 'انتهت المحاولات الثلاث. سمعتُ: <span class="en" dir="ltr">' + safeHeard +
              '</span><br>الجملة المطلوبة: <span class="en" dir="ltr">' + ex.s +
              '</span><br>تطابق الكلمات وترتيبها: ' + score + '%. استمع للجملة ثم تابع التدريب.';
          fb(host, passed, ex.s, note);
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
          const availability = await SpeechRecognition.available();
          if (!availability || !availability.available) {
            status.textContent = 'خدمة التعرف على الكلام غير متاحة في الجهاز حالياً. تحقق من تثبيت أو تفعيل خدمة تحويل الكلام إلى نص ثم أعد المحاولة.';
            mic.disabled = false;
            return;
          }
          status.textContent = '🎙️ يستمع التطبيق... تحدث الآن.';
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
            finish(matches[0]);
          } else {
            status.textContent = 'لم ألتقط كلاماً واضحاً. اقترب من الميكروفون وحاول مرة أخرى.';
            mic.disabled = false;
          }
        } catch (error) {
          const message = String(error && (error.message || error.code) || error || '');
          status.textContent = /denied|permission/i.test(message)
            ? 'إذن الميكروفون مرفوض. اسمح به من إعدادات التطبيق ثم أعد المحاولة.'
            : 'تعذر تشغيل التعرف الصوتي المحلي. تحقق من دعم الجهاز للنطق دون إنترنت وتوفر نموذج اللغة الإنجليزية، ثم أعد المحاولة.';
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
        if (previous.skipped) {
          skip.hidden = true;
          status.textContent = 'تم تخطي التمرين سابقاً. لن تُحتسب إجابة خاطئة.';
        } else {
          skip.hidden = true;
          finish(previous.heard || '');
        }
      }
    };
  }
}
