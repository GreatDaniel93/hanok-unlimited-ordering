'use client';
import { useEffect } from 'react';

function proxySrc(src) {
  try {
    const u = new URL(src, window.location.origin);
    if (u.hostname !== 'hanokbbq.com.au') return null;
    const file = u.pathname.split('/').pop();
    if (!file) return null;
    return `/api/menu-image?file=${encodeURIComponent(file)}`;
  } catch {
    return null;
  }
}

export default function MenuImageProxyPatch() {
  useEffect(() => {
    const patch = root => {
      const imgs = root?.querySelectorAll ? root.querySelectorAll('img') : [];
      imgs.forEach(img => {
        const next = proxySrc(img.getAttribute('src') || img.src || '');
        if (next && img.getAttribute('src') !== next) img.setAttribute('src', next);
      });
    };
    patch(document);
    const obs = new MutationObserver(mutations => {
      for (const m of mutations) {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.tagName === 'IMG') {
            const next = proxySrc(node.getAttribute('src') || node.src || '');
            if (next) node.setAttribute('src', next);
          }
          patch(node);
        });
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);
  return null;
}
