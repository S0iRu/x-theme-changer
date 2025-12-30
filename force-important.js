(() => {
  // ===== チューニング =====
  const MAX_PER_TICK = 800;
  const TOL = 2;
  const SCOPE = ''; // 例: 'main, [data-testid="primaryColumn"]'

  // ===== 置換マップ =====
  // 背景色変換はホバー時に問題が発生するため無効化
  const BG_MAP = [
    // ['29, 155, 240', '255, 155, 240'],
  ];
  // テキスト色のみ変換
  const FG_MAP = [
    ['29, 155, 240', '255, 155, 240'],
    // ['15,20,25', '255,255,255'],
  ];

  // ===== ユーティリティ =====
  const MARK_ATTRS = [
    'data-bg-el', 'data-bg-before', 'data-bg-after',
    'data-fg-el', 'data-fg-before', 'data-fg-after'
  ];
  const VARS = [
    '--bg-to-el', '--bg-to-before', '--bg-to-after',
    '--fg-to-el', '--fg-to-before', '--fg-to-after'
  ];
  const MARKED_SELECTOR =
    '[data-bg-el="1"],[data-bg-before="1"],[data-bg-after="1"],[data-fg-el="1"],[data-fg-before="1"],[data-fg-after="1"]';

  const normRGBA = (v) => {
    if (v == null) return null;
    const s = String(v).trim();
    let m = s.replace(/\s+/g, '').match(/^(\d{1,3}),(\d{1,3}),(\d{1,3})$/);
    if (m) return { rgb: `${+m[1]},${+m[2]},${+m[3]}`, a: 1 };
    m = s.replace(/\s+/g, '').match(/^rgba?\((\d{1,3}),(\d{1,3}),(\d{1,3})(?:,([0-9.]+))?\)/i);
    if (m) {
      const a = m[4] != null ? parseFloat(m[4]) : 1;
      if (a <= 0) return null;
      return { rgb: `${+m[1]},${+m[2]},${+m[3]}`, a };
    }
    return null;
  };

  const near = (a, b, tol = TOL) => {
    if (!a || !b) return false;
    const A = a.split(',').map(Number), B = b.split(',').map(Number);
    return Math.abs(A[0] - B[0]) <= tol && Math.abs(A[1] - B[1]) <= tol && Math.abs(A[2] - B[2]) <= tol;
  };

  const toPairs = (map) =>
    (Array.isArray(map) ? map : []).map(([from, to]) => {
      const f = normRGBA(from)?.rgb, t = normRGBA(to)?.rgb;
      return (f && t) ? { from: f, to: t } : null;
    }).filter(Boolean);

  const BG_PAIRS = toPairs(BG_MAP);
  const FG_PAIRS = toPairs(FG_MAP);

  const cacheBG = new Map();
  const cacheFG = new Map();

  const findToCached = (pairs, computed, cache) => {
    const n = normRGBA(computed);
    if (!n) return null;
    const c = n.rgb;
    if (cache.has(c)) return cache.get(c);
    let res = null;
    for (const p of pairs) {
      if (c === p.from || near(c, p.from)) { res = p.to; break; }
    }
    cache.set(c, res);
    return res;
  };

  // ===== スタイル注入 =====
  const STYLE_ID = 'repaint-style-lite';
  const ensureStyle = (root = document) => {
    const isShadow = root instanceof ShadowRoot;
    let host = isShadow ? root : (document.head || document.documentElement || document.body);
    if (!host || !host.querySelector) host = document.documentElement;
    if (host.querySelector(`#${CSS.escape(STYLE_ID)}`)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [data-bg-el="1"]{ background-color: var(--bg-to-el) !important; }
      [data-bg-before="1"]::before{ background-color: var(--bg-to-before) !important; }
      [data-bg-after="1"]::after{ background-color: var(--bg-to-after) !important; }
      [data-fg-el="1"]{ color: var(--fg-to-el) !important; }
      [data-fg-before="1"]::before{ color: var(--fg-to-before) !important; }
      [data-fg-after="1"]::after{ color: var(--fg-to-after) !important; }
    `;
    host.appendChild(style);
  };

  const mark = (el, attr, varName, rgb) => {
    el.setAttribute(attr, '1');
    el.style.setProperty(varName, `rgb(${rgb})`);
  };

  const unmark = (el) => {
    let changed = false;
    for (const a of MARK_ATTRS) {
      if (el.hasAttribute(a)) { el.removeAttribute(a); changed = true; }
    }
    // 変数は残っても害は無いが、念のため消す
    for (const v of VARS) el.style.removeProperty(v);
    return changed;
  };

  // ===== 単一要素処理 =====
  const processElement = (el) => {
    if (!(el instanceof Element)) return;

    // ホバー中は固定を再適用しない
    if (el.getAttribute('data-repaint-hovering') === '1') return;

    const cs = getComputedStyle(el);

    // 背景
    if (BG_PAIRS.length) {
      if (el.getAttribute('data-bg-el') !== '1') {
        const toEl = findToCached(BG_PAIRS, cs.backgroundColor, cacheBG);
        if (toEl) mark(el, 'data-bg-el', '--bg-to-el', toEl);
      }
      const bef = getComputedStyle(el, '::before');
      if (el.getAttribute('data-bg-before') !== '1' && bef.content !== 'none') {
        const toBefore = findToCached(BG_PAIRS, bef.backgroundColor, cacheBG);
        if (toBefore) mark(el, 'data-bg-before', '--bg-to-before', toBefore);
      }
      const aft = getComputedStyle(el, '::after');
      if (el.getAttribute('data-bg-after') !== '1' && aft.content !== 'none') {
        const toAfter = findToCached(BG_PAIRS, aft.backgroundColor, cacheBG);
        if (toAfter) mark(el, 'data-bg-after', '--bg-to-after', toAfter);
      }
    }

    // 文字
    if (FG_PAIRS.length) {
      if (el.getAttribute('data-fg-el') !== '1') {
        const toEl = findToCached(FG_PAIRS, cs.color, cacheFG);
        if (toEl) mark(el, 'data-fg-el', '--fg-to-el', toEl);
      }
      const bef2 = getComputedStyle(el, '::before');
      if (el.getAttribute('data-fg-before') !== '1' && bef2.content !== 'none') {
        const toBefore = findToCached(FG_PAIRS, bef2.color, cacheFG);
        if (toBefore) mark(el, 'data-fg-before', '--fg-to-before', toBefore);
      }
      const aft2 = getComputedStyle(el, '::after');
      if (el.getAttribute('data-fg-after') !== '1' && aft2.content !== 'none') {
        const toAfter = findToCached(FG_PAIRS, aft2.color, cacheFG);
        if (toAfter) mark(el, 'data-fg-after', '--fg-to-after', toAfter);
      }
    }

    // ShadowRoot
    if (el.shadowRoot) {
      ensureStyle(el.shadowRoot);
      observeRoot(el.shadowRoot);
      enqueueSubtree(el.shadowRoot);
    }
  };

  // ===== キュー処理 =====
  const queue = [];
  let scheduled = false;
  const tick = () => {
    scheduled = false;
    let count = 0;
    while (queue.length && count < MAX_PER_TICK) {
      const cur = queue.shift();
      processElement(cur);
      const children = cur instanceof ShadowRoot ? cur.children : (cur.children || []);
      for (let i = 0; i < children.length; i++) queue.push(children[i]);
      count++;
    }
    if (queue.length) schedule();
  };
  const schedule = () => {
    if (!scheduled) {
      scheduled = true;
      (window.requestIdleCallback || window.requestAnimationFrame)(tick);
    }
  };
  const enqueueSubtree = (root) => {
    if (!root) return;
    if (root instanceof ShadowRoot) {
      const kids = root.children;
      for (let i = 0; i < kids.length; i++) queue.push(kids[i]);
    } else if (root instanceof Element || root === document) {
      const base = (SCOPE && root.querySelectorAll) ? root.querySelectorAll(SCOPE) : [root];
      base.forEach((b) => {
        if (b instanceof Element) queue.push(b);
        const kids = b.children || [];
        for (let i = 0; i < kids.length; i++) queue.push(kids[i]);
      });
    }
    schedule();
  };

  // ===== 監視 =====
  const observed = new WeakSet();
  const observeRoot = (root = document) => {
    if (!root || observed.has(root)) return;
    observed.add(root);
    ensureStyle(root);

    const mo = new MutationObserver((muts) => {
      let touched = false;
      for (const m of muts) {
        if (m.type === 'attributes') {
          if (m.target && m.target.nodeType === 1) {
            queue.push(m.target);
            touched = true;
          }
        } else if (m.type === 'childList') {
          m.addedNodes && m.addedNodes.forEach((n) => {
            if (n && n.nodeType === 1) {
              queue.push(n);
              if (n.shadowRoot) {
                ensureStyle(n.shadowRoot);
                observeRoot(n.shadowRoot);
              }
              touched = true;
            }
          });
        }
      }
      if (touched) schedule();
    });

    mo.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-testid', 'aria-hidden']
    });

    // ===== ホバー/フォーカス時の一時解除 =====
    const onPointerOver = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const marked = t.closest?.(MARKED_SELECTOR);
      if (marked && marked.getAttribute('data-repaint-hovering') !== '1') {
        marked.setAttribute('data-repaint-hovering', '1');
        unmark(marked);              // 固定解除
        // この時点で :hover スタイルが素のCSSで効く
      }
    };
    const onPointerOut = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.getAttribute('data-repaint-hovering') === '1') {
        // 要素外へ完全に出たときだけ再適用
        if (!t.contains(e.relatedTarget)) {
          t.removeAttribute('data-repaint-hovering');
          queue.push(t);
          schedule();
        }
      }
    };
    const onFocusIn = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (t.matches?.(MARKED_SELECTOR)) {
        t.setAttribute('data-repaint-hovering', '1');
        unmark(t);
      } else {
        const marked = t.closest?.(MARKED_SELECTOR);
        if (marked) {
          marked.setAttribute('data-repaint-hovering', '1');
          unmark(marked);
        }
      }
    };
    const onFocusOut = (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const marked = (t.matches?.('[data-repaint-hovering="1"]') ? t : t.closest?.('[data-repaint-hovering="1"]'));
      if (marked) {
        marked.removeAttribute('data-repaint-hovering');
        queue.push(marked);
        schedule();
      }
    };

    // ShadowRoot/Document どちらにもリスナをアタッチ
    root.addEventListener?.('pointerover', onPointerOver, true); // capture
    root.addEventListener?.('pointerout', onPointerOut, true);   // capture
    root.addEventListener?.('focusin', onFocusIn, true);
    root.addEventListener?.('focusout', onFocusOut, true);
  };

  // ===== 背景画像URLを動的に設定 =====
  const setBgImage = () => {
    const bgUrl = chrome.runtime.getURL('background.png');
    const styleId = 'x-theme-bg-style';

    // 既に存在する場合はスキップ
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      html, body {
        background: url("${bgUrl}") no-repeat center center fixed !important;
        background-size: cover !important;
      }
    `;

    // headまたはdocumentElementに挿入
    const target = document.head || document.documentElement;
    if (target) {
      target.appendChild(style);
    }
  };

  // DOM準備前でも実行を試みる
  setBgImage();

  // DOMContentLoadedでも再試行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setBgImage);
  }

  // ===== 起動 =====
  observeRoot(document);
  ensureStyle(document);

  if (SCOPE) {
    document.querySelectorAll(SCOPE).forEach(el => queue.push(el));
  } else {
    queue.push(document.documentElement);
  }
  schedule();

  document.addEventListener('readystatechange', () => enqueueSubtree(document));
  window.addEventListener('load', () => enqueueSubtree(document));
})();
