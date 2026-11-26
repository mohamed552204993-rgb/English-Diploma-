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

  const oldSpeak = window.speak;
  let voiceCache = null;

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
    window.speak = function (text, slow, quiet) {
      const phrase = String(text || '');
      const accent = currentAccent();
      let hasEmbeddedUSClip = false;
      try { hasEmbeddedUSClip = accent !== 'UK' && !!AN[norm(phrase)]; } catch (_) {}
      // Keep the existing 263 embedded recordings wherever they already cover the phrase.
      if (hasEmbeddedUSClip) return oldSpeak(text, slow, quiet);

      const locale = accent === 'UK' ? 'en-GB' : 'en-US';
      const isSlow = slow === true || (typeof S !== 'undefined' && !!S.slow);
      (async () => {
        try {
          await TextToSpeech.stop();
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
      status.textContent = 'سيطلب التطبيق إذن الميكروفون عند أول استخدام. يحتاج التعرف على الكلام إلى خدمة صوت متاحة على الجهاز.';
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
        const clean = value => {
          try { return norm(value).split(' ').filter(Boolean); }
          catch (_) { return String(value).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\\s+/).filter(Boolean); }
        };
        const target = clean(ex.s);
        const words = clean(heard);
        const missing = target.filter(word => !words.includes(word));
        const ratio = target.length ? (target.length - missing.length) / target.length : 0;
        const passed = ratio >= 0.8;
        mic.hidden = true;
        if (callback) callback({ ok: passed, heard });
        if (typeof fb === 'function') {
          fb(host, passed, ex.s, 'سمعتُ: <span class="en" dir="ltr">' +
            String(heard).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])) +
            '</span>' + (missing.length ? '<br>كلمات لم أتعرف عليها: <span class="en" dir="ltr">' + missing.join(', ') + '</span>' : ''));
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
          const availability = await SpeechRecognition.available();
          if (!availability || !availability.available) {
            status.textContent = 'خدمة التعرف على الكلام غير متاحة على هذا الجهاز. تحقق من تثبيت/تفعيل خدمة Google Speech Services أو خدمة التعرف على الكلام.';
            mic.disabled = false;
            return;
          }
          status.textContent = '🎙️ تحدّث الآن...';
          const result = await SpeechRecognition.start({
            language: currentAccent() === 'UK' ? 'en-GB' : 'en-US',
            maxResults: 3,
            partialResults: false,
            popup: true,
            prompt: 'Speak the English sentence'
          });
          const matches = Array.isArray(result.matches) ? result.matches.filter(Boolean) : [];
          if (matches.length) {
            const score = value => {
              const heardWords = cleanWords(value);
              return cleanWords(ex.s).filter(word => heardWords.includes(word)).length;
            };
            matches.sort((a, b) => score(b) - score(a));
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
        catch (_) { return String(value).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\\s+/).filter(Boolean); }
      }
      mic.addEventListener('click', startNativeRecognition);

      if (previous) {
        mic.hidden = true;
        finish(previous.heard || '');
      }
    };
  }
}
