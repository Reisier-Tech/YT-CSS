// ==UserScript==
// @name         YouTube Auto-Bypass Sensitive Content Warnings
// @namespace    https://youtube.com/
// @version      2.0
// @description  Automatically bypasses and clicks "I understand and wish to proceed" on sensitive, suicide, or self-harm content warnings on YouTube
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
      h1, h2, h3, h4, h5, h6, p, a, span, b, strong, em, small, label, li, time, yt-formatted-string, yt-formatted-string span, yt-core-attributed-string, yt-core-attributed-string span, yt-attributed-string, yt-attributed-string span, .yt-core-attributed-string, .yt-spec-button-shape-next__button-text-content, #video-title, #channel-name, #description, #content-text, #owner-sub-count, #metadata-line span, .badge-shape-wiz, .badge-shape-wiz__text, .yt-tab-shape-wiz, .yt-tab-shape-wiz__tab, .sbsb_c, .gsfs, .ytp-time-display, .ytp-time-current, .ytp-time-duration, button, input, textarea {
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

  // Deep search traversing through Shadow DOM boundaries
  function findButtonsInRoot(root) {
    let found = [];
    if (!root) return found;

    try {
      const candidates = root.querySelectorAll ? root.querySelectorAll('button, yt-button-shape, [role="button"]') : [];
      for (const el of candidates) {
        found.push(el);
      }

      const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
      for (const el of all) {
        if (el.shadowRoot) {
          found = found.concat(findButtonsInRoot(el.shadowRoot));
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
    // Throttle clicks slightly to avoid double firing
    if (now - lastClickedTime < 1000) return;

    let clicked = false;

    // 1. Direct high-priority selectors inside error containers
    const errorContainers = [
      '#error-screen',
      'ytd-player-error-message-renderer',
      'yt-playability-error-supported-renderers',
      '#player-error-message-container',
      '.ytp-error',
      'ytd-watch-flexy[player-unavailable]'
    ];

    for (const containerSel of errorContainers) {
      const container = document.querySelector(containerSel);
      if (container) {
        const buttons = findButtonsInRoot(container);
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

    // 2. Global fallback search across shadow roots if container not matched
    if (!clicked) {
      const allButtons = findButtonsInRoot(document);
      for (const btn of allButtons) {
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
    }

    // If we clicked a warning bypass, attempt to unpause the player
    if (clicked) {
      setTimeout(() => {
        const video = document.querySelector('video');
        if (video && video.paused) {
          video.play().catch(() => {});
        }
      }, 500);
    }
  }

  // Periodic polling check (runs every 400ms to catch async player renders)
  setInterval(checkAndBypass, 400);

  // YouTube navigation hooks
  window.addEventListener('yt-navigate-finish', checkAndBypass);
  window.addEventListener('yt-page-data-updated', checkAndBypass);
  window.addEventListener('DOMContentLoaded', checkAndBypass);
  window.addEventListener('load', checkAndBypass);

  // Dynamic DOM observation
  const observer = new MutationObserver(checkAndBypass);
  const startObserver = () => {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }
})();
