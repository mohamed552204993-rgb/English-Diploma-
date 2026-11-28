/* Optional foundation stage: embeds the original Leo learning experience without rewriting its lessons or interactions. */
(function () {
  'use strict';
  if (window.__foundationStageInstalled) return;
  window.__foundationStageInstalled = true;
  function openFoundation() {
    var page = document.getElementById('page');
    if (!page) return;
    page.classList.add('p12');
    page.innerHTML = '<div class="fd-leon-shell"><div class="fd-leon-toolbar"><button type="button" class="fd-leon-back" id="fd-leon-back">← العودة إلى أقسام الدبلوم</button><span>المرحلة التأسيسية · اختيارية</span></div><iframe class="fd-leon-frame" src="./leon-foundation.html" title="المرحلة التأسيسية" allow="microphone; autoplay" loading="eager"></iframe></div>';
    var back = document.getElementById('fd-leon-back');
    if (back) back.onclick = function () { if (window.__hub && window.__hub.go) window.__hub.go('hub'); };
  }
  var css = '.fd-leon-shell{width:100%;min-height:70vh;display:flex;flex-direction:column;gap:8px}.fd-leon-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;padding:4px 2px}.fd-leon-toolbar span{font-size:12px;color:var(--muted,#718078)}.fd-leon-back{border:1px solid var(--border,#dfe7e2);background:var(--card,#fff);color:inherit;border-radius:12px;padding:9px 13px;font:inherit;cursor:pointer}.fd-leon-frame{display:block;width:100%;height:calc(100dvh - 150px);min-height:580px;border:0;border-radius:16px;background:#fff}@media(max-width:520px){.fd-leon-frame{height:calc(100dvh - 135px);min-height:560px;border-radius:12px}}';
  var style = document.createElement('style'); style.id = 'fd-leon-stage-style'; style.textContent = css; document.head.appendChild(style);
  if (window.__hub && typeof window.__hub.sections === 'function') {
    var originalSections = window.__hub.sections;
    window.__hub.sections = function () {
      var sections = originalSections.apply(this, arguments);
      var item = {ic:'🧩',t:'المرحلة التأسيسية',d:'ابدأ من الصفر بتجربة ليو التعليمية · اختيارية',go:openFoundation};
      return sections && sections.length ? [sections[0],item].concat(sections.slice(1)) : [item];
    };
  }
  window.__foundation = {open:openFoundation,source:'Leo English original'};
})();