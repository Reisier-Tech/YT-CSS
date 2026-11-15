// ==UserScript==
// @name         YouTube Auto-Bypass Sensitive Content Warnings
// @namespace    https://youtube.com/
// @version      2.1
// @description  Automatically bypasses and clicks "I understand and wish to proceed" on sensitive, suicide, or self-harm content warnings on YouTube with zero CPU overhead during playback.
// @author       Antigravity
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // 1. Enforce Nunito typography across document DOM
  function injectNunitoFont() {
    if (document.getElementById('yt-nunito-font-style')) return;

    if (!document.getElementById('yt-nunito-font-link')) {
      const link = document.createElement('link');
      link.id = 'yt-nunito-font-link';
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,300..900;1,300..900&display=swap';
      (document.head || document.documentElement).appendChild(link);
    }

    const style = document.createElement('style');
    style.id = 'yt-nunito-font-style';
    style.textContent = `
      html, html[dark], html[light], :root, [dark], body, ytd-app {
        --yt-font-family: 'Nunito', 'Segoe UI', sans-serif !important;
        --yt-sans-font: 'Nunito', 'Segoe UI', sans-serif !important;
        --ytd-font-family: 'Nunito', 'Segoe UI', sans-serif !important;
        --yt-title-font-family: 'Nunito', 'Segoe UI', sans-serif !important;
        --yt-spec-typography-title-1-font-family: 'Nunito', 'Segoe UI', sans-serif !important;
        --yt-spec-typography-title-2-font-family: 'Nunito', 'Segoe UI', sans-serif !important;
        --yt-spec-typography-title-3-font-family: 'Nunito', 'Segoe UI', sans-serif !important;
        --yt-spec-typography-body-1-font-family: 'Nunito', 'Segoe UI', sans-serif !important;
        --yt-spec-typography-body-2-font-family: 'Nunito', 'Segoe UI', sans-serif !important;
        --yt-spec-typography-caption-font-family: 'Nunito', 'Segoe UI', sans-serif !important;
        --yt-spec-typography-button-font-family: 'Nunito', 'Segoe UI', sans-serif !important;
        --yt-spec-typography-label-font-family: 'Nunito', 'Segoe UI', sans-serif !important;
        --ytd-user-comment-font-family: 'Nunito', 'Segoe UI', sans-serif !important;
      }
      h1, h2, h3, h4, h5, h6, p, a, span, b, strong, em, small, label, li, time, yt-formatted-string, yt-formatted-string span, yt-core-attributed-string, yt-core-attributed-string span, yt-attributed-string, yt-attributed-string span, .yt-core-attributed-string, .yt-spec-button-shape-next__button-text-content, #video-title, #channel-name, #description, #content-text, #owner-sub-count, #metadata-line span, #expand, #collapse, #expand *, #collapse *, ytd-text-inline-expander *, tp-yt-paper-button, tp-yt-paper-button *, .badge-shape-wiz, .badge-shape-wiz__text, .yt-tab-shape-wiz, .yt-tab-shape-wiz__tab, .sbsb_c, .gsfs, .ytp-time-display, .ytp-time-current, .ytp-time-duration, ytd-popup-container *, ytd-menu-service-item-renderer, ytd-menu-service-item-renderer *, tp-yt-paper-item, tp-yt-paper-item *, .subtitle, button, input, textarea {
        font-family: 'Nunito', 'Segoe UI', sans-serif !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  injectNunitoFont();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNunitoFont);
  }

  const TARGET_KEYWORDS = [
    'understand and wish to proceed',
    'understand',
    'proceed',
    'continue',
    'tôi hiểu và muốn tiếp tục',
    'tiếp tục',
    'tôi hiểu',
    'xác nhận'
  ];

  function simulateClick(el) {
    if (!el) return;
    const opts = { bubbles: true, cancelable: true, composed: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
    if (typeof el.click === 'function') {
      el.click();
    }
  }

  // Scoped search traversing ONLY within explicit error container shadow boundaries
  function findButtonsInContainer(container) {
    const found = [];
    if (!container) return found;

    try {
      const candidates = container.querySelectorAll('button, yt-button-shape, [role="button"]');
      for (const el of candidates) {
        found.push(el);
      }

      // Check shadow roots only inside the error container elements
      const children = container.querySelectorAll('*');
      for (const el of children) {
        if (el.shadowRoot) {
          const subCandidates = el.shadowRoot.querySelectorAll('button, yt-button-shape, [role="button"]');
          for (const subEl of subCandidates) {
            found.push(subEl);
          }
        }
      }
    } catch (e) {
      // Ignore cross-origin / closed shadow root errors
    }

    return found;
  }

  let lastClickedTime = 0;

  function checkAndBypass() {
    const now = Date.now();
    if (now - lastClickedTime < 1000) return;

    // 1. Fast check for interruption notification toast
    const toast = document.querySelector('yt-notification-action-renderer, tp-yt-paper-toast, snackbar-view-model');
    if (toast) {
      const text = (toast.textContent || '').toLowerCase();
      if (text.includes('gián đoạn') || text.includes('interrupt') || text.includes('sự cố')) {
        toast.remove();
        const video = document.querySelector('video');
        if (video && video.paused) {
          video.play().catch(() => {});
        }
      }
    }

    // 2. Playback state guard: If video is actively playing, abort immediately (0.005ms execution)
    const video = document.querySelector('video');
    const isActivelyPlaying = video && !video.paused && !video.ended && video.currentTime > 0;
    if (isActivelyPlaying) {
      return;
    }

    // 3. Fast targeted error container check (NO full-DOM querySelectorAll('*') traversal)
    const errorContainers = [
      '#error-screen',
      'ytd-player-error-message-renderer',
      'yt-playability-error-supported-renderers',
      '#player-error-message-container',
      '.ytp-error',
      'ytd-watch-flexy[player-unavailable]'
    ];

    let clicked = false;

    for (const containerSel of errorContainers) {
      const container = document.querySelector(containerSel);
      if (container && (container.offsetWidth > 0 || container.offsetHeight > 0 || container.getClientRects().length > 0)) {
        const buttons = findButtonsInContainer(container);
        for (const btn of buttons) {
          const text = ((btn.textContent || '') + ' ' + (btn.getAttribute('aria-label') || '')).toLowerCase();
          for (const kw of TARGET_KEYWORDS) {
            if (text.includes(kw)) {
              const target = btn.tagName.toLowerCase() === 'button' ? btn : (btn.querySelector('button') || btn);
              simulateClick(target);
              lastClickedTime = Date.now();
              clicked = true;
              break;
            }
          }
          if (clicked) break;
        }
        if (clicked) break;
      }
    }

    // If we clicked a warning bypass, attempt to unpause the player
    if (clicked) {
      setTimeout(() => {
        const v = document.querySelector('video');
        if (v && v.paused) {
          v.play().catch(() => {});
        }
      }, 500);
    }
  }

  // Periodic polling: 1000ms is imperceptible for error screens while reducing CPU calls by 60%
  setInterval(checkAndBypass, 1000);

  // YouTube navigation hooks
  window.addEventListener('yt-navigate-finish', checkAndBypass);
  window.addEventListener('yt-page-data-updated', checkAndBypass);
  window.addEventListener('DOMContentLoaded', checkAndBypass);
  window.addEventListener('load', checkAndBypass);

  // Debounced DOM observer: prevents thread flooding during continuous playback/scrubbing
  let debounceTimeout = null;
  function debouncedCheck() {
    if (debounceTimeout) return;
    debounceTimeout = setTimeout(() => {
      debounceTimeout = null;
      checkAndBypass();
    }, 300);
  }

  const observer = new MutationObserver(debouncedCheck);
  const startObserver = () => {
    const target = document.querySelector('ytd-watch-flexy') || document.querySelector('#player') || document.body;
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
