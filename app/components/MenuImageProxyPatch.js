'use client';
import { useEffect } from 'react';

const FINAL_LOCAL = {
  'wagyu-scotch-fillet.jpg': '/menu/final/wagyu-scotch-fillet.webp',
  'wagyu-intercostal.jpg': '/menu/final/wagyu-intercostal.webp',
  'wagyu-inside-skirt.jpg': '/menu/final/wagyu-inside-skirt.webp',
};

function proxySrc(src) {
  try {
    const u = new URL(src, window.location.origin);
    const file = u.pathname.split('/').pop();
    if (!file) return null;
    if (FINAL_LOCAL[file]) return FINAL_LOCAL[file];
    if (u.hostname !== 'hanokbbq.com.au') return null;
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
