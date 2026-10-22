(function () {
  'use strict';

  const measurementId = 'G-0WY2MKR81M';
  const googleAdsId = 'AW-18529456628';
  const consentKey = 'cim_analytics_consent_v1';
  let loaded = false;
  let pageViewSent = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  function loadAnalytics() {
    if (loaded) return;
    loaded = true;
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      wait_for_update: 500
    });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, { anonymize_ip: true, send_page_view: false });
    window.gtag('config', googleAdsId);
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
    document.head.appendChild(script);
  }

  function updateConsent(granted) {
    window.gtag('consent', 'update', {
      analytics_storage: granted ? 'granted' : 'denied',
      ad_storage: granted ? 'granted' : 'denied',
      ad_user_data: granted ? 'granted' : 'denied',
      ad_personalization: 'denied'
    });
  }

  function sendPageView() {
    if (pageViewSent) return;
    pageViewSent = true;
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search + window.location.hash
    });
  }

  function track(name, params) {
    if (!loaded || !name) return;
    window.gtag('event', name, params || {});
  }

  function saveConsent(value) {
    try { localStorage.setItem(consentKey, value); } catch (_) {}
  }

  function removeBanner() {
    document.getElementById('cim-cookie-consent')?.remove();
  }

  function accept() {
    saveConsent('granted');
    loadAnalytics();
    updateConsent(true);
    sendPageView();
    removeBanner();
  }

  function reject() {
    saveConsent('denied');
    loadAnalytics();
    updateConsent(false);
    removeBanner();
  }

  function showBanner() {
    if (document.getElementById('cim-cookie-consent')) return;
    const banner = document.createElement('aside');
    banner.id = 'cim-cookie-consent';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Preferências de privacidade');
    banner.innerHTML = '<div><strong>Privacidade e medição</strong><p>Usamos cookies de análise para entender visitas e melhorar o catálogo. Você pode aceitar ou continuar sem cookies de análise.</p></div><div class="cim-cookie-actions"><button type="button" data-consent="reject">Continuar sem aceitar</button><button type="button" class="accept" data-consent="accept">Aceitar</button></div>';
    const style = document.createElement('style');
    style.textContent = '#cim-cookie-consent{position:fixed;z-index:2147483646;left:20px;right:20px;bottom:20px;max-width:920px;margin:auto;padding:18px 20px;border:1px solid #333;border-radius:16px;background:#111;color:#fff;box-shadow:0 18px 60px #000b;display:flex;align-items:center;justify-content:space-between;gap:22px;font:14px/1.45 Arial,sans-serif}#cim-cookie-consent strong{font-size:16px}#cim-cookie-consent p{margin:5px 0 0;color:#bbb}.cim-cookie-actions{display:flex;gap:9px;flex-shrink:0}.cim-cookie-actions button{border:1px solid #555;border-radius:999px;padding:11px 15px;background:transparent;color:#fff;cursor:pointer;font-weight:700}.cim-cookie-actions .accept{border-color:#d23021;background:#d23021}@media(max-width:700px){#cim-cookie-consent{align-items:stretch;flex-direction:column}.cim-cookie-actions{display:grid;grid-template-columns:1fr 1fr}.cim-cookie-actions button{padding:12px 8px}}';
    document.head.appendChild(style);
    banner.addEventListener('click', function (event) {
      const choice = event.target.closest('[data-consent]')?.dataset.consent;
      if (choice === 'accept') accept();
      if (choice === 'reject') reject();
    });
    document.body.appendChild(banner);
  }

  function installAutomaticEvents() {
    document.addEventListener('click', function (event) {
      const link = event.target.closest('a');
      if (!link) return;
      const href = link.href || '';
      if (/wa\.me|whatsapp/i.test(href)) track('generate_lead', { method: 'whatsapp', link_url: href, link_text: (link.textContent || '').trim().slice(0, 100) });
      else if (/^tel:/i.test(link.getAttribute('href') || '')) track('generate_lead', { method: 'phone' });
      if (link.classList.contains('card')) track('select_item', { item_name: link.querySelector('h2,h3')?.textContent?.trim() || 'Peça automotiva' });
      if (/\/login\.html/i.test(href)) track('login_start', { source: location.pathname });
    }, true);

    const searches = ['search-input', 'catalog-search', 'searchInputHeader'];
    searches.forEach(function (id) {
      const input = document.getElementById(id);
      if (!input) return;
      let timer = 0;
      let previous = '';
      input.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          const term = input.value.trim();
          if (term.length >= 2 && term !== previous) {
            previous = term;
            track('search', { search_term: term.slice(0, 100), search_source: id });
          }
        }, 900);
      });
    });
  }

  window.CimGA = { track: track, accept: accept, reject: reject, measurementId: measurementId, googleAdsId: googleAdsId };
  const consent = (function () { try { return localStorage.getItem(consentKey); } catch (_) { return null; } })();
  loadAnalytics();
  if (consent === 'granted') {
    updateConsent(true);
    sendPageView();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { installAutomaticEvents(); if (!consent) showBanner(); });
  else { installAutomaticEvents(); if (!consent) showBanner(); }
})();
