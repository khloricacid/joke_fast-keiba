/* 初めて来た人に、ジョークサイトであることを1回だけ知らせる。ゲームとデータページの両方で読む。
   window.FKAbout.ready は閉じたときに 'play' / 'calm' / 'seen'(以前に確認済み)で解決する。 */
(() => {
  'use strict';
  const KEY = 'fastkeiba.about.v1';
  const css = `
.fka-back{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:16px;background:rgba(6,8,20,.78);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.fka-box{width:min(520px,100%);max-height:calc(100% - 8px);overflow-y:auto;background:#edebe2;color:#16130f;border:3px solid #16130f;box-shadow:6px 6px 0 #16130f;font-family:"Zen Kaku Gothic New","Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif;font-weight:500;line-height:1.65}
.fka-head{background:#d1131f;color:#fff;padding:12px 18px 10px;border-bottom:3px solid #16130f}
.fka-head p{margin:0;font-size:12px;font-weight:900;letter-spacing:.08em}
.fka-head h2{margin:2px 0 0;font-family:"Dela Gothic One","Hiragino Kaku Gothic ProN",sans-serif;font-weight:400;font-size:clamp(22px,6vw,30px);line-height:1.25}
.fka-body{padding:14px 18px 4px;font-size:14px}
.fka-body ul{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.fka-body li{position:relative;padding-left:1.2em}
.fka-body li::before{content:"";position:absolute;left:0;top:.62em;width:.5em;height:.5em;background:#d1131f}
.fka-body b{font-weight:900}
.fka-small{font-size:12px;color:#5d584c;margin:10px 0 0}
.fka-btns{display:flex;gap:8px;flex-wrap:wrap;padding:14px 18px 18px}
.fka-btns button{flex:1 1 180px;min-height:46px;border:3px solid #16130f;border-radius:4px;font:inherit;font-weight:900;font-size:15px;cursor:pointer}
.fka-go{background:#ffd60a;color:#16130f;box-shadow:3px 3px 0 #16130f}
.fka-calm{background:#fff;color:#16130f}
.fka-btns button:focus-visible{outline:3px solid #1f5fd1;outline-offset:2px}
.fka-btns button:active{transform:translate(2px,2px);box-shadow:none}`;

  let resolveReady, opened = false;
  const ready = new Promise(r => { resolveReady = r; });
  let seen = false;
  try { seen = localStorage.getItem(KEY) === '1'; } catch (e) {}

  function open(fromMenu){
    if (opened) return;
    opened = true;
    if (!document.getElementById('fka-style')) { const st = document.createElement('style'); st.id = 'fka-style'; st.textContent = css; document.head.appendChild(st); }
    const isGame = !!document.getElementById('gl');
    const back = document.createElement('div');
    back.className = 'fka-back';
    back.innerHTML =
      '<div class="fka-box" role="dialog" aria-modal="true" aria-labelledby="fka-title">' +
      '<div class="fka-head"><p>はじめての方へ</p><h2 id="fka-title">このサイトはジョークです</h2></div>' +
      '<div class="fka-body"><ul>' +
      '<li>「ファスト競馬」は、5秒で決着する<b>架空の競馬ゲーム</b>です。馬・騎手・レース・ニュースはすべて作り話で、実在の競馬や団体、人物とは関係ありません。</li>' +
      '<li>賭けるのは<b>ゲーム内のコインだけ</b>です。お金は賭けられず、コインの購入も換金もできません。</li>' +
      '<li>すぐに刺激を求めてしまう人を指すネットスラング「ドパガキ」をネタにしたパロディです。</li>' +
      (isGame ? '<li><b>光の点滅や画面の揺れが多い</b>ゲームです。苦手な方は「演出ひかえめで遊ぶ」を選んでください。あとから「メニュー」で切り替えられます。</li>' : '') +
      '</ul><p class="fka-small">本物の馬券は20歳になってから。</p></div>' +
      '<div class="fka-btns">' +
      (isGame ? '<button type="button" class="fka-go" data-v="play">わかった、遊ぶ</button><button type="button" class="fka-calm" data-v="calm">演出ひかえめで遊ぶ</button>'
              : '<button type="button" class="fka-go" data-v="play">わかった</button>') +
      '</div></div>';
    document.body.appendChild(back);
    const prev = document.activeElement;
    const btns = Array.from(back.querySelectorAll('button'));
    btns[0].focus();
    const close = v => {
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      back.remove(); opened = false;
      document.removeEventListener('keydown', onKey, true);
      if (prev && prev.focus && fromMenu) prev.focus();
      resolveReady(v);
    };
    // Tab で外に出ないようにする。Esc は「わかった」と同じ扱い
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); close('play'); }
      else if (e.key === 'Tab') {
        const i = btns.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); btns[btns.length - 1].focus(); }
        else if (!e.shiftKey && i === btns.length - 1) { e.preventDefault(); btns[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    btns.forEach(b => b.addEventListener('click', () => close(b.dataset.v)));
  }
  window.FKAbout = {ready, open:() => open(true)};
  if (seen) resolveReady('seen');
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => open(false));
  else open(false);
})();
