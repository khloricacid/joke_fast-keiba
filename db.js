/* ファスト競馬データ:馬・騎手・ニュースのページ。内容は data.js にあり、すべて架空。 */
(() => {
'use strict';
const D = window.FK_DATA;
try { localStorage.setItem('fastkeiba.dbseen', '1'); } catch (e) {}   // ゲーム側の隠し実績「研究熱心」用
const view = document.getElementById('view');
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const fmt = n => Math.round(n).toLocaleString('ja-JP');
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function rng32(seed){
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// 総合値:スピードと瞬発力を重く、スタミナは軽く(5秒で終わるので)
const overall = h => Math.round(h.st[0] * 0.3 + h.st[1] * 0.3 + h.st[2] * 0.1 + h.st[3] * 0.1 + h.st[4] * 0.2);
const fx = (m, ef) => (1 + (m - 1) * ef).toFixed(2);
const jOverall = j => Math.round(j.st.reduce((a, b) => a + b, 0) / j.st.length);
const grade = v => v >= 90 ? 'S' : v >= 80 ? 'A' : v >= 65 ? 'B' : v >= 45 ? 'C' : v >= 25 ? 'D' : v >= 10 ? 'E' : 'G';
const gcls = v => 'g' + grade(v);
const rate = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '-';
const recText = r => '[' + r[1] + '-' + r[2] + '-' + r[3] + '-' + (r[0] - r[1] - r[2] - r[3]) + ']';

function horseSvg(h, w){
  const c = D.coats[h.coat];
  return '<svg class="hsvg" viewBox="0 0 120 84" width="' + w + '" role="img" aria-label="' + esc(c.name) + 'の馬">' +
    '<g fill="' + c.dark + '"><rect x="8" y="26" width="20" height="6" transform="rotate(28 28 29)"/><rect x="70" y="14" width="26" height="5" transform="rotate(-48 70 16)"/></g>' +
    '<g fill="' + c.body + '"><rect x="24" y="30" width="56" height="22"/><rect x="72" y="28" width="14" height="20"/>' +
    '<polygon points="74,34 92,10 102,16 88,44"/><rect x="90" y="6" width="24" height="12" transform="rotate(22 90 6)"/><rect x="92" y="2" width="4" height="8"/>' +
    '<rect x="28" y="50" width="7" height="24"/><rect x="38" y="50" width="7" height="24"/><rect x="64" y="50" width="7" height="24"/><rect x="74" y="50" width="7" height="24"/></g>' +
    '<g fill="' + c.dark + '"><rect x="27" y="72" width="9" height="5"/><rect x="37" y="72" width="9" height="5"/><rect x="63" y="72" width="9" height="5"/><rect x="73" y="72" width="9" height="5"/><rect x="108" y="16" width="7" height="6" transform="rotate(22 108 16)"/></g></svg>';
}
function jockeySvg(i, w){
  const hue = (i * 37 + 12) % 360, a = 'hsl(' + hue + ' 80% 48%)', b = 'hsl(' + ((hue + 180) % 360) + ' 85% 60%)';
  return '<svg class="jsvg" viewBox="0 0 64 64" width="' + w + '" role="img" aria-label="勝負服">' +
    '<rect x="14" y="34" width="36" height="26" fill="' + a + '"/><rect x="14" y="42" width="36" height="7" fill="' + b + '"/>' +
    '<rect x="22" y="20" width="20" height="16" fill="#e8c9a8"/><rect x="18" y="8" width="28" height="14" fill="' + a + '"/><rect x="18" y="18" width="34" height="5" fill="' + b + '"/>' +
    '<rect x="24" y="25" width="16" height="5" fill="#16130f"/></svg>';
}
function radar(st, names){
  const n = st.length, cx = 110, cy = 104, R = 74;
  const pt = (i, r) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
  let g = '';
  for (const k of [0.25, 0.5, 0.75, 1]) g += '<polygon class="rgrid" points="' + st.map((_, i) => pt(i, R * k).map(v => v.toFixed(1)).join(',')).join(' ') + '"/>';
  for (let i = 0; i < n; i++) { const p = pt(i, R); g += '<line class="rgrid" x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '"/>'; }
  const poly = st.map((v, i) => pt(i, R * clamp(v, 4, 100) / 100).map(x => x.toFixed(1)).join(',')).join(' ');
  let lab = '';
  for (let i = 0; i < n; i++) { const p = pt(i, R + 16); lab += '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="middle">' + esc(names[i]) + '</text>'; }
  return '<svg class="radar" viewBox="0 0 220 210" role="img" aria-label="能力のレーダーチャート">' + g + '<polygon class="rfill" points="' + poly + '"/>' + lab + '</svg>';
}
function bars(st, names){
  return '<dl class="bars">' + st.map((v, i) => '<div><dt>' + esc(names[i]) + '</dt><dd><span class="bar"><i class="' + gcls(v) + '" style="width:' + Math.max(2, v) + '%"></i></span><b class="' + gcls(v) + '">' + grade(v) + '</b><span class="num">' + v + '</span></dd></div>').join('') + '</dl>';
}
// 近走は馬ごとに決まった値を作る(見るたびに変わらないように)
function runs(h){
  const r = rng32(7919 * (h.id + 3)), ov = overall(h), out = [];
  const base = Date.UTC(2026, 10, 22), marg = ['ハナ', 'アタマ', 'クビ', '1/2', '1', '2', '3'];
  for (let k = 0; k < 5; k++) {
    const d = new Date(base - (k * 7 + Math.floor(r() * 4)) * 86400000);
    let pos = r() < clamp((ov - 52) / 62, 0.06, 0.6) ? 1 : 2 + Math.floor(r() * r() * 5);
    if (h.rec[1] === 0 && pos === 1) pos = 2;
    if (h.name === 'バズリタイシ' || h.name === 'サンビョウルール') pos = pos <= 2 ? 1 : 6;
    const pop = clamp(Math.round(7 - ov / 14 + (r() - 0.5) * 2), 1, 6);
    const lead = h.style === '逃げ' ? 1 : h.style === '先行' ? 2 + Math.floor(r() * 2) : h.style === '差し' ? 4 + Math.floor(r() * 2) : 6;
    out.push({date:d.toISOString().slice(0, 10).replace(/-/g, '/'), race:D.races[Math.floor(r() * D.races.length)], gate:1 + Math.floor(r() * 6), pop, pos,
      jk:h.jk[r() < 0.78 ? 0 : 1], time:(4.02 + r() * 0.4 + (pos - 1) * 0.06).toFixed(2), pass:lead + '-' + clamp(lead + (pos <= 2 ? -1 : 0) + Math.floor(r() * 2), 1, 6),
      margin:pos === 1 ? marg[Math.floor(r() * marg.length)] : marg[Math.min(6, Math.floor(r() * (pos + 2)))]});
  }
  return out;
}
const hLink = h => '<a href="#horse-' + h.id + '">' + esc(h.name) + '</a>';
const jLink = i => '<a href="#jockey-' + i + '">' + esc(D.jockeys[i].name) + '</a>';
const posCls = p => p === 1 ? 'p1' : p === 2 ? 'p2' : p === 3 ? 'p3' : '';
const newsFor = (key, id) => D.news.map((n, i) => ({n, i})).filter(x => x.n[key].includes(id));
function newsItem(x){
  return '<li><a href="#news-' + x.i + '"><span class="cat">' + esc(x.n.cat) + '</span><span class="ttl">' + esc(x.n.title) + '</span><time>' + esc(x.n.date.replace(/-/g, '/')) + '</time></a></li>';
}
const relNews = list => list.length ? '<section class="box"><h3>関連ニュース</h3><ul class="newsList">' + list.map(newsItem).join('') + '</ul></section>' : '';

/* ---------------- 各ページ ---------------- */
function pageHome(){
  const top = D.news[0];
  const best = D.horses.slice().sort((a, b) => overall(b) - overall(a)).slice(0, 4);
  const lead = D.jockeys.map((j, i) => ({j, i})).sort((a, b) => b.j.wins - a.j.wins).slice(0, 5);
  return '<div class="cols"><div class="main">' +
    '<article class="lead"><a href="#news-0"><span class="cat">' + esc(top.cat) + '</span><h2>' + esc(top.title) + '</h2><p>' + esc(top.lead) + '</p><time>' + esc(top.date.replace(/-/g, '/')) + '</time></a></article>' +
    '<section class="box"><h3>ニュース <a class="more" href="#news">一覧へ</a></h3><ul class="newsList">' + D.news.slice(1, 7).map((n, k) => newsItem({n, i:k + 1})).join('') + '</ul></section>' +
    '<section class="box"><h3>注目馬 <a class="more" href="#horses">全30頭へ</a></h3><div class="picks">' + best.map(h =>
      '<a class="pick" href="#horse-' + h.id + '">' + horseSvg(h, 96) + '<b>' + esc(h.name) + '</b><span>' + esc(h.catch) + '</span><em class="' + gcls(overall(h)) + '">総合 ' + overall(h) + '</em></a>').join('') + '</div></section>' +
    '</div><aside class="side">' +
    '<section class="box"><h3>騎手リーディング <a class="more" href="#jockeys">全員へ</a></h3><div class="scroll"><table class="tbl"><thead><tr><th>順</th><th>騎手</th><th class="r">勝利</th><th class="r">勝率</th></tr></thead><tbody>' +
      lead.map((x, k) => '<tr><td>' + (k + 1) + '</td><td>' + jLink(x.i) + '</td><td class="r">' + x.j.wins + '</td><td class="r">' + rate(x.j.wins, x.j.rides) + '</td></tr>').join('') + '</tbody></table></div></section>' +
    '<section class="box"><h3>能力値ランキング</h3>' + D.statNames.map((nm, si) => { const h = D.horses.slice().sort((a, b) => b.st[si] - a.st[si])[0]; return '<p class="kv"><span>' + esc(nm) + '</span>' + hLink(h) + '<b class="' + gcls(h.st[si]) + '">' + h.st[si] + '</b></p>'; }).join('') +
      (() => { const h = D.horses.slice().sort((a, b) => a.st[3] - b.st[3])[0]; return '<p class="kv"><span>集中力(最低)</span>' + hLink(h) + '<b class="gG">' + h.st[3] + '</b></p>'; })() + '</section>' +
    '<a class="play" href="index.html">この馬たちに賭ける<small>ゲームへ</small></a>' +
    '</aside></div>';
}
let hSort = {key:'ov', dir:-1}, hFilter = '', hQuery = '';
const kata = t => t.replace(/[ぁ-ん]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
function horseTable(){
  const cols = [['name', '馬名'], ['age', '性齢'], ['coat', '毛色'], ['style', '脚質']].concat(D.statNames.map((n, i) => ['s' + i, n])).concat([['ov', '総合'], ['win', '勝率'], ['jk', '主戦']]);
  const val = (h, k) => k === 'name' ? h.name : k === 'age' ? h.age : k === 'coat' ? h.coat : k === 'style' ? ['逃げ', '先行', '差し', '追込'].indexOf(h.style) : k === 'ov' ? overall(h) : k === 'win' ? h.rec[1] / h.rec[0] : k === 'jk' ? D.jockeys[h.jk[0]].name : h.st[Number(k.slice(1))];
  const q = hQuery.trim(), qk = kata(q);
  const list = D.horses.filter(h => (!hFilter || h.style === hFilter) && (!q || h.name.includes(qk) || D.jockeys[h.jk[0]].name.includes(q) || kata(D.jockeys[h.jk[0]].kana).includes(qk)))
    .sort((a, b) => { const x = val(a, hSort.key), y = val(b, hSort.key); return (x < y ? -1 : x > y ? 1 : a.id - b.id) * hSort.dir; });
  return '<table class="tbl horses"><thead><tr>' + cols.map(c => '<th' + (c[0] === 'name' || c[0] === 'jk' ? '' : ' class="r"') + (hSort.key === c[0] ? ' aria-sort="' + (hSort.dir < 0 ? 'descending' : 'ascending') + '"' : '') + '><button type="button" data-sort="' + c[0] + '">' + esc(c[1]) + (hSort.key === c[0] ? (hSort.dir < 0 ? ' ▼' : ' ▲') : '') + '</button></th>').join('') + '</tr></thead><tbody>' +
    (list.length ? list.map(h => '<tr><td class="nm">' + horseSvg(h, 34) + hLink(h) + '</td><td class="r">' + h.sex + h.age + '</td><td class="r">' + esc(D.coats[h.coat].name) + '</td><td class="r"><span class="style">' + h.style + '</span></td>' +
      h.st.map(v => '<td class="r ' + gcls(v) + '">' + v + '</td>').join('') + '<td class="r ov ' + gcls(overall(h)) + '">' + overall(h) + '</td><td class="r">' + rate(h.rec[1], h.rec[0]) + '</td><td>' + jLink(h.jk[0]) + '</td></tr>').join('')
      : '<tr><td colspan="' + cols.length + '">「' + esc(q) + '」に当てはまる馬はいません。条件をゆるめてみてください。</td></tr>') + '</tbody></table>';
}
function pageHorses(){
  return '<h2 class="pt">競走馬 <small>全' + D.horses.length + '頭</small></h2>' +
    '<div class="filter"><label for="q">さがす</label><input id="q" type="search" value="' + esc(hQuery) + '" placeholder="馬名・騎手名" autocomplete="off">' +
    ['', '逃げ', '先行', '差し', '追込'].map(s => '<button type="button" data-style="' + s + '" aria-pressed="' + (hFilter === s) + '">' + (s || 'すべて') + '</button>').join('') + '</div>' +
    '<div class="scroll" id="htable">' + horseTable() + '</div>' +
    '<p class="note">見出しを押すと並べ替えます。総合はスピードと瞬発力を重く、スタミナを軽く見た値です(5秒で終わるため)。</p>' +
    '<section class="box how"><h3>レースの強さの決まり方</h3><p>いちばん大きいのはその日の調子(運)です。そこに、馬の総合値と騎手の能力、騎手の得意脚質との相性、馬の特性、騎手の特殊能力が少しずつ上乗せされます。オッズはこれらから計算するので、特殊能力が「発動するかもしれない」分も織り込み済みです。実際に発動したかはレース中のカットインまでわかりません。</p></section>';
}
function pageHorse(id){
  const h = D.horses[id];
  if (!h) return pageHorses();
  const j = D.jockeys[h.jk[0]], ov = overall(h), rs = runs(h);
  const prev = D.horses[(id + D.horses.length - 1) % D.horses.length], next = D.horses[(id + 1) % D.horses.length];
  return '<nav class="crumb"><a href="#horses">競走馬</a> › ' + esc(h.name) + '</nav>' +
    '<header class="hero">' + horseSvg(h, 150) + '<div><p class="catch">' + esc(h.catch) + '</p><h2>' + esc(h.name) + '</h2><p class="sub">' + h.sex + h.age + ' / ' + esc(D.coats[h.coat].name) + ' / <span class="style">' + h.style + '</span> / 総合 <b class="' + gcls(ov) + '">' + ov + '(' + grade(ov) + ')</b></p></div></header>' +
    '<div class="cols"><div class="main">' +
    '<section class="box"><h3>紹介</h3><p class="lede">' + esc(h.text) + '</p><p class="kv"><span>好きなもの</span>' + esc(h.like) + '</p><p class="kv"><span>苦手なもの</span>' + esc(h.hate) + '</p></section>' +
    (h.trait ? '<section class="box trait"><h3>特性 <small class="more">レースの強さに効きます</small></h3><p class="skname">「' + esc(h.trait.name) + '」</p><p>' + esc(h.trait.desc) + '</p></section>' : '') +
    '<section class="box"><h3>近5走</h3><div class="scroll"><table class="tbl"><thead><tr><th>日付</th><th>レース</th><th class="r">枠</th><th class="r">人気</th><th class="r">着順</th><th>騎手</th><th class="r">タイム</th><th class="r">通過</th><th class="r">着差</th></tr></thead><tbody>' +
      rs.map(r => '<tr><td>' + r.date + '</td><td>' + esc(r.race) + '</td><td class="r">' + r.gate + '</td><td class="r">' + r.pop + '</td><td class="r"><b class="pos ' + posCls(r.pos) + '">' + r.pos + '</b></td><td>' + jLink(r.jk) + '</td><td class="r">' + r.time + '秒</td><td class="r">' + r.pass + '</td><td class="r">' + r.margin + '</td></tr>').join('') + '</tbody></table></div></section>' +
    '<section class="box"><h3>血統</h3><div class="scroll"><table class="tbl ped"><tbody><tr><th rowspan="1">父</th><td colspan="2">' + esc(h.sire) + '</td></tr><tr><th rowspan="2">母</th><td rowspan="2">' + esc(h.dam) + '</td><td><small>母の父</small>' + esc(h.bms) + '</td></tr><tr><td><small>きょうだい</small>' +
      (D.horses.filter(x => x.id !== h.id && (x.dam === h.dam)).map(hLink).join('、') || 'なし') + '</td></tr></tbody></table></div>' +
      '<p class="kv"><span>同じ父の馬</span><span>' + (D.horses.filter(x => x.id !== h.id && x.sire === h.sire).map(hLink).join('、') || 'なし') + '</span></p></section>' +
    relNews(newsFor('horses', id)) +
    '</div><aside class="side">' +
    '<section class="box"><h3>能力</h3>' + radar(h.st, D.statNames) + bars(h.st, D.statNames) + '</section>' +
    '<section class="box"><h3>プロフィール</h3><dl class="prof"><div><dt>通算成績</dt><dd>' + h.rec[0] + '戦' + h.rec[1] + '勝 ' + recText(h.rec) + '</dd></div><div><dt>勝率 / 連対率</dt><dd>' + rate(h.rec[1], h.rec[0]) + ' / ' + rate(h.rec[1] + h.rec[2], h.rec[0]) + '</dd></div>' +
      '<div><dt>主な勝ち鞍</dt><dd>' + esc(h.wins) + '</dd></div><div><dt>主戦騎手</dt><dd>' + jLink(h.jk[0]) + '(代打 ' + jLink(h.jk[1]) + ')</dd></div><div><dt>調教師</dt><dd>' + esc(h.trainer) + '</dd></div><div><dt>馬主</dt><dd>' + esc(h.owner) + '</dd></div><div><dt>生産</dt><dd>' + esc(h.farm) + '</dd></div></dl></section>' +
    '<section class="box jcard"><h3>主戦騎手</h3><a href="#jockey-' + h.jk[0] + '">' + jockeySvg(h.jk[0], 52) + '<span><b>' + esc(j.name) + '</b><em>「' + esc(j.catch) + '」</em></span></a></section>' +
    '<a class="play" href="index.html">' + esc(h.name) + 'に賭ける<small>出走するかは運しだい</small></a>' +
    '</aside></div>' +
    '<nav class="pager"><a href="#horse-' + prev.id + '">‹ ' + esc(prev.name) + '</a><a href="#horse-' + next.id + '">' + esc(next.name) + ' ›</a></nav>';
}
function pageJockeys(){
  const list = D.jockeys.map((j, i) => ({j, i})).sort((a, b) => b.j.wins - a.j.wins);
  return '<h2 class="pt">騎手 <small>全' + D.jockeys.length + '人</small></h2><div class="jgrid">' + list.map(x => { const j = x.j;
    return '<a class="jc" href="#jockey-' + x.i + '">' + jockeySvg(x.i, 60) + '<div><b>' + esc(j.name) + '</b><small>' + esc(j.kana) + ' / ' + j.age + '歳 / ' + esc(j.style) + '</small><em>「' + esc(j.catch) + '」</em>' +
      '<q>' + esc(j.lines ? j.lines.win[0] : '') + '</q><p><span>' + j.wins + '勝</span><span>勝率 ' + rate(j.wins, j.rides) + '</span><span>スクリーンタイム ' + esc(j.screen.split('(')[0]) + '</span></p></div></a>'; }).join('') + '</div>' +
    '<p class="note">スクリーンタイムは1日あたりの平均です(本人申告)。</p>';
}
function pageJockey(id){
  const j = D.jockeys[id];
  if (!j) return pageJockeys();
  const mains = D.horses.filter(h => h.jk[0] === id), subs = D.horses.filter(h => h.jk[1] === id), ov = jOverall(j);
  const row = (k, v) => '<div><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>';
  return '<nav class="crumb"><a href="#jockeys">騎手</a> › ' + esc(j.name) + '</nav>' +
    '<header class="hero">' + jockeySvg(id, 120) + '<div><p class="catch">「' + esc(j.catch) + '」</p><h2>' + esc(j.name) + '</h2><p class="sub">' + esc(j.kana) + ' / ' + j.age + '歳 / ' + esc(j.from) + ' / 得意は<span class="style">' + esc(j.style) + '</span> / 総合 <b class="' + gcls(ov) + '">' + ov + '(' + grade(ov) + ')</b></p></div></header>' +
    '<div class="cols"><div class="main">' +
    '<section class="box"><h3>紹介</h3><p class="lede">' + esc(j.text) + '</p></section>' +
    '<section class="box"><h3>人となり</h3><dl class="prof wide">' + row('趣味', j.hobby) + row('特技', j.skill) + row('好きな食べ物', j.food) + row('休日の過ごし方', j.holiday) + row('スクリーンタイム', j.screen) + row('座右の銘', j.motto) + row('最近の悩み', j.worry) + '</dl></section>' +
    (j.ability ? '<section class="box skill"><h3>特殊能力 <small class="more">ゲームでカットインが出ます</small></h3><p class="skname">「' + esc(j.ability.name) + '」</p><p>' + esc(j.ability.desc) + '</p>' +
      '<dl class="prof"><div><dt>発動率</dt><dd>' + esc(j.ability.when) + '</dd></div><div><dt>タイミング</dt><dd>' + ({start:'スタート直後', mid:'道中', late:'最後の直線'}[j.ability.timing] || '') + '</dd></div>' +
      '<div><dt>効果</dt><dd>強さ×' + j.ability.m.toFixed(1) + '(基本)。期待度の色で変わります:青×' + fx(j.ability.m, 0.4) + ' / 緑×' + fx(j.ability.m, 0.8) + ' / 赤×' + fx(j.ability.m, 1.5) + ' / 金×' + fx(j.ability.m, 2.4) + ' / 虹×' + fx(j.ability.m, 4.5) + '</dd></div></dl></section>' : '') +
    (j.lines ? '<section class="box"><h3>セリフ集 <small class="more">ゲームの吹き出しで出ます</small></h3><dl class="prof wide lines">' +
      [['pick', '賭けてもらったとき'], ['start', '発走'], ['lead', '先頭に立ったとき'], ['win', '勝ったとき'], ['second', '2着のとき'], ['lose', '負けたとき']]
        .map(k => '<div><dt>' + k[1] + '</dt><dd>' + (j.lines[k[0]] || []).map(t => '「' + esc(t) + '」').join('<br>') + '</dd></div>').join('') + '</dl></section>' : '') +
    '<section class="box"><h3>お手馬</h3><div class="scroll"><table class="tbl"><thead><tr><th>馬名</th><th class="r">性齢</th><th class="r">脚質</th><th class="r">総合</th><th>主な勝ち鞍</th><th>立場</th></tr></thead><tbody>' +
      mains.concat(subs).map(h => '<tr><td class="nm">' + horseSvg(h, 34) + hLink(h) + '</td><td class="r">' + h.sex + h.age + '</td><td class="r"><span class="style">' + h.style + '</span></td><td class="r ' + gcls(overall(h)) + '">' + overall(h) + '</td><td>' + esc(h.wins) + '</td><td>' + (h.jk[0] === id ? '主戦' : '代打') + '</td></tr>').join('') + '</tbody></table></div></section>' +
    relNews(newsFor('jockeys', id)) +
    '</div><aside class="side">' +
    '<section class="box"><h3>能力</h3>' + radar(j.st, D.jStatNames) + bars(j.st, D.jStatNames) + '</section>' +
    '<section class="box"><h3>成績</h3><dl class="prof">' + row('騎乗数', fmt(j.rides) + '回') + row('勝利数', j.wins + '勝') + row('勝率', rate(j.wins, j.rides)) + row('体格', j.body) + row('所属', j.from) + '</dl></section>' +
    '</aside></div>' +
    '<nav class="pager"><a href="#jockey-' + ((id + D.jockeys.length - 1) % D.jockeys.length) + '">‹ ' + esc(D.jockeys[(id + D.jockeys.length - 1) % D.jockeys.length].name) + '</a><a href="#jockey-' + ((id + 1) % D.jockeys.length) + '">' + esc(D.jockeys[(id + 1) % D.jockeys.length].name) + ' ›</a></nav>';
}
function pageNews(){
  return '<h2 class="pt">ニュース</h2><section class="box"><ul class="newsList big">' + D.news.map((n, i) =>
    '<li><a href="#news-' + i + '"><span class="cat">' + esc(n.cat) + '</span><span class="ttl">' + esc(n.title) + '<small>' + esc(n.lead) + '</small></span><time>' + esc(n.date.replace(/-/g, '/')) + '</time></a></li>').join('') + '</ul></section>';
}
function pageArticle(i){
  const n = D.news[i];
  if (!n) return pageNews();
  const rel = n.horses.map(id => '<a class="chipLink" href="#horse-' + id + '">' + esc(D.horses[id].name) + '</a>').concat(n.jockeys.map(id => '<a class="chipLink" href="#jockey-' + id + '">' + esc(D.jockeys[id].name) + '</a>')).join('');
  return '<nav class="crumb"><a href="#news">ニュース</a> › ' + esc(n.cat) + '</nav><article class="article"><p class="meta"><span class="cat">' + esc(n.cat) + '</span><time>' + esc(n.date.replace(/-/g, '/')) + '</time><span>読了まで約15秒</span></p>' +
    '<h2>' + esc(n.title) + '</h2><p class="lede">' + esc(n.lead) + '</p>' + n.body.map(p => '<p>' + esc(p) + '</p>').join('') +
    (rel ? '<p class="rel"><span>この記事に出てくる</span>' + rel + '</p>' : '') + '</article>' +
    '<nav class="pager">' + (D.news[i + 1] ? '<a href="#news-' + (i + 1) + '">‹ 前の記事</a>' : '<span></span>') + (i > 0 ? '<a href="#news-' + (i - 1) + '">次の記事 ›</a>' : '<span></span>') + '</nav>';
}

/* ---------------- 表示の切り替え ---------------- */
function render(){
  const h = window.location.hash.replace('#', ''), m = h.match(/^(horse|jockey|news)-(\d+)$/);
  let html, tab = 'top';
  if (m && m[1] === 'horse') { html = pageHorse(Number(m[2])); tab = 'horses'; }
  else if (m && m[1] === 'jockey') { html = pageJockey(Number(m[2])); tab = 'jockeys'; }
  else if (m && m[1] === 'news') { html = pageArticle(Number(m[2])); tab = 'news'; }
  else if (h === 'horses') { html = pageHorses(); tab = 'horses'; }
  else if (h === 'jockeys') { html = pageJockeys(); tab = 'jockeys'; }
  else if (h === 'news') { html = pageNews(); tab = 'news'; }
  else html = pageHome();
  view.innerHTML = html;
  document.querySelectorAll('.nav a[data-tab]').forEach(a => { if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  window.scrollTo(0, 0);
}
// 一覧の並べ替えと絞り込みは表だけを描き直す(入力中の文字を消さないため)
function refreshTable(){
  const box = document.getElementById('htable');
  if (box) box.innerHTML = horseTable();
  document.querySelectorAll('.filter [data-style]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.style === hFilter)));
}
view.addEventListener('click', e => {
  const s = e.target.closest('[data-sort]'), f = e.target.closest('[data-style]');
  if (s) { const k = s.dataset.sort; hSort = hSort.key === k ? {key:k, dir:-hSort.dir} : {key:k, dir:k === 'name' || k === 'jk' ? 1 : -1}; refreshTable(); const again = document.querySelector('[data-sort="' + k + '"]'); if (again) again.focus(); }
  else if (f) { hFilter = f.dataset.style; refreshTable(); }
});
view.addEventListener('input', e => { if (e.target.id === 'q') { hQuery = e.target.value; refreshTable(); } });
window.addEventListener('hashchange', render);
render();
})();
