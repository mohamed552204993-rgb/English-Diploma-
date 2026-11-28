/* Grammar-only interaction layer. Loaded by the Android build after the app scripts. */
(function () {
  'use strict';
  if (window.__grammarUX55) return;
  window.__grammarUX55 = true;

  const definitions = {
    am: {
      meaning: 'صيغة من الفعل be تُستخدم مع I.',
      why: 'لأن I تعني المتكلم المفرد، وصيغتها الصحيحة مع be هي am. لا نستخدم is أو are مع I.',
      uses: [
        ['الهوية أو المهنة', 'I am a student. = أنا طالب.'],
        ['الحالة أو الصفة', 'I am tired. = أنا متعب.'],
        ['العمر', 'I am 25. = عمري 25 سنة.'],
        ['المكان', 'I am at home. = أنا في المنزل.']
      ],
      form: 'I + am + تكملة الجملة. للنفي: I am not. للسؤال: Am I ...?'
    },
    is: {
      meaning: 'صيغة من الفعل be تُستخدم مع he / she / it ومع الاسم المفرد.',
      why: 'لأن الفاعل مفرد غائب، لذلك نختار is. لا نستخدم is مع I أو they.',
      uses: [
        ['الهوية أو المهنة', 'She is a nurse. = هي ممرضة.'],
        ['الحالة أو الصفة', 'He is happy. = هو سعيد.'],
        ['المكان', 'Ali is at home. = علي في المنزل.'],
        ['الوقت والطقس', 'It is five o’clock. = الساعة الخامسة.']
      ],
      form: 'He / She / It / اسم مفرد + is + تكملة. للنفي: is not / isn’t. للسؤال: Is she ...?'
    },
    are: {
      meaning: 'صيغة من الفعل be تُستخدم مع you / we / they ومع الأسماء الجمع.',
      why: 'نستخدم are مع you حتى لو كنت تخاطب شخصاً واحداً، ومع we وthey والجمع.',
      uses: [
        ['المخاطب', 'You are kind. = أنت لطيف.'],
        ['نحن', 'We are ready. = نحن مستعدون.'],
        ['هم أو هن', 'They are at home. = هم في المنزل.'],
        ['الأسماء الجمع', 'The books are new. = الكتب جديدة.']
      ],
      form: 'You / We / They / اسم جمع + are + تكملة. للنفي: are not / aren’t. للسؤال: Are they ...?'
    },
    be: {
      meaning: 'الفعل be هو الأصل الذي تأتي منه am وis وare، ومعناه يتغير حسب الجملة.',
      why: 'في المضارع البسيط نختار am أو is أو are حسب الفاعل، ولا نضع be مكانها مباشرة في جملة عادية.',
      uses: [
        ['بعد to', 'I want to be a doctor. = أريد أن أصبح طبيباً.'],
        ['بعد الأفعال المساعدة', 'You must be careful. = يجب أن تكون حذراً.'],
        ['الأمر', 'Be quiet, please. = كن هادئاً من فضلك.']
      ],
      form: 'be هو المصدر، أما am / is / are فهي صِيَغه في المضارع.'
    },
    not: {
      meaning: 'أداة نفي معناها «ليس / لا».',
      why: 'مع فعل be نضع not بعد am أو is أو are مباشرة، ولا نستخدم do معها.',
      uses: [
        ['النفي مع am', 'I am not tired. = أنا لست متعباً.'],
        ['النفي مع is', 'She is not busy. = هي ليست مشغولة.'],
        ['النفي مع are', 'They are not late. = هم ليسوا متأخرين.']
      ],
      form: 'am / is / are + not. الاختصارات: isn’t = is not، وaren’t = are not.'
    },
    i: {
      meaning: 'ضمير المتكلم المفرد، ومعناه «أنا».',
      why: 'في الإنجليزية يُكتب I دائماً حرفاً كبيراً، ويأتي معه am في المضارع من الفعل be.',
      uses: [['فاعل الجملة', 'I am learning English. = أنا أتعلم الإنجليزية.']],
      form: 'I + am ...'
    }
  };

  const style = document.createElement('style');
  style.textContent = `
    .grx-paragraph,.grx-list li,.grx-en,.grx-ar,.grx-wrong,.grx-correct,.grx-why{line-height:1.95;white-space:normal}
    .grx-paragraph .g-sentence,.grx-list li .g-sentence,.grx-en .g-sentence,.grx-ar .g-sentence,.grx-why .g-sentence{display:block;margin:0 0 .45em}
    .g-word{cursor:pointer;border-radius:4px;touch-action:pan-y}
    .g-word:active{background:var(--paper-2)}
    .g-help-hint{font-size:12px;color:var(--muted);margin:8px 0}
    .g-help-backdrop{position:fixed;inset:0;z-index:99999;background:#0008;display:flex;align-items:flex-end;justify-content:center;padding:12px}
    .g-help-card{width:min(100%,560px);max-height:82vh;overflow:auto;background:var(--paper,var(--bg,#fff));color:var(--ink,#222);border:1px solid var(--line,#ddd);border-radius:18px;padding:18px;box-shadow:0 12px 50px #0004}
    .g-help-card h3{margin:0 0 8px;font-size:22px;direction:ltr;text-align:left}
    .g-help-card p,.g-help-card li{line-height:1.85}
    .g-help-card .g-muted{color:var(--muted)}
    .g-help-card .g-help-close{width:100%;padding:12px;border:0;border-radius:10px;background:var(--accent,#176b58);color:white;font:inherit;margin-top:12px}
    .g-help-card .g-help-section{padding:10px 0;border-top:1px solid var(--line,#ddd)}
  `;
  document.head.appendChild(style);

  let suppressClick = false, pressTimer = null, pressedWord = null;
  function speakText(text) {
    text = String(text || '').trim();
    if (!text) return;
    try {
      if (typeof window.speak === 'function') { window.speak(text); return; }
    } catch (_) {}
    try {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.88;
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }

  function sentenceParts(text) {
    return String(text).match(/[^.!?؟؛]+[.!?؟؛]?|\s+/gu) || [String(text)];
  }
  function makeSentence(text) {
    const line = document.createElement('span');
    line.className = 'g-sentence';
    line.dataset.sentence = text.trim();
    for (const part of text.match(/\S+|\s+/gu) || []) {
      if (/^\s+$/u.test(part)) { line.appendChild(document.createTextNode(part)); continue; }
      const w = document.createElement('span');
      w.className = 'g-word';
      w.dataset.word = part.replace(/^[("'“‘]+|[),.!?؟؛:"'”’]+$/gu, '');
      w.textContent = part;
      line.appendChild(w);
    }
    return line;
  }
  function enhanceText(el) {
    if (el.dataset.gEnhanced) return;
    const raw = el.textContent || '';
    if (!raw.trim()) return;
    el.dataset.gEnhanced = '1';
    el.textContent = '';
    sentenceParts(raw).forEach(part => {
      if (/^\s+$/u.test(part)) el.appendChild(document.createTextNode(part));
      else el.appendChild(makeSentence(part));
    });
  }
  function openWordCard(word, sentence) {
    const key = String(word || '').toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, '');
    if (!key) return;
    const info = definitions[key] || {};
    let dict = null;
    try { if (typeof window.__lk === 'function') dict = window.__lk(key); } catch (_) {}
    const backdrop = document.createElement('div');
    backdrop.className = 'g-help-backdrop';
    backdrop.setAttribute('role','presentation');
    const card = document.createElement('section');
    card.className = 'g-help-card';
    card.setAttribute('role','dialog');
    card.setAttribute('aria-modal','true');
    const title = document.createElement('h3'); title.textContent = key;
    card.appendChild(title);
    if (dict && dict.ipa) { const ipa = document.createElement('p'); ipa.className='g-muted'; ipa.textContent='النطق: /'+dict.ipa+'/'; card.appendChild(ipa); }
    const meaning = document.createElement('p');
    meaning.textContent = info.meaning || (dict && dict.ar) || 'معنى الكلمة يعتمد على موقعها في الجملة والسياق.';
    card.appendChild(meaning);
    if (info.why) {
      const why = document.createElement('div'); why.className='g-help-section';
      const h = document.createElement('b'); h.textContent='لماذا استُخدمت هنا؟'; why.append(h,document.createElement('p'));
      why.lastChild.textContent=info.why; card.appendChild(why);
    }
    if (info.uses && info.uses.length) {
      const sec=document.createElement('div');sec.className='g-help-section';
      const h=document.createElement('b');h.textContent='استخداماتها مع أمثلة';sec.appendChild(h);
      const ul=document.createElement('ul');
      info.uses.forEach(x=>{const li=document.createElement('li');li.textContent=x[0]+': '+x[1];ul.appendChild(li);});
      sec.appendChild(ul);card.appendChild(sec);
    } else if (dict && (dict.ex || dict.pos)) {
      const sec=document.createElement('div');sec.className='g-help-section';
      sec.textContent=[dict.pos,dict.ex].filter(Boolean).join(' · ');card.appendChild(sec);
    }
    if (info.form) {
      const sec=document.createElement('div');sec.className='g-help-section';
      const h=document.createElement('b');h.textContent='طريقة الاستخدام';sec.append(h,document.createElement('p'));
      sec.lastChild.textContent=info.form;card.appendChild(sec);
    }
    const ctx=document.createElement('div');ctx.className='g-help-section';
    const label=document.createElement('b');label.textContent='الكلمة في هذا المثال';
    const example=document.createElement('p');example.dir='auto';example.textContent=sentence || key;
    ctx.append(label,example);card.appendChild(ctx);
    const close=document.createElement('button');close.type='button';close.className='g-help-close';close.textContent='إغلاق';
    close.addEventListener('click',()=>backdrop.remove());card.appendChild(close);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)backdrop.remove();});
    backdrop.appendChild(card);document.body.appendChild(backdrop);close.focus();
  }

  function enhancePage() {
    const root = document.querySelector('#page');
    if (!root || !root.querySelector('.grx-paragraph,.grx-list,.grx-examples,.grx-errors')) return;
    root.querySelectorAll('.grx-paragraph,.grx-list li,.grx-en,.grx-ar,.grx-wrong,.grx-correct,.grx-why').forEach(enhanceText);
    if (!root.querySelector('.g-help-hint')) {
      const hint=document.createElement('p');hint.className='g-help-hint';
      hint.textContent='🔊 اضغط على الكلمة لسماعها، أو اضغط على مساحة الجملة لسماعها كاملة. اضغط مطولاً على الكلمة لمعناها وشرح استخدامها.';
      const first=root.querySelector('.grx-open-note');
      if(first)first.after(hint);else root.prepend(hint);
    }
  }

  document.addEventListener('pointerdown', e => {
    const word=e.target.closest && e.target.closest('.g-word');
    if(!word)return;
    pressedWord=word;suppressClick=false;
    clearTimeout(pressTimer);
    pressTimer=setTimeout(()=>{suppressClick=true;const line=word.closest('.g-sentence');openWordCard(word.dataset.word,line&&line.dataset.sentence);},560);
  }, true);
  ['pointerup','pointercancel','pointerleave'].forEach(ev=>document.addEventListener(ev,()=>clearTimeout(pressTimer),true));
  document.addEventListener('click', e => {
    const root=e.target.closest && e.target.closest('#page');
    if(!root || !root.querySelector('.g-sentence'))return;
    if(suppressClick){e.preventDefault();e.stopImmediatePropagation();suppressClick=false;return;}
    const word=e.target.closest && e.target.closest('.g-word');
    if(word){e.preventDefault();e.stopImmediatePropagation();speakText(word.dataset.word);return;}
    const line=e.target.closest && e.target.closest('.g-sentence');
    if(line){e.preventDefault();e.stopImmediatePropagation();speakText(line.dataset.sentence);}
  }, true);

  const oldRender=window.render;
  if(typeof oldRender==='function'){
    window.render=function(){const result=oldRender.apply(this,arguments);enhancePage();return result;};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhancePage,{once:true});
  else enhancePage();
  setTimeout(enhancePage,300);
})();
