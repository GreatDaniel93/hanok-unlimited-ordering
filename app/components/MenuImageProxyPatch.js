'use client';
import { useEffect } from 'react';

const LOCAL = {
  '%E1%84%83%E1%85%B3%E1%86%BC%E1%84%89%E1%85%B5%E1%86%B7_1-%E6%8B%B7%E8%B4%9D.jpg': '/menu/original/wagyu-scotch-fillet.jpg',
  '%E1%84%89%E1%85%A1%E1%86%AF%E1%84%8E%E1%85%B5%E1%84%89%E1%85%A1%E1%86%AF_1-%E6%8B%B7%E8%B4%9D.jpg': '/menu/original/wagyu-intercostal.jpg',
  '%E1%84%8C%E1%85%A6%E1%84%87%E1%85%B5%E1%84%8E%E1%85%AE%E1%84%85%E1%85%B5_1-%E6%8B%B7%E8%B4%9D.jpg': '/menu/original/wagyu-inside-skirt.jpg'
};

function proxySrc(src) {
  try {
    const u = new URL(src, window.location.origin);
    if (u.pathname.startsWith('/menu/original/')) return null;
    if (u.hostname !== 'hanokbbq.com.au') return null;
    const file = u.pathname.split('/').pop();
    if (!file) return null;
    return LOCAL[file] || null;
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
