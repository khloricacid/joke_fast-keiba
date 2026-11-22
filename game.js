/* ファスト競馬 — 5秒で決着する3D競馬。コインはゲーム内ポイントのみ。 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const fmt = n => Math.round(n).toLocaleString('ja-JP');
const setText = (el, s) => { if (el.textContent !== s) el.textContent = s; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 枠番の色(1白 2黒 3赤 4青 5黄 6緑)
const FRAME = [
  {bg:'#f7f7f2',fg:'#16130f',glow:0xffffff},{bg:'#1b1b1b',fg:'#ffffff',glow:0x9a8cff},{bg:'#e5252c',fg:'#ffffff',glow:0xff3b45},
  {bg:'#1f5fd1',fg:'#ffffff',glow:0x3d8bff},{bg:'#ffd60a',fg:'#16130f',glow:0xffd60a},{bg:'#12a150',fg:'#ffffff',glow:0x2dff8a}
];
const COATS = [
  {body:'#8a5230',dark:'#3d2210'},{body:'#4a342a',dark:'#1c1310'},{body:'#c2905c',dark:'#6e4c2b'},
  {body:'#d2cfc6',dark:'#77746c'},{body:'#6b3d24',dark:'#2f1a0f'},{body:'#a8632f',dark:'#4f2b14'}
];
const NAMES = [
  'ドパミンキング','スワイプマスター','ショートドウガ','バズリタイシ','タイパサイキョウ','ニバイソクオー',
  'スキップボタン','エンドレスリール','ツウチバクダン','ソクレスボーイ','ヨフカシテイオー','ガチャテンジョウ',
  'ジュウデンギレ','ムゲンスクロール','サンビョウルール','イッキミクイーン','ネオチスンゼン','オススメジゴク',
  'バクソクセッカチ','キドクスルー','ワンタップオー','ミッカボウズ','ヒマツブシオー','アトゴフンダケ',
  'シュウチュウゼロ','ネムクナイモン','マタアシタヤル','レンダノオニ','トバシミジョウズ','イマスグホシイ'
];
const DATA = window.FK_DATA || null;      // 馬と騎手の設定(data.js)。無くてもレースは成立する
const STAMPS = ['うおおお','草','は?','神','差せ!','そのまま!'];
const TITLES = [[1,'ドパ見習い'],[2,'ショート民'],[3,'倍速視聴者'],[5,'タイパの鬼'],[7,'スワイプ職人'],[10,'通知の申し子'],[13,'脳汁ソムリエ'],
  [16,'深夜2時の住人'],[20,'ドパミン長者'],[25,'無限スクロール師'],[30,'ファスト王'],[40,'脳汁の泉'],[50,'ドパ神'],[60,'ドパミンそのもの'],[80,'宇宙の通知']];
const ACHD = window.FK_ACH || {list:[], missions:[], unlocks:[], tiers:{}, cats:[]};
const SAFE = k => typeof k === 'string' && k.length <= 24 && k !== '__proto__' && k !== 'constructor' && k !== 'prototype';
const GRACE_MS = 5000;                  // 最初の1人が賭けてから締切までの時間
const QUICK_MS = 2000;                  // この時間内に賭けると「秒で決断」ボーナス
const KEY = 'fastkeiba.v2';
const TL = 260;                         // コースの長さ
const SL_PRE = 0.45, SL_POST = 0.07, SL_RATE = 0.3;   // ゴール前スローモーション

/* ================= レース(シード値から全員同じ結果を作る) ================= */
function rng32(seed){
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function buildRace(seed){
  const r = rng32(seed);
  const idx = NAMES.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  const hs = []; let sum = 0;
  for (let i = 0; i < 6; i++) {
    const x = r(); const w = 1 + x * x * x * 13; sum += w;
    hs.push({no:i + 1, id:idx[i], name:NAMES[idx[i]], w, coat:Math.floor(r() * COATS.length), mark:'', jk:''});
  }
  for (const h of hs) { h.p = h.w / sum; h.odds = Math.min(99.9, Math.max(1.1, Math.round(0.94 / h.p * 10) / 10)); }
  const fav = hs.slice().sort((a, b) => (b.p - a.p) || (a.no - b.no));
  ['◎','○','▲','△'].forEach((m, i) => { fav[i].mark = m; });
  fav.forEach((h, i) => { h.pop = i + 1; });
  const pool = hs.slice(), order = [];
  while (pool.length) {
    let tot = 0; for (const h of pool) tot += h.w;
    let x = r() * tot, k = 0;
    while (k < pool.length - 1 && x >= pool[k].w) { x -= pool[k].w; k++; }
    order.push(pool.splice(k, 1)[0].no);
  }
  let T = 4.0 + r() * 0.4, gap1 = 0;
  order.forEach((no, i) => {
    if (i > 0) { const g = 0.03 + r() * r() * 0.36; if (i === 1) gap1 = g; T += g; }
    hs[no - 1].T = T; hs[no - 1].rank = i + 1;
  });
  for (const h of hs) {
    const s = r(), fixed = DATA ? DATA.horses[h.id].style : '';
    // 脚質と毛色は馬ごとに決まっている。着順には影響せず、道中の位置取りだけが変わる
    h.style = fixed || (s < 0.25 ? '逃げ' : s < 0.5 ? '先行' : s < 0.78 ? '差し' : '追込');
    h.k = fixed ? {'逃げ':0.9, '先行':0.965, '差し':1.03, '追込':1.09}[fixed] + s * 0.06 : 0.9 + s * 0.25;
    if (DATA) h.coat = DATA.horses[h.id].coat;
    h.amp = 0.012 + r() * 0.02; h.fq = 1 + r() * 1.5; h.ph = r() * 6.28;
  }
  if (DATA) {                              // 騎手:主戦が空いていれば主戦、かぶったら代打
    const used = new Set();
    for (const h of hs) {
      let j = DATA.horses[h.id].jk.find(x => !used.has(x));
      if (j === undefined) j = DATA.jockeys.findIndex((_, x) => !used.has(x));
      used.add(j); h.jki = j; h.jkFull = DATA.jockeys[j].name; h.jk = DATA.jockeys[j].name.replace(' ', '');
    }
  }
  const gold = r() < 0.12;                 // ゴールデンレース:払戻2倍
  const tMid = hs[order[0] - 1].T * 0.5;   // 道中(1着の半分の時点)で最後方だった馬
  const midLast = hs.slice().sort((a, b) => prog(a, tMid) - prog(b, tMid))[0].no;
  const margin = gap1 < 0.05 ? 'ハナ差' : gap1 < 0.085 ? 'アタマ差' : gap1 < 0.13 ? 'クビ差' : gap1 < 0.2 ? '半馬身差' : gap1 < 0.29 ? '1馬身差' : '2馬身差';
  const tWin = hs[order[0] - 1].T, a = tWin - SL_PRE, slowDisp = (SL_PRE + SL_POST) / SL_RATE;
  return {seed, hs, order, margin, gold, midLast, photo:gap1 < 0.05, tWin, a, slowDisp,
    tSettle:a + SL_PRE / SL_RATE,                         // 画面上で1着がゴールする時刻
    dur:T + 0.3 + slowDisp - (SL_PRE + SL_POST)};         // 画面上のレース時間
}
// 画面の時刻 → レース内の時刻(ゴール前だけスローになる)
function warp(R, t){
  if (t < R.a) return t;
  if (t < R.a + R.slowDisp) return R.a + (t - R.a) * SL_RATE;
  return R.a + SL_PRE + SL_POST + (t - R.a - R.slowDisp);
}
function prog(h, tau){
  if (tau <= 0) return 0;
  const u = tau / h.T;
  if (u >= 1) return 1 + (h.k / h.T) * (1 - Math.exp(-(tau - h.T) * 1.2)) / 1.2;
  return Math.pow(u, h.k) + h.amp * Math.sin(Math.PI * u) * Math.sin(h.fq * 6.283 * u + h.ph);
}

/* ================= 保存する自分の状態 ================= */
const S = {coins:1000, nick:'', hue:0, bet:100, bgm:true, sfx:true, calm:false, tts:false, streak:0, best:1000, busts:0, xp:0, ach:{},
  st:{}, daily:null, login:{last:'', streak:0}, combo:0, boost:1, jp:5000, tb:{d:'', v:0}};
function clean(s){ return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁯]/g, '').slice(0, 10); }
function adopt(d){
  if (!d || typeof d !== 'object') return;
  if (Number.isFinite(d.coins) && d.coins > 0) S.coins = Math.min(1e12, Math.floor(d.coins));
  if (typeof d.nick === 'string' && clean(d.nick)) S.nick = clean(d.nick);
  if (Number.isFinite(d.hue)) S.hue = ((Math.floor(d.hue) % 360) + 360) % 360;
  if (d.bet === 'all' || d.bet === 10 || d.bet === 100 || d.bet === 500) S.bet = d.bet;
  for (const k of ['bgm', 'sfx', 'calm', 'tts']) if (typeof d[k] === 'boolean') S[k] = d[k];
  if (Number.isFinite(d.xp)) S.xp = clamp(Math.floor(d.xp), 0, 1e9);
  if (d.ach && typeof d.ach === 'object') for (const a of ACHD.list) if (d.ach[a.id]) S.ach[a.id] = true;
  if (d.st && typeof d.st === 'object') for (const k of Object.keys(d.st).slice(0, 80)) {
    if (!SAFE(k)) continue;
    const v = d.st[k];
    if (Number.isFinite(v)) S.st[k] = clamp(v, 0, 1e15);
    else if (v && typeof v === 'object') { const o = {}; for (const kk of Object.keys(v).slice(0, 64)) if (SAFE(kk) && Number.isFinite(v[kk])) o[kk] = clamp(v[kk], 0, 1e9); S.st[k] = o; }
  }
  const dl = d.daily;
  if (dl && typeof dl.d === 'string' && Array.isArray(dl.ids) && Array.isArray(dl.p) && Array.isArray(dl.c))
    S.daily = {d:dl.d.slice(0, 10), ids:dl.ids.slice(0, 3).map(String), p:dl.p.slice(0, 3).map(x => clamp(Number(x) || 0, 0, 999)), c:dl.c.slice(0, 3).map(Boolean)};
  if (d.login && typeof d.login.last === 'string' && Number.isFinite(d.login.streak)) S.login = {last:d.login.last.slice(0, 10), streak:clamp(Math.floor(d.login.streak), 0, 9999)};
  if (Number.isInteger(d.combo)) S.combo = clamp(d.combo, 0, 5);
  if (Number.isFinite(d.boost)) S.boost = clamp(d.boost, 1, 2);
  if (Number.isFinite(d.jp)) S.jp = clamp(Math.floor(d.jp), 5000, 1e9);
  if (d.tb && typeof d.tb.d === 'string' && Number.isFinite(d.tb.v)) S.tb = {d:d.tb.d.slice(0, 10), v:clamp(Math.floor(d.tb.v), 0, 1e12)};
  if (Number.isFinite(d.streak)) S.streak = Math.max(0, Math.floor(d.streak));
  if (Number.isFinite(d.best)) S.best = Math.max(S.coins, Math.floor(d.best));
  if (Number.isFinite(d.busts)) S.busts = Math.max(0, Math.floor(d.busts));
}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const streakMult = s => s >= 2 ? 1.5 : s === 1 ? 1.2 : 1;
const xpNeed = l => 60 * l * (l + 1) / 2;                 // レベル l+1 になるのに必要な累計
function lvOf(xp){ let l = 1; while (l < 99 && xp >= xpNeed(l)) l++; return l; }
const titleOf = l => TITLES.filter(t => t[0] <= l).pop()[1];
const unlocked = lv => lvOf(S.xp) >= lv;
const calm = () => reduced || S.calm;

/* ================= ゲーム進行 ================= */
const PID = Array.from({length:12}, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
const me = {pick:null, sit:false, missed:0, away:document.hidden, g:null, emo:null, win:null};
const V = {n:0, seed:-1, ph:'idle', race:null, betStart:0, firstPick:0, raceStart:0, settled:false, settledAt:0, late:false, locked:null, res:null,
  lead:0, slow:false, stretch:false, myRank:0, quick:false, calloutAt:0, payAnim:null, omen:false, chance:false, deadline:false, leadSince:0, comboHit:false};
let lastPs = [], lastRoomCheck = 0, sessRun = 0, saySeq = 0;
let lastG = null, hostPhaseAt = 0, hostFirstPick = 0, dirty = false, lastSent = 0;
let net = null, roomCode = 'lobby', netOpts = null;
const others = new Map(), linkPid = new Map(), seenPeers = new Set(), emoSeen = new Map(), winSeen = new Map();

const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
const vG = g => (g && typeof g === 'object' && isInt(g.n, 1, 1e9) && isInt(g.seed, 0, 4294967295) && (g.ph === 'bet' || g.ph === 'run') && Number.isFinite(g.hs)) ? {n:g.n, seed:g.seed, ph:g.ph, hs:g.hs} : null;
const vPick = p => (p && typeof p === 'object' && isInt(p.n, 1, 1e9) && isInt(p.s, 0, 4294967295) && isInt(p.h, 1, 6) && isInt(p.bet, 1, 1e12)) ? {n:p.n, s:p.s, h:p.h, bet:p.bet} : null;
const vEmo = e => (e && typeof e === 'object' && isInt(e.k, 0, STAMPS.length - 1) && Number.isFinite(e.t)) ? {k:e.k, t:e.t} : null;
const vWin = w => (w && typeof w === 'object' && Number.isFinite(w.t) && isInt(w.pay, 1, 1e12) && isInt(w.tier, 1, 4)) ? {t:w.t, pay:w.pay, tier:w.tier} : null;
const newSeed = () => (Math.random() * 4294967296) >>> 0;

function myState(){
  return {pid:PID, fk:4, nick:S.nick, hue:S.hue, coins:S.coins, streak:S.streak, lv:lvOf(S.xp), tb:todayBest(),
    pick:me.pick, sit:me.sit, away:me.away, g:me.g, emo:me.emo, win:me.win};
}
function pushPresence(){
  dirty = false; lastSent = performance.now();
  if (net) { try { net.send(myState()); } catch (e) {} }
}
function players(now){
  const out = [{peer:PID, isMe:true, nick:S.nick, hue:S.hue, coins:S.coins, streak:S.streak, lv:lvOf(S.xp), tb:todayBest(),
    pick:me.pick, sit:me.sit, away:me.away, g:me.g, emo:me.emo, win:me.win}];
  for (const [pid, o] of others) {
    if (now - o.seen > 7000) { others.delete(pid); continue; }
    const s = o.st;
    if (!s || s.fk !== 4) continue;
    out.push({peer:pid, isMe:false, nick:clean(s.nick) || 'ななし',
      hue:Number.isFinite(s.hue) ? ((Math.floor(s.hue) % 360) + 360) % 360 : 0,
      coins:Number.isFinite(s.coins) ? clamp(Math.floor(s.coins), 0, 1e12) : 0,
      streak:isInt(s.streak, 0, 1e6) ? s.streak : 0, lv:isInt(s.lv, 1, 99) ? s.lv : 1, tb:isInt(s.tb, 0, 1e12) ? s.tb : 0,
      pick:vPick(s.pick), sit:!!s.sit, away:!!s.away, g:vG(s.g), emo:vEmo(s.emo), win:vWin(s.win)});
  }
  return out;
}
function netOpen(){
  if (net || !window.FKNet) return;
  try {
    net = window.FKNet.join(roomCode, {
      onState(d, link){
        if (!d || typeof d !== 'object' || typeof d.pid !== 'string' || d.pid.length > 24 || d.pid === PID) return;
        let o = others.get(d.pid);
        if (!o) { o = {st:null, seen:0}; others.set(d.pid, o); }
        o.st = d; o.seen = performance.now();
        linkPid.set(link, d.pid);
      },
      onJoin(){ dirty = true; },
      onLeave(link){
        const pid = linkPid.get(link); linkPid.delete(link);
        if (pid && !Array.from(linkPid.values()).includes(pid)) others.delete(pid);
      },
      onError(){}
    }, netOpts);
    pushPresence();
  } catch (e) { net = null; }
}

/* 進行役:いちばん長く進行している人。だれもいなければIDの小さい順 */
function elect(ps){
  const c = ps.filter(p => !p.away);
  if (!c.length) return null;
  const cmp = (a, b) => a.peer < b.peer ? -1 : a.peer > b.peer ? 1 : 0;
  const withG = c.filter(p => p.g);
  if (withG.length) return withG.sort((a, b) => (a.g.hs - b.g.hs) || cmp(a, b))[0];
  return c.sort(cmp)[0];
}
function drive(ps, now){
  if (!me.g) {
    me.g = lastG ? {n:lastG.n, seed:lastG.seed, ph:lastG.ph, hs:Date.now()} : {n:1, seed:newSeed(), ph:'bet', hs:Date.now()};
    hostPhaseAt = now; dirty = true;
  }
  const g = me.g, el = now - hostPhaseAt;
  const visible = ps.filter(p => !p.away);
  if (g.ph === 'bet') {
    const has = p => !!(p.pick && p.pick.n === g.n && p.pick.s === g.seed);
    const picked = visible.filter(has);
    if (!picked.length) hostFirstPick = 0; else if (!hostFirstPick) hostFirstPick = now;
    const allIn = visible.filter(p => !p.sit).every(has);
    const minWait = visible.length > 1 ? 1500 : 0;
    // 全員が賭けたら即発走。そうでなければ最初の1人から GRACE_MS 後に締め切る
    if (picked.length && ((allIn && el >= minWait) || now - hostFirstPick >= GRACE_MS)) {
      me.g = {n:g.n, seed:g.seed, ph:'run', hs:g.hs}; hostPhaseAt = now; dirty = true;
    }
  } else {
    const dur = (V.race && V.seed === g.seed ? V.race.dur : 6.5) * 1000;
    if (el >= dur + (visible.length > 1 ? 3200 : 2700)) {
      me.g = {n:g.n + 1, seed:newSeed(), ph:'bet', hs:g.hs}; hostPhaseAt = now; dirty = true;
    }
  }
}
function observe(g, now){
  lastG = g;
  if (g.n !== V.n || g.seed !== V.seed) {
    if (V.ph === 'run' && !V.settled) settle(true);
    V.n = g.n; V.seed = g.seed; V.race = buildRace(g.seed);
    V.ph = 'bet'; V.betStart = now; V.firstPick = 0; V.settled = false; V.locked = null; V.late = false; V.res = null;
    V.lead = 0; V.slow = false; V.stretch = false; V.myRank = 0; V.quick = false; V.payAnim = null;
    V.omen = false; V.chance = false; V.deadline = false; V.leadSince = 0; V.comboHit = false; A.lead = false;
    if (A.ctx && S.bgm) A.music.gain.setTargetAtTime(0.55, A.ctx.currentTime, 0.05);
    if (me.pick && !(me.pick.n === g.n && me.pick.s === g.seed)) { me.pick = null; dirty = true; }
    if (g.ph === 'run') { V.ph = 'run'; V.late = true; V.settled = true; }
    renderRound();
    audioMode(0);
  }
  if (g.ph === 'run' && V.ph === 'bet') startRace(now);
}
function startRace(now){
  V.ph = 'run'; V.raceStart = now;
  const R = V.race;
  if (me.pick) {
    const bet = Math.min(me.pick.bet, S.coins);
    if (bet > 0) {
      const sm = streakMult(S.streak), qm = V.quick ? 1.1 : 1, gm = R.gold ? 2 : 1, bm = S.boost || 1;
      let cm = 1;
      // コンボ:満タンで迎えたレースは払戻×1.3。続けて賭けるとたまり、見送るとゼロに戻る
      if (S.combo >= 5) { cm = 1.3; S.combo = 0; V.comboHit = true; } else S.combo++;
      S.boost = 1;
      V.locked = {h:me.pick.h, bet, odds:R.hs[me.pick.h - 1].odds, mult:Math.round(sm * qm * gm * cm * bm * 100) / 100, quick:V.quick, all:bet >= S.coins, deadline:V.deadline};
      S.coins -= bet;
      if (V.quick) inc('quick');
      addXp(10);
      if (S.combo === 5) { inc('combos'); setTimeout(() => { callout('COMBO MAX! 次は×1.3', 'lead'); sLevel(); buzz([20, 20, 20, 20, 60]); checkAch({type:'combo'}); }, 900); }
      // 確定演出は当たるレースでだけ出る。「チャンス!」は外れでもときどき出る
      const win = R.order[0] === me.pick.h, big = R.hs[me.pick.h - 1].odds >= 10;
      V.omen = win && Math.random() < (big ? 0.45 : 0.2);
      V.chance = !V.omen && Math.random() < (win ? 0.3 : 0.08);
      sessRun++; S.st.playRun = Math.max(S.st.playRun || 0, sessRun);
    }
    me.missed = 0;
  } else {
    me.missed++; S.combo = 0; sessRun = 0;
    if (me.missed >= 2 && !me.sit) me.sit = true;
  }
  save();
  dirty = true;
  castSay('スタートしました!', true);
  kick3D(1);
  flash('');
  ring(0.5, 0.5, '#ffffff');
  if (V.locked) { cutIn(V.locked); setTimeout(() => jockeySay(V.locked && V.locked.h, 'start', 1600), 900); }
  sGate(); sWhoosh();
  buzz([30, 30, 70]);
  audioMode(1);
}
function settle(forced){
  V.settled = true; V.settledAt = performance.now();
  const R = V.race, win = R.order[0];
  let res = null;
  if (V.locked) {
    const L = V.locked, h = R.hs[L.h - 1], st = S.st, before = S.coins + L.bet, room = roomInfo(win);
    const hr = new Date().getHours();
    const ev = {type:'settle', win:L.h === win, odds:L.odds, bet:L.bet, all:L.all, quick:L.quick, deadline:L.deadline, horse:h.name, jockey:h.jkFull || '',
      style:h.style, gate:L.h, pop:h.pop, rank:h.rank, photo:R.photo, gold:R.gold, fromLast:R.midLast === win, night:hr >= 2 && hr < 4, calm:calm(),
      roomN:room.n, roomWinners:room.winners, roomSame:room.same, pay:0, tier:0, bust:false, streak:0};
    inc('races');
    if (ev.win) {
      const pay = Math.floor(L.bet * L.odds * L.mult), m = pay / L.bet;
      const tier = m >= 30 ? 4 : m >= 10 ? 3 : m >= 5 ? 2 : 1;
      S.coins = Math.min(1e12, S.coins + pay); S.streak++;
      ev.pay = pay; ev.tier = tier; ev.streak = S.streak;
      res = {type:'win', pay, odds:L.odds, mult:L.mult, tier, combo:V.comboHit, h:L.h};
      inc('wins'); inc('totalPay', pay); st.bestPay = Math.max(st.bestPay || 0, pay); st.maxStreak = Math.max(st.maxStreak || 0, S.streak); st.loseStreak = 0;
      incMap('gates', String(L.h)); incMap('styles', h.style); incMap('byHorse', String(h.id)); if (h.jkFull) incMap('byJockey', h.jkFull);
      st.favStreak = h.pop === 1 ? (st.favStreak || 0) + 1 : 0;
      st.allinStreak = L.all ? (st.allinStreak || 0) + 1 : 0;
      if (L.bet <= 10) inc('tinyWins');
      if (R.photo) inc('photoWins');
      if (R.gold) inc('goldWins');
      if (V.omen) inc('omens');
      addXp(20 + Math.min(120, Math.round(L.odds * 6)));
      // ジャックポット:万馬券級(払戻30倍以上)で必ず、それ以外の的中でもまれに
      if (tier >= 4 || Math.random() < 1 / 150) { res.jp = S.jp; S.coins = Math.min(1e12, S.coins + S.jp); inc('jackpots'); S.jp = 5000; }
      const t = today();
      if (S.tb.d !== t) S.tb = {d:t, v:0};
      S.tb.v = Math.max(S.tb.v, pay + (res.jp || 0));
      me.win = {t:Date.now(), pay:pay + (res.jp || 0), tier};
      if (st.bustFlag && S.coins >= 10000) { inc('comebacks'); st.bustFlag = 0; }
    } else {
      S.streak = 0; st.loseStreak = (st.loseStreak || 0) + 1; st.maxLose = Math.max(st.maxLose || 0, st.loseStreak); st.favStreak = 0; st.allinStreak = 0;
      if (h.rank === 2) { inc('seconds'); addXp(5); }
      S.jp = Math.min(1e9, S.jp + Math.ceil(L.bet * 0.2));
      res = {type:'lose', bet:L.bet, rank:h.rank, h:L.h};
      if (S.coins <= 0) { S.coins = 1000; S.busts++; res.bust = true; ev.bust = true; st.bustFlag = 1; }
      else if (!forced && Math.random() < 0.4) res.lucky = rollLucky(L.bet);
    }
    res.cross = [1e4, 1e5, 1e6, 1e7, 1e8].filter(x => before < x && S.coins >= x).pop() || 0;
    S.best = Math.max(S.best, S.coins);
    missionProgress(ev);
    checkAch(ev);
    save();
  }
  V.res = res;
  renderBoard();
  if (!forced) celebrate(res);
  pushPresence();
}
// レース確定時の部屋のようす(実績の判定用)
function roomInfo(win){
  const here = lastPs.filter(p => !p.away);
  const picks = here.filter(p => p.pick && p.pick.n === V.n && p.pick.s === V.seed);
  return {n:here.length, winners:picks.filter(p => p.pick.h === win).length,
    same:picks.length >= 2 && picks.length === here.length && picks.every(p => p.pick.h === picks[0].pick.h)};
}
function tick(){
  const now = performance.now();
  netOpen();
  const ps = players(now);
  lastPs = ps;
  const host = elect(ps);
  if (host && host.isMe) drive(ps, now);
  else if (me.g) { me.g = null; dirty = true; }
  const g = host ? (host.isMe ? me.g : host.g) : null;
  if (g) observe(g, now);
  for (const p of ps) {
    if (p.isMe) continue;
    const t = p.emo ? p.emo.t : undefined, w = p.win ? p.win.t : undefined;
    if (!seenPeers.has(p.peer)) { seenPeers.add(p.peer); toast(p.nick + ' が入場', 'join'); }
    else {
      if (p.emo && emoSeen.get(p.peer) !== t) shout(STAMPS[p.emo.k], p.hue);
      if (p.win && winSeen.get(p.peer) !== w) {
        toast(p.nick + (p.win.tier >= 3 ? ' が大穴的中 +' : ' が的中 +') + fmt(p.win.pay), 'win');
        if (!calm()) firework(0.2 + Math.random() * 0.6, 0.2 + Math.random() * 0.15, p.hue, 40 + p.win.tier * 20);
      }
    }
    emoSeen.set(p.peer, t); winSeen.set(p.peer, w);
  }
  if (dirty || now - lastSent > 1800) pushPresence();
  if (ps.length >= 2 && now - lastRoomCheck > 2000) {
    lastRoomCheck = now;
    checkAch({type:'room', n:ps.filter(p => !p.away).length, top:ps.every(p => p.isMe || p.coins < S.coins)});
  }
  ui(ps, now);
}

/* ================= 経験値・称号・実績・ミッション ================= */
const inc = (k, v) => { S.st[k] = (S.st[k] || 0) + (v === undefined ? 1 : v); };
const incMap = (k, kk) => { if (!SAFE(kk)) return; const o = S.st[k] && typeof S.st[k] === 'object' ? S.st[k] : (S.st[k] = {}); o[kk] = (o[kk] || 0) + 1; };
const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const today = () => ymd(new Date());
const yesterday = () => ymd(new Date(Date.now() - 86400000));
const todayBest = () => S.tb && S.tb.d === today() ? S.tb.v : 0;
function addXp(n){
  const before = lvOf(S.xp);
  S.xp += n;
  const after = lvOf(S.xp);
  if (after > before) {
    const bonus = after * 200;
    S.coins = Math.min(1e12, S.coins + bonus);
    toast('レベルアップ! Lv.' + after + ' ' + titleOf(after) + ' +' + fmt(bonus) + 'コイン', 'level');
    for (const u of ACHD.unlocks) if (u.lv > before && u.lv <= after) setTimeout(() => toast('解放:' + u.name, 'level'), 1200);
    setTimeout(() => { sLevel(); buzz([30, 30, 30, 30, 120]); if (!calm()) { firework(0.5, 0.25, 50, 90); starBurst(0.5, 0.12, 20, 50); } }, 900);
    checkAch({type:'level'});
  }
  save();
}
// 実績の判定。新しく取れたものは少しずつ間をあけて知らせる
const achQueue = [];
let achTimer = 0;
function checkAch(ev){
  const c = {st:S.st, S, ev:ev || {type:'none'}, lv:lvOf(S.xp)};
  let got = false;
  for (const a of ACHD.list) {
    if (S.ach[a.id]) continue;
    let ok = false;
    try { ok = !!a.test(c); } catch (e) { ok = false; }
    if (ok) { S.ach[a.id] = true; achQueue.push(a); got = true; }
  }
  if (got) { save(); if (!achTimer) achTimer = setTimeout(flushAch, 1500); }
}
function flushAch(){
  achTimer = 0;
  const a = achQueue.shift();
  if (!a) return;
  const tier = a.hidden ? '隠し' : ACHD.tiers[a.tier] || '';
  toast('実績解除【' + tier + '】' + a.name, a.tier === 'g' || a.hidden ? 'gold' : 'ach');
  if ((a.tier === 'g' || a.hidden) && !calm()) { starBurst(0.2, 0.25, 18, 50); sLevel(); }
  if (achQueue.length) achTimer = setTimeout(flushAch, 1000);
}
function ensureDaily(){
  const d = today();
  if (S.daily && S.daily.d === d && S.daily.ids.length === 3) return;
  const r = rng32(Number(d.replace(/-/g, '')) * 2654435761);
  const pool = ACHD.missions.slice(), ids = [];
  while (ids.length < 3 && pool.length) ids.push(pool.splice(Math.floor(r() * pool.length), 1)[0].id);
  S.daily = {d, ids, p:[0, 0, 0], c:[false, false, false]};
  save();
}
function missionProgress(ev){
  ensureDaily();
  S.daily.ids.forEach((id, i) => {
    const m = ACHD.missions.find(x => x.id === id);
    if (!m || S.daily.p[i] >= m.goal) return;
    let add = 0;
    try { add = m.on(ev) || 0; } catch (e) { add = 0; }
    if (!add) return;
    S.daily.p[i] = Math.min(m.goal, S.daily.p[i] + add);
    if (S.daily.p[i] >= m.goal) setTimeout(() => { toast('ミッション達成:' + m.text + '。「実績」から宝箱を開けよう', 'gold'); sLevel(); }, 1900);
  });
}
function missionReady(){
  if (!S.daily) return false;
  return S.daily.ids.some((id, i) => { const m = ACHD.missions.find(x => x.id === id); return m && S.daily.p[i] >= m.goal && !S.daily.c[i]; });
}
function claimMission(i){
  ensureDaily();
  const m = ACHD.missions.find(x => x.id === S.daily.ids[i]);
  if (!m || S.daily.p[i] < m.goal || S.daily.c[i]) return null;
  S.daily.c[i] = true;
  const x = Math.random();
  const prize = x < 0.05 ? {v:5000, label:'超大当たり'} : x < 0.3 ? {v:1500, label:'大当たり'} : {v:500, label:'当たり'};
  S.coins = Math.min(1e12, S.coins + prize.v);
  inc('dailyDone');
  addXp(50);
  checkAch({type:'daily'});
  save();
  return prize;
}
function loginBonus(){
  const d = today();
  if (S.login.last === d) return;
  S.login.streak = S.login.last === yesterday() ? S.login.streak + 1 : 1;
  S.login.last = d;
  S.st.loginBest = Math.max(S.st.loginBest || 0, S.login.streak);
  const day = S.login.streak, bonus = 200 * Math.min(day, 7) + (day % 7 === 0 ? 2000 : 0);
  S.coins = Math.min(1e12, S.coins + bonus);
  save();
  setText($('bonusDay'), day + '日連続ログイン');
  $('bonusWeek').replaceChildren(...Array.from({length:7}, (_, k) => {
    const li = document.createElement('li'), cyc = ((day - 1) % 7) + 1;
    li.textContent = (k + 1) + '日目'; const b = document.createElement('b'); b.textContent = '+' + fmt(200 * (k + 1) + (k === 6 ? 2000 : 0)); li.appendChild(b);
    if (k + 1 < cyc) li.className = 'done'; else if (k + 1 === cyc) li.className = 'now';
    return li;
  }));
  setText($('bonusVal'), '+' + fmt(bonus) + 'コイン');
  openModal('bonus', () => { coinFly(18); sLevel(); checkAch({type:'boot'}); });
}
// 救済くじ:ハズレのあと、ときどき引ける
function rollLucky(bet){
  const x = Math.random();
  if (x < 0.02) return {sym:['7', '7', '7'], kind:'big', v:bet * 3, text:'大当たり! 賭け金の3倍 +' + fmt(bet * 3)};
  if (x < 0.08) return {sym:['◎', '◎', '◎'], kind:'boost', text:'次のレースの払戻×1.5'};
  if (x < 0.2) return {sym:['♪', '♪', '♪'], kind:'xp', text:'経験値 +40'};
  if (x < 0.45) { const v = Math.max(1, Math.round(bet * 0.2)); return {sym:['★', '★', '★'], kind:'coin', v, text:'賭け金の2割が戻る +' + fmt(v)}; }
  const near = Math.random() < 0.5;
  return {sym:near ? ['7', '7', '×'] : ['★', '◎', '♪'], kind:'miss', text:near ? 'リーチ…! おしい' : 'スカ'};
}

/* ================= 操作 ================= */
function stakeNow(){ return S.bet === 'all' ? S.coins : Math.min(S.bet, S.coins); }
function myHorseNo(){
  if (V.locked) return V.locked.h;
  return me.pick && me.pick.n === V.n && me.pick.s === V.seed ? me.pick.h : 0;
}
function pick(no){
  audioUnlock();
  if (V.ph !== 'bet' || V.late || !isInt(no, 1, 6)) return;
  const bet = stakeNow();
  if (bet <= 0) return;
  const first = !me.pick;
  me.pick = {n:V.n, s:V.seed, h:no, bet};
  me.sit = false; me.missed = 0;
  if (first) V.quick = performance.now() - V.betStart <= QUICK_MS;
  const multi = lastPs.filter(p => !p.away).length > 1;
  V.deadline = multi && V.firstPick > 0 && GRACE_MS - (performance.now() - V.firstPick) < 1000;
  jockeySay(no, 'pick', 1700);
  const el = umaEls[no - 1];
  if (el) {
    el.classList.remove('slam'); void el.offsetWidth; el.classList.add('slam');
    const r = el.getBoundingClientRect();
    if (!calm()) starBurst((r.left + r.width / 2) / window.innerWidth, (r.top + r.height * 0.3) / window.innerHeight, 12, S.bet === 'all' ? 0 : 50);
  }
  if (first && V.quick) callout('秒で決断 ×1.1', 'up');
  sPick(S.bet === 'all');
  buzz(12);
  pushPresence();
  tick();
}
function setBet(b){
  audioUnlock();
  S.bet = b; save();
  if (me.pick && V.ph === 'bet') { me.pick = {n:me.pick.n, s:me.pick.s, h:me.pick.h, bet:Math.max(1, stakeNow())}; pushPresence(); }
  if (b === 'all') { sAllIn(); buzz([20, 20, 20]); } else sClick();
  tick();
}
function stamp(k){
  audioUnlock();
  const e = {k, t:Date.now()};
  me.emo = e;
  shout(STAMPS[k], S.hue);
  sClick();
  inc('stamps'); missionProgress({type:'stamp'}); checkAch({type:'stamp'}); save();
  pushPresence();
  setTimeout(() => { if (me.emo === e) { me.emo = null; pushPresence(); } }, 3000);
}
function buzz(p){ if (calm()) return; try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

/* ================= 音(BGMも効果音もその場で合成) ================= */
const A = {ctx:null, master:null, music:null, mfilt:null, sfx:null, crowd:null, noise:null, step:0, nextT:0, mode:0, gallopAt:0, heartAt:0, beats:[], fever:false, lead:false};
const BPM = 168;
const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];           // Am F C G
const MEL = [
  [76,0,76,79, 0,81,0,79, 76,0,74,0, 76,0,0,0],
  [77,0,77,81, 0,84,0,81, 77,0,76,0, 77,0,0,0],
  [79,0,79,84, 0,88,0,84, 79,0,76,0, 79,0,0,0],
  [74,0,79,83, 0,86,0,83, 79,0,81,0, 83,0,86,0]
];
const LOBBY = [[69,0,0,72, 0,0,76,0], [69,0,0,72, 0,0,77,0], [67,0,0,72, 0,0,76,0], [67,0,0,71, 0,0,74,0]];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const stepLen = () => 60 / (BPM * (A.fever ? 1.07 : 1)) / 4;       // フィーバー中は少し速く
function audioUnlock(){
  if (!A.ctx) {
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      const ctx = new C();
      A.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      A.master = ctx.createGain(); A.master.gain.value = 0.9;
      A.master.connect(comp); comp.connect(ctx.destination);
      A.mfilt = ctx.createBiquadFilter(); A.mfilt.type = 'lowpass'; A.mfilt.frequency.value = 2600; A.mfilt.Q.value = 0.6;
      A.music = ctx.createGain(); A.music.gain.value = S.bgm ? 0.55 : 0;
      A.music.connect(A.mfilt); A.mfilt.connect(A.master);
      A.sfx = ctx.createGain(); A.sfx.gain.value = S.sfx ? 0.9 : 0;
      A.sfx.connect(A.master);
      const len = ctx.sampleRate, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      A.noise = buf;
      // 歓声:ノイズを帯域フィルタに通して鳴らしっぱなしにし、音量だけ動かす
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 850; bp.Q.value = 0.45;
      A.crowd = ctx.createGain(); A.crowd.gain.value = 0.012;
      src.connect(bp); bp.connect(A.crowd); A.crowd.connect(A.sfx); src.start();
      A.nextT = ctx.currentTime + 0.08;
      setInterval(sequencer, 40);
      audioMode(V.ph === 'run' && !V.settled ? 1 : 0);
    } catch (e) { A.ctx = null; }
  }
  if (A.ctx && A.ctx.state === 'suspended') { try { A.ctx.resume().catch(() => {}); } catch (e) {} }
}
function tone(dest, type, f, t, dur, vol, slide){
  const ctx = A.ctx, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.03);
}
function hiss(dest, t, dur, vol, type, freq, q, sweep){
  const ctx = A.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = A.noise; s.loop = true;
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q || 0.7;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.03);
}
function sequencer(){
  const ctx = A.ctx;
  if (!ctx || ctx.state !== 'running') return;
  if (A.nextT < ctx.currentTime) A.nextT = ctx.currentTime + 0.05;
  while (A.nextT < ctx.currentTime + 0.16) {
    if (A.step % 4 === 0 && A.beats.length < 16) A.beats.push(A.nextT);
    if (S.bgm && !document.hidden) musicStep(A.step, A.nextT);
    A.step++; A.nextT += stepLen();
  }
}
function musicStep(i, t){
  const bar = Math.floor(i / 16) % 4, s = i % 16, ch = CH[bar], hi = A.mode === 1, m = A.music, tr = (A.fever ? 2 : 0) + (A.lead ? 2 : 0), ST = stepLen();
  if (hi ? s % 4 === 0 : (s === 0 || s === 10)) tone(m, 'sine', 150, t, 0.16, hi ? 0.95 : 0.6, 42);            // キック
  if (hi && (s === 4 || s === 12)) { hiss(m, t, 0.13, 0.42, 'bandpass', 1900, 0.8); tone(m, 'triangle', 190, t, 0.08, 0.25, 120); }   // スネア
  if (hi || s % 2 === 0) hiss(m, t, s % 4 === 2 ? 0.07 : 0.03, (s % 4 === 2 ? 0.2 : 0.11) * (hi ? 1 : 0.7), 'highpass', 7500, 0.7);       // ハット
  if (s % 2 === 0) tone(m, hi ? 'sawtooth' : 'triangle', mtof(ch[0] + tr - 24 + (s % 4 === 2 ? 12 : 0)), t, ST * 1.8, hi ? 0.2 : 0.3);       // ベース
  tone(m, hi ? 'square' : 'triangle', mtof(ch[[0, 1, 2, 1][s % 4]] + tr + 12 + (hi && s % 8 >= 4 ? 12 : 0)), t, ST * 0.9, hi ? 0.05 : 0.07); // アルペジオ
  if (A.fever) tone(m, 'sine', mtof(ch[[2, 0, 1, 2][s % 4]] + tr + 36), t, ST * 0.6, 0.03);                      // フィーバー中のきらきら
  if (hi) { const n = MEL[bar][s]; if (n) tone(m, 'sawtooth', mtof(n + tr), t, ST * 1.9, 0.085); }
  else if (s % 2 === 0) { const n = LOBBY[bar][s / 2]; if (n) tone(m, 'sine', mtof(n + tr), t, ST * 3.5, 0.1); }
}
function audioMode(mode){
  A.mode = mode;
  const ctx = A.ctx; if (!ctx) return;
  const t = ctx.currentTime;
  A.mfilt.frequency.cancelScheduledValues(t);
  A.mfilt.frequency.setTargetAtTime(mode === 1 ? 15000 : 2600, t, 0.05);
  A.crowd.gain.cancelScheduledValues(t);
  A.crowd.gain.setTargetAtTime(mode === 1 ? 0.04 : 0.012, t, 0.3);
  if (mode === 1) hiss(A.music, t, 1.2, 0.3, 'highpass', 5000, 0.5);     // クラッシュ
}
const sfxOK = () => A.ctx && A.ctx.state === 'running' && S.sfx;
function sClick(){ if (sfxOK()) tone(A.sfx, 'square', 700, A.ctx.currentTime, 0.04, 0.08); }
function sPick(all){ if (sfxOK()) { const t = A.ctx.currentTime; tone(A.sfx, 'square', 880, t, 0.06, 0.1); tone(A.sfx, 'square', 1320, t + 0.06, 0.09, 0.1); if (all) tone(A.sfx, 'sawtooth', 110, t, 0.35, 0.2, 55); } }
function sAllIn(){ if (sfxOK()) { const t = A.ctx.currentTime; tone(A.sfx, 'sawtooth', 90, t, 0.4, 0.22, 180); hiss(A.sfx, t, 0.4, 0.2, 'bandpass', 300, 1, 2400); } }
function sGate(){ if (sfxOK()) { const t = A.ctx.currentTime; hiss(A.sfx, t, 0.22, 0.7, 'bandpass', 2400, 1.2); tone(A.sfx, 'sine', 120, t, 0.3, 0.8, 38); } }
function sWhoosh(){ if (sfxOK()) hiss(A.sfx, A.ctx.currentTime, 0.28, 0.22, 'bandpass', 500, 1.4, 5200); }
function sCoin(){ if (sfxOK()) tone(A.sfx, 'sine', 1700 + Math.random() * 900, A.ctx.currentTime, 0.07, 0.07); }
function sTick(k){ if (sfxOK()) tone(A.sfx, 'square', 900 + k * 900, A.ctx.currentTime, 0.03, 0.045); }
function sRank(up){ if (sfxOK()) { const t = A.ctx.currentTime; tone(A.sfx, 'triangle', up ? 660 : 440, t, 0.07, 0.16, up ? 990 : 330); } }
function cheer(v){ if (A.ctx && A.ctx.state === 'running') { const t = A.ctx.currentTime; A.crowd.gain.cancelScheduledValues(t); A.crowd.gain.setValueAtTime(v, t); A.crowd.gain.setTargetAtTime(0.04, t + 0.25, 0.4); } }
function sLead(){ if (sfxOK()) { const t = A.ctx.currentTime; [79, 84, 91].forEach((n, i) => tone(A.sfx, 'square', mtof(n), t + i * 0.05, 0.12, 0.1)); cheer(0.22); } }
function sRoll(){ if (sfxOK()) { const t = A.ctx.currentTime; for (let i = 0; i < 18; i++) hiss(A.sfx, t + i * 0.082, 0.06, 0.08 + i * 0.022, 'bandpass', 1700, 0.9); } }
function sToast(){ if (sfxOK()) { const t = A.ctx.currentTime; tone(A.sfx, 'triangle', 1175, t, 0.08, 0.1); tone(A.sfx, 'triangle', 1568, t + 0.08, 0.14, 0.1); } }
function sLevel(){ if (sfxOK()) { const t = A.ctx.currentTime; [60, 64, 67, 72, 76, 79, 84, 88].forEach((n, i) => { tone(A.sfx, 'square', mtof(n), t + i * 0.055, 0.14, 0.09); tone(A.sfx, 'triangle', mtof(n + 12), t + i * 0.055, 0.14, 0.07); }); } }
function sHorn(){ if (sfxOK()) { const t = A.ctx.currentTime; [0, 0.22, 0.44].forEach((d, k) => [69, 73, 76].forEach(n => { tone(A.sfx, 'sawtooth', mtof(n), t + d, k === 2 ? 0.7 : 0.16, 0.07); tone(A.sfx, 'sawtooth', mtof(n) * 1.008, t + d, k === 2 ? 0.7 : 0.16, 0.06); })); } }
function sGoal(){ if (sfxOK()) { const t = A.ctx.currentTime; hiss(A.sfx, t, 0.9, 0.5, 'highpass', 3000, 0.5); tone(A.sfx, 'sine', 90, t, 0.5, 0.9, 30); hiss(A.sfx, t, 0.03, 0.5, 'highpass', 6000, 1); hiss(A.sfx, t + 0.07, 0.03, 0.4, 'highpass', 6000, 1); } }
function sWin(tier){
  if (!sfxOK()) return;
  const t = A.ctx.currentTime;
  [72, 76, 79, 84, 88].forEach((n, i) => { tone(A.sfx, 'square', mtof(n), t + i * 0.07, 0.16, 0.11); tone(A.sfx, 'triangle', mtof(n - 12), t + i * 0.07, 0.2, 0.14); });
  if (tier >= 2) [84, 88, 91, 96, 100, 103].forEach((n, i) => tone(A.sfx, 'square', mtof(n), t + 0.4 + i * 0.06, 0.2, 0.09));
  if (tier >= 4) [96, 100, 103, 108, 103, 108, 112].forEach((n, i) => tone(A.sfx, 'square', mtof(n), t + 0.85 + i * 0.07, 0.22, 0.08));
  [72, 76, 79].forEach(n => tone(A.sfx, 'sawtooth', mtof(n), t + (tier >= 2 ? 0.8 : 0.4), 0.7, 0.06));
  A.crowd.gain.cancelScheduledValues(t);
  A.crowd.gain.setValueAtTime(0.2 + tier * 0.07, t);
  A.crowd.gain.setTargetAtTime(0.012, t + 0.5 + tier * 0.3, 0.7);
}
function sOmen(){ if (sfxOK()) { const t = A.ctx.currentTime; tone(A.sfx, 'sawtooth', 300, t, 0.7, 0.14, 2600); tone(A.sfx, 'square', 600, t, 0.7, 0.06, 5200); [84, 88, 91, 96].forEach((n, i) => tone(A.sfx, 'square', mtof(n), t + 0.7 + i * 0.05, 0.18, 0.09)); } }
function sChance(){ if (sfxOK()) { const t = A.ctx.currentTime; tone(A.sfx, 'square', mtof(79), t, 0.08, 0.1); tone(A.sfx, 'square', mtof(86), t + 0.09, 0.14, 0.1); } }
function sReel(){ if (sfxOK()) tone(A.sfx, 'square', 1200 + Math.random() * 400, A.ctx.currentTime, 0.025, 0.04); }
function sTreasure(){ if (sfxOK()) { const t = A.ctx.currentTime; hiss(A.sfx, t, 0.4, 0.25, 'bandpass', 600, 1, 3000); [72, 79, 84, 88, 91].forEach((n, i) => tone(A.sfx, 'triangle', mtof(n), t + 0.3 + i * 0.06, 0.2, 0.12)); } }
// 実況の読み上げ(ブラウザの音声合成。メニューでオンにしたときだけ)
function speak(text, force){
  if (!S.tts || !text || !('speechSynthesis' in window)) return;
  try {
    const ss = window.speechSynthesis;
    if (ss.speaking && !force) return;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.rate = 1.7; u.pitch = 1.1; u.volume = 0.9;
    ss.speak(u);
  } catch (e) {}
}
function castSay(text, force){ setText($('caster'), text); if (text) speak(text, force); }
function sLose(){ if (sfxOK()) { const t = A.ctx.currentTime; tone(A.sfx, 'sawtooth', 220, t, 0.3, 0.12, 110); A.crowd.gain.setTargetAtTime(0.012, t, 0.3); } }
function sBust(){ if (sfxOK()) { const t = A.ctx.currentTime; [0, 0.16, 0.32].forEach((d, i) => tone(A.sfx, 'sawtooth', 196 / (1 + i * 0.25), t + d, 0.28, 0.14)); } }
function audioFrame(racing, slow, u){
  if (!A.ctx || A.ctx.state !== 'running') return;
  const t = A.ctx.currentTime;
  if (racing && S.sfx && t >= A.gallopAt) {                      // 蹄の音
    hiss(A.sfx, t, 0.05, 0.22 + Math.random() * 0.12, 'lowpass', 240, 0.8);
    A.gallopAt = t + (slow ? 0.24 : 0.075) + Math.random() * 0.02;
  }
  if (slow && S.sfx && t >= A.heartAt) {                        // スロー中の心音
    tone(A.sfx, 'sine', 62, t, 0.16, 1.0, 40); tone(A.sfx, 'sine', 56, t + 0.19, 0.16, 0.8, 38);
    A.heartAt = t + 0.62;
  }
  if (racing && !V.settled) A.crowd.gain.setTargetAtTime(0.04 + 0.16 * u * u, t, 0.15);
}
// 拍に合わせて光らせるための値(0〜1)。音が止まっていても時計で刻む
let beat = 0, beatClock = 0;
function beatFrame(now, dt){
  beat *= Math.exp(-dt * 7);
  if (A.ctx && A.ctx.state === 'running') {
    while (A.beats.length && A.beats[0] <= A.ctx.currentTime) { A.beats.shift(); beat = 1; }
  } else if (now - beatClock > 60000 / BPM) { beatClock = now; beat = 1; }
}

/* ================= 3D ================= */
let G = null;
function canvasTex(w, h, paint){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  return new THREE.CanvasTexture(c);
}
function skyTex(stops){
  return canvasTex(4, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    stops.forEach(([p, col]) => g.addColorStop(p, col));
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
}
// 粒子の入れ物(蹴り上げる芝、火花)
function makePool(T, scene, n, mat){
  const pos = new Float32Array(n * 3).fill(-999), geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3));
  const pts = new T.Points(geo, mat); pts.frustumCulled = false; scene.add(pts);
  return {pos, vel:new Float32Array(n * 3), life:new Float32Array(n), geo, n, i:0, grav:6};
}
function spawn(P, x, y, z, vx, vy, vz, life){
  const i = P.i; P.i = (P.i + 1) % P.n;
  P.pos[i * 3] = x; P.pos[i * 3 + 1] = y; P.pos[i * 3 + 2] = z;
  P.vel[i * 3] = vx; P.vel[i * 3 + 1] = vy; P.vel[i * 3 + 2] = vz; P.life[i] = life;
}
function stepPool(P, dt){
  for (let i = 0; i < P.n; i++) {
    if (P.life[i] <= 0) continue;
    P.life[i] -= dt;
    if (P.life[i] <= 0) { P.pos[i * 3 + 1] = -999; continue; }
    P.pos[i * 3] += P.vel[i * 3] * dt; P.pos[i * 3 + 1] += P.vel[i * 3 + 1] * dt; P.pos[i * 3 + 2] += P.vel[i * 3 + 2] * dt;
    P.vel[i * 3 + 1] -= P.grav * dt;
  }
  P.geo.attributes.position.needsUpdate = true;
}
function init3D(){
  const T = window.THREE;
  if (!T) return null;
  const canvas = $('gl');
  const renderer = new T.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  // スマホは画素数を少し抑える(発熱と描画落ちの対策)
  renderer.setPixelRatio(Math.min(window.matchMedia('(pointer:coarse)').matches ? 1.5 : 2, window.devicePixelRatio || 1));
  const scene = new T.Scene();
  // 空は4種類:ナイター、夕焼け、オーロラ、ゴールデンレース
  const skies = [
    {tex:skyTex([[0, '#040618'], [0.38, '#0d1238'], [0.5, '#3a1d5c'], [0.56, '#c2415a'], [0.6, '#1a1438'], [1, '#0a0e24']]), fog:0x1a1438, hemi:0xaab4ff},
    {tex:skyTex([[0, '#1b1040'], [0.3, '#7a2a6a'], [0.48, '#ff6a3c'], [0.56, '#ffc24a'], [0.6, '#3a1a38'], [1, '#1a0e24']]), fog:0x4a2040, hemi:0xffc8a0},
    {tex:skyTex([[0, '#02121c'], [0.25, '#0b4a52'], [0.42, '#1fd6a0'], [0.5, '#5a3ad6'], [0.58, '#0d2a3a'], [1, '#06101c']]), fog:0x0f2f3a, hemi:0x9affd8},
    {tex:skyTex([[0, '#2a1a02'], [0.3, '#8a5a08'], [0.48, '#ffd60a'], [0.56, '#fff3a0'], [0.6, '#4a3008'], [1, '#1a1204']]), fog:0x5a4410, hemi:0xfff0b0},
    {tex:skyTex([[0, '#3a0a5a'], [0.14, '#ff2d3d'], [0.26, '#ff9a1a'], [0.36, '#ffe14a'], [0.44, '#3dff8a'], [0.52, '#2de2ff'], [0.6, '#5a3aff'], [1, '#14082a']]), fog:0x5a2a7a, hemi:0xffe0ff}
  ];
  scene.fog = new T.Fog(skies[0].fog, 60, 430);
  scene.background = skies[0].tex;
  const camera = new T.PerspectiveCamera(50, 1, 0.1, 900);
  const hemi = new T.HemisphereLight(0xaab4ff, 0x1c4a2a, 0.85); scene.add(hemi);
  const sun = new T.DirectionalLight(0xffffff, 0.95); sun.position.set(-0.5, 1, 0.7); scene.add(sun);

  const X0 = -70, X1 = TL + 220, XL = X1 - X0, XC = (X0 + X1) / 2;
  const lam = c => new T.MeshLambertMaterial({color:c});
  const add = (geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x, y, z); scene.add(m); return m; };

  // 芝
  const turf = canvasTex(128, 32, (c, w, h) => {
    c.fillStyle = '#1f9a52'; c.fillRect(0, 0, w / 2, h); c.fillStyle = '#17853f'; c.fillRect(w / 2, 0, w / 2, h);
    for (let i = 0; i < 500; i++) { c.fillStyle = 'rgba(' + (Math.random() < 0.5 ? '255,255,255' : '0,0,0') + ',0.05)'; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  });
  turf.wrapS = turf.wrapT = T.RepeatWrapping; turf.repeat.set(XL / 16, 2);
  const tr = add(new T.PlaneGeometry(XL, 17.4), new T.MeshLambertMaterial({map:turf}), XC, 0, 0); tr.rotation.x = -Math.PI / 2;
  const gr = add(new T.PlaneGeometry(1400, 900), lam(0x0c4a2a), XC, -0.05, 0); gr.rotation.x = -Math.PI / 2;
  // ラチ
  const white = new T.MeshLambertMaterial({color:0xf6f4ec, emissive:0x55554c});
  for (const z of [-8.7, 8.7]) add(new T.BoxGeometry(XL, 0.14, 0.14), white, XC, 1.05, z);
  const nPost = Math.floor(XL / 5), posts = new T.InstancedMesh(new T.BoxGeometry(0.1, 1.05, 0.1), white, nPost * 2), mtx = new T.Matrix4();
  for (let i = 0; i < nPost; i++) { mtx.makeTranslation(X0 + i * 5, 0.52, -8.7); posts.setMatrixAt(i * 2, mtx); mtx.makeTranslation(X0 + i * 5, 0.52, 8.7); posts.setMatrixAt(i * 2 + 1, mtx); }
  scene.add(posts);
  // ハロン棒(手前を流れてスピード感を出す)
  const red = lam(0xe5252c);
  for (let x = 20; x < X1; x += 40) for (const z of [-9.8, 9.8]) {
    if (Math.abs(x - TL) < 6) continue;
    add(new T.BoxGeometry(0.22, 1.6, 0.22), white, x, 0.8, z); add(new T.BoxGeometry(0.24, 0.8, 0.24), red, x, 2.0, z); add(new T.BoxGeometry(0.22, 0.8, 0.22), white, x, 2.8, z);
  }
  // ネオン看板(拍に合わせて波打つ)
  const adCols = [0xff2d3d, 0xffd60a, 0x1f5fd1, 0xf6f4ec, 0x12a150, 0xff7a1a, 0xb14cff], ads = [];
  for (let x = X0 + 8, i = 0; x < X1; x += 14, i++) {
    const m = new T.MeshLambertMaterial({color:adCols[i % adCols.length], emissive:adCols[i % adCols.length], emissiveIntensity:0.35});
    add(new T.BoxGeometry(12.4, 1.5, 0.2), m, x, 0.95, -11.2); ads.push(m);
  }
  // スタンド
  const crowd = canvasTex(512, 128, (c, w, h) => {
    c.fillStyle = '#121633'; c.fillRect(0, 0, w, h);
    const cols = ['#ffd60a', '#ff2d3d', '#f6f4ec', '#7aa2ff', '#ff9a3c', '#5be39a', '#e58cff'];
    for (let i = 0; i < 2600; i++) { c.fillStyle = cols[Math.floor(Math.random() * cols.length)]; c.globalAlpha = 0.35 + Math.random() * 0.65; c.fillRect(Math.random() * w, 8 + Math.random() * (h - 12), 3, 4); }
    c.globalAlpha = 1;
    for (let y = 22; y < h; y += 22) { c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(0, y, w, 2); }
  });
  crowd.wrapS = T.RepeatWrapping; crowd.repeat.set(XL / 46, 1);
  const cr = add(new T.PlaneGeometry(XL, 13), new T.MeshBasicMaterial({map:crowd}), XC, 7.6, -22); cr.rotation.x = -0.28;
  add(new T.BoxGeometry(XL, 1.2, 12), lam(0x2a2f55), XC, 15.4, -23);
  add(new T.BoxGeometry(XL, 1.4, 1), lam(0x1a1d3a), XC, 0.7, -14);
  // 照明塔
  const glow = canvasTex(64, 64, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,240,1)'); g.addColorStop(0.25, 'rgba(255,244,200,.55)'); g.addColorStop(1, 'rgba(255,240,180,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, w);
  });
  const glowMat = new T.SpriteMaterial({map:glow, blending:T.AdditiveBlending, depthWrite:false, transparent:true, fog:false});
  const pole = lam(0x3a4070);
  for (let x = X0 + 30; x < X1; x += 75) for (const z of [-34, 46]) {
    add(new T.BoxGeometry(0.7, 30, 0.7), pole, x, 15, z);
    const s = new T.Sprite(glowMat); s.position.set(x, 31, z); s.scale.set(26, 26, 1); scene.add(s);
  }
  // レーザー(スタンドの屋根から空へ)
  const lasers = [], lcol = [0xff2d3d, 0x2de2ff, 0xffd60a, 0x7dff5a, 0xff5af0, 0xffffff, 0x2de2ff, 0xff2d3d];
  for (let i = 0; i < 8; i++) {
    const geo = new T.CylinderGeometry(0.06, 1.1, 240, 6, 1, true); geo.translate(0, 120, 0);
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({color:lcol[i], transparent:true, opacity:0.2, blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide, fog:false}));
    m.position.set(-10 + i * 42, 16, -24); m.visible = false; scene.add(m); lasers.push(m);
  }
  // 客席のフラッシュ
  const FN = 180, fpos = new Float32Array(FN * 3).fill(-999), fgeo = new T.BufferGeometry();
  fgeo.setAttribute('position', new T.BufferAttribute(fpos, 3));
  const flashes = new T.Points(fgeo, new T.PointsMaterial({color:0xffffff, size:2.2, map:glow, transparent:true, blending:T.AdditiveBlending, depthWrite:false, fog:false}));
  flashes.frustumCulled = false; scene.add(flashes);
  // ターフビジョン(発馬機の奥、向正面、ゴール前の3か所)
  const vc = document.createElement('canvas'); vc.width = 512; vc.height = 192;
  const vtex = new T.CanvasTexture(vc), vmat = new T.MeshBasicMaterial({map:vtex, fog:false}), vframe = lam(0x14183a);
  for (const x of [-14, 110, 215]) {
    add(new T.BoxGeometry(33, 13, 1), vframe, x, 10.2, -19.2);
    add(new T.PlaneGeometry(31, 11.6), vmat, x, 10.2, -18.65);
  }
  // 発馬機
  const gate = lam(0x24306b);
  for (let i = 0; i <= 6; i++) add(new T.BoxGeometry(0.16, 2.8, 0.16), gate, -1.9, 1.4, (i - 3) * 2.4);
  add(new T.BoxGeometry(0.5, 0.4, 15), gate, -1.9, 2.9, 0);
  // ゴール
  const gl = add(new T.PlaneGeometry(0.6, 17.4), new T.MeshBasicMaterial({color:0xffffff}), TL, 0.03, 0); gl.rotation.x = -Math.PI / 2;
  for (const z of [-9.4, 9.4]) add(new T.BoxGeometry(0.6, 7.4, 0.6), white, TL, 3.7, z);
  const goalMat = new T.MeshLambertMaterial({color:0xff2d3d, emissive:0xff2d3d, emissiveIntensity:0.6});
  add(new T.BoxGeometry(1, 1.6, 19.4), goalMat, TL, 7.6, 0);
  const goalTex = canvasTex(512, 64, (c, w, h) => { c.fillStyle = '#ff2d3d'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 52px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('G O A L', w / 2, h / 2 + 3); });
  const gb = add(new T.PlaneGeometry(18, 1.5), new T.MeshBasicMaterial({map:goalTex}), TL - 0.52, 7.6, 0); gb.rotation.y = -Math.PI / 2;
  // ゴールの電飾
  const bulbs = [];
  for (let i = 0; i < 16; i++) {
    const s = new T.Sprite(new T.SpriteMaterial({map:glow, color:i % 2 ? 0xffd60a : 0xffffff, blending:T.AdditiveBlending, depthWrite:false, transparent:true, fog:false}));
    s.position.set(TL, 8.7, -9 + i * 1.2); s.scale.set(1.6, 1.6, 1); scene.add(s); bulbs.push(s);
  }

  // 馬と、その後ろに伸びる光の尾
  const trailTex = canvasTex(128, 16, (c, w, h) => { const g = c.createLinearGradient(0, 0, w, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const horses = [];
  for (let no = 1; no <= 6; no++) horses.push(makeHorse(T, scene, no, trailTex));
  // 蹴り上げる芝と、自分の馬の火花
  const dust = makePool(T, scene, 360, new T.PointsMaterial({color:0x0f5a2c, size:0.2, transparent:true, opacity:0.9, depthWrite:false}));
  const sparks = makePool(T, scene, 260, new T.PointsMaterial({color:0xffd60a, size:0.9, map:glow, transparent:true, blending:T.AdditiveBlending, depthWrite:false, fog:false}));
  sparks.grav = 2;

  return {T, renderer, scene, camera, hemi, skies, sky:-1, horses, dust, sparks, ads, lasers, bulbs, goalMat,
    flashes:{pos:fpos, geo:fgeo, n:FN}, vision:{c:vc, ctx:vc.getContext('2d'), tex:vtex, sig:''},
    shot:'', cam:new T.Vector3(8, 2.4, 10), look:new T.Vector3(0, 1.4, 0), kick:0, sheetVis:1, W:1, H:1, v:new T.Vector3()};
}
function makeHorse(T, scene, no, trailTex){
  const g = new T.Group();
  const mBody = new T.MeshLambertMaterial({color:0x8a5230}), mDark = new T.MeshLambertMaterial({color:0x3d2210});
  const F = FRAME[no - 1];
  const mSilk = new T.MeshLambertMaterial({color:F.bg, emissive:F.bg, emissiveIntensity:0.25});
  const box = (w, h, d, mat, x, y, z, parent) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); parent.add(m); return m; };
  const torso = new T.Group(); g.add(torso);
  box(2.1, 0.8, 0.62, mBody, 0, 1.5, 0, torso);
  box(0.55, 0.72, 0.58, mBody, 0.95, 1.6, 0, torso);
  const neck = new T.Group(); neck.position.set(1.0, 1.75, 0); torso.add(neck);
  const nk = box(1.0, 0.46, 0.4, mBody, 0.32, 0.36, 0, neck); nk.rotation.z = 0.85;
  const mn = box(0.95, 0.14, 0.14, mDark, 0.13, 0.5, 0, neck); mn.rotation.z = 0.85;
  const hd = box(0.8, 0.38, 0.34, mBody, 0.88, 0.74, 0, neck); hd.rotation.z = -0.5;
  box(0.1, 0.24, 0.08, mBody, 0.62, 1.06, 0.11, neck); box(0.1, 0.24, 0.08, mBody, 0.62, 1.06, -0.11, neck);
  box(0.2, 0.2, 0.36, mDark, 1.2, 0.56, 0, neck);
  const tail = new T.Group(); tail.position.set(-1.05, 1.82, 0); torso.add(tail);
  box(0.85, 0.16, 0.16, mDark, -0.42, 0, 0, tail);
  const legs = [];
  [[0.82, 0.2], [0.82, -0.2], [-0.82, 0.2], [-0.82, -0.2]].forEach(([x, z], i) => {
    const hip = new T.Group(); hip.position.set(x, 1.22, z); torso.add(hip);
    box(0.24, 0.64, 0.22, mBody, 0, -0.32, 0, hip);
    const knee = new T.Group(); knee.position.set(0, -0.64, 0); hip.add(knee);
    box(0.16, 0.5, 0.16, mBody, 0, -0.25, 0, knee);
    box(0.2, 0.12, 0.2, mDark, 0, -0.54, 0, knee);
    legs.push({hip, knee, front:i < 2, side:i % 2});
  });
  // ゼッケン(枠色)と騎手
  box(0.82, 0.52, 0.68, mSilk, -0.08, 1.6, 0, torso);
  const numTex = canvasTex(64, 64, (c, w, h) => { c.fillStyle = F.bg; c.fillRect(0, 0, w, h); c.fillStyle = F.fg; c.font = '900 50px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(no), w / 2, h / 2 + 3); });
  const numMat = new T.MeshBasicMaterial({map:numTex});
  for (const sgn of [1, -1]) { const p = new T.Mesh(new T.PlaneGeometry(0.46, 0.46), numMat); p.position.set(-0.08, 1.6, sgn * 0.346); if (sgn < 0) p.rotation.y = Math.PI; torso.add(p); }
  const jk = new T.Group(); jk.position.set(0.0, 1.95, 0); torso.add(jk);
  const jt = box(0.55, 0.62, 0.42, mSilk, 0.14, 0.26, 0, jk); jt.rotation.z = -0.8;
  box(0.32, 0.3, 0.32, mSilk, 0.55, 0.56, 0, jk);
  box(0.16, 0.5, 0.5, new T.MeshLambertMaterial({color:0xf6f4ec}), -0.1, -0.02, 0, jk);
  // 影
  const sh = new T.Mesh(new T.CircleGeometry(1, 14), new T.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0.32, depthWrite:false}));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; sh.scale.set(1.7, 0.6, 1); g.add(sh);
  // 光の尾(縦と横の2枚)
  const tMat = new T.MeshBasicMaterial({map:trailTex, color:F.glow, transparent:true, opacity:0.5, blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide, fog:false});
  const trail = new T.Group(); trail.position.set(-1.2, 1.5, 0); trail.visible = false;
  const t1 = new T.Mesh(new T.PlaneGeometry(1, 1.1), tMat); t1.position.x = -0.5;
  const t2 = new T.Mesh(new T.PlaneGeometry(1, 0.7), tMat); t2.position.x = -0.5; t2.rotation.x = Math.PI / 2;
  trail.add(t1, t2); g.add(trail);
  // 自分の馬の目印
  const marker = new T.Mesh(new T.ConeGeometry(0.6, 1.1, 4), new T.MeshBasicMaterial({color:0xffd60a, fog:false}));
  marker.rotation.x = Math.PI; marker.position.y = 4.1; marker.visible = false; g.add(marker);
  const z = (no - 3.5) * 2.4;
  g.position.set(0, 0, z);
  scene.add(g);
  return {no, g, z, x:0, p:0, torso, neck, tail, legs, jk, marker, trail, tMat, glow:F.glow, mBody, mDark};
}
function pose(H, ph, run, now){
  for (const L of H.legs) {
    const p = ph + (L.front ? 0 : Math.PI * 0.85) + L.side * 0.55;
    const s = Math.sin(p), c = Math.cos(p);
    L.hip.rotation.z = s * 0.95 * run;
    L.knee.rotation.z = -(0.12 + 1.15 * Math.max(0, L.front ? c : -c)) * run;
  }
  H.torso.position.y = Math.abs(Math.sin(ph)) * 0.16 * run + (run ? 0 : Math.sin(now / 900 + H.no) * 0.012);
  H.torso.rotation.z = Math.sin(ph + 0.6) * 0.075 * run;
  H.neck.rotation.z = run ? -0.32 * run + Math.sin(ph + 1) * 0.13 * run : Math.sin(now / 1300 + H.no * 2) * 0.06;
  H.tail.rotation.z = run ? 0.12 + Math.sin(ph * 2) * 0.12 : -1.05;
  H.tail.rotation.y = run ? 0 : Math.sin(now / 600 + H.no) * 0.25;
  H.jk.rotation.z = -0.18 * run;
}
function kick3D(v){ if (G) G.kick = Math.max(G.kick, v); }
function resize3D(){
  if (!G) return;
  const w = window.innerWidth, h = window.innerHeight;
  G.W = w; G.H = h;
  G.renderer.setSize(w, h, false);
  G.camera.aspect = w / h;
}
function setSky(i){
  if (G.sky === i) return;
  G.sky = i;
  const s = G.skies[i];
  G.scene.background = s.tex; G.scene.fog.color.setHex(s.fog); G.hemi.color.setHex(s.hemi);
}
// ターフビジョン:投票中はオッズ、レース中は上位3頭
function drawVision(racing, tau){
  const R = V.race, vi = G.vision, c = vi.ctx, W = vi.c.width, Hh = vi.c.height;
  let order = [], head = '投票受付中';
  if (racing) {
    const key = h => tau >= h.T ? 10 - h.T : prog(h, tau);
    order = R.hs.slice().sort((a, b) => key(b) - key(a)).slice(0, 3).map(h => h.no);
    head = V.settled ? '確定' : 'レース中';
  }
  const sig = V.n + head + order.join('') + (R.gold ? 'g' : '');
  if (sig === vi.sig) return;
  vi.sig = sig;
  c.fillStyle = R.gold ? '#3a2a00' : '#060a20'; c.fillRect(0, 0, W, Hh);
  c.fillStyle = R.gold ? '#ffd60a' : '#ff2d3d'; c.fillRect(0, 0, W, 46);
  c.fillStyle = R.gold ? '#16130f' : '#fff'; c.font = '900 34px sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'left';
  c.fillText('第' + V.n + 'R ' + head, 14, 25);
  if (R.gold) { c.textAlign = 'right'; c.fillText('払戻×2', W - 14, 25); }
  c.textAlign = 'center';
  if (order.length) order.forEach((no, i) => {
    const x = 96 + i * 160, F = FRAME[no - 1];
    c.fillStyle = '#f6f4ec'; c.font = '900 26px sans-serif'; c.fillText((i + 1) + '着', x - 52, 120);
    c.fillStyle = F.bg; c.fillRect(x - 20, 66, 104, 104); c.strokeStyle = '#f6f4ec'; c.lineWidth = 4; c.strokeRect(x - 20, 66, 104, 104);
    c.fillStyle = F.fg; c.font = '900 84px sans-serif'; c.fillText(String(no), x + 32, 124);
  });
  else R.hs.forEach((h, i) => {
    const x = 44 + i * 85, F = FRAME[i];
    c.fillStyle = F.bg; c.fillRect(x - 30, 62, 60, 56); c.fillStyle = F.fg; c.font = '900 40px sans-serif'; c.fillText(String(h.no), x, 92);
    c.fillStyle = h.odds >= 15 ? '#ffd60a' : '#f6f4ec'; c.font = '900 26px sans-serif'; c.fillText(h.odds.toFixed(1), x, 150);
  });
  vi.tex.needsUpdate = true;
}
function update3D(now, dt, racing, t, tau, replay){
  if (!G || !V.race) return;
  const R = V.race, cam = G.camera, myH = myHorseNo();
  const live = racing && !V.settled, hot = S.streak >= 2 || R.gold, quiet = calm();
  const omenSky = V.omen && racing && !V.late && t >= R.a && !quiet;
  setSky(omenSky ? 4 : (racing && V.slow && !V.settled && unlocked(30)) ? 2 : R.gold ? 3 : R.seed % 3);
  let lead = -1e9, mine = 0;
  const xs = [];
  for (const H of G.horses) {
    const h = R.hs[H.no - 1];
    const p = racing ? prog(h, tau) : 0;
    H.p = p; H.x = p * TL;
    H.g.position.x = H.x;
    let run = 0;
    if (racing) run = Math.min(1, tau * 5) * (tau >= h.T ? Math.max(0.3, 1 - (tau - h.T) * 0.45) : 1);
    pose(H, racing ? tau * 24 + H.no * 1.3 : 0, run, now);
    const isMine = H.no === myH;
    H.marker.visible = isMine;
    if (isMine) { H.marker.position.y = 4.1 + Math.sin(now / 150) * 0.2; H.marker.rotation.y = now / 260; mine = H.x; if (unlocked(15) && !quiet) H.marker.material.color.setHSL((now / 900) % 1, 1, 0.6); else H.marker.material.color.setHex(0xffd60a); }
    // 光の尾:自分の馬は金色で長く
    const tv = racing && run > 0.55 && !quiet;
    H.trail.visible = tv;
    if (tv) {
      H.trail.scale.x = (isMine ? 9 : 5) * run * (0.85 + beat * 0.3);
      H.trail.scale.y = isMine ? 1.5 : 1;
      if (isMine && unlocked(3)) H.tMat.color.setHSL((now / 600) % 1, 1, 0.6); else H.tMat.color.setHex(isMine ? 0xffd60a : H.glow);
      H.tMat.opacity = isMine ? 0.8 : 0.4;
    }
    xs.push(H.x); if (H.x > lead) lead = H.x;
    if (racing && run > 0.5 && !quiet) {
      if (Math.random() < 0.7) spawn(G.dust, H.x - 0.9, 0.12, H.z + (Math.random() - 0.5) * 0.5, -3 - Math.random() * 5, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 2, 0.55);
      if (isMine && (hot || (V.locked && V.locked.all) || (h.rank === 1 && tau >= h.T))) spawn(G.sparks, H.x - 0.6 + Math.random() * 1.6, 0.8 + Math.random() * 1.6, H.z + (Math.random() - 0.5) * 0.9, -4 - Math.random() * 6, 1 + Math.random() * 3, (Math.random() - 0.5) * 3, 0.5);
    }
  }
  const rate = racing && V.slow ? SL_RATE : 1;
  stepPool(G.dust, dt * rate); stepPool(G.sparks, dt * rate);

  // ギラギラ:看板、ゴールの電飾、レーザー、客席のフラッシュ
  const s = now / 1000;
  for (let i = 0; i < G.ads.length; i++) G.ads[i].emissiveIntensity = quiet ? 0.35 : 0.25 + 0.75 * Math.max(0, Math.sin(s * 5 - i * 0.7)) * (0.4 + beat * 0.6);
  G.goalMat.emissiveIntensity = quiet ? 0.6 : 0.45 + beat * 0.55;
  for (let i = 0; i < G.bulbs.length; i++) G.bulbs[i].material.opacity = quiet ? 0.6 : (Math.floor(s * 8) + i) % 3 === 0 ? 1 : 0.25;
  const showLaser = !quiet && (racing || hot);
  for (let i = 0; i < G.lasers.length; i++) {
    const L = G.lasers[i]; L.visible = showLaser;
    if (!showLaser) continue;
    L.rotation.z = Math.sin(s * (0.7 + i * 0.07) + i * 1.7) * 0.85;
    L.rotation.x = 0.55 + Math.sin(s * 0.5 + i) * 0.4;
    L.material.opacity = 0.1 + beat * 0.16 + (V.settled && racing ? 0.1 : 0);
  }
  const F = G.flashes, fN = quiet ? 0 : Math.floor(racing ? 50 + 130 * clamp(tau / R.tWin, 0, 1) : hot ? 40 : 14);
  for (let k = 0; k < 18; k++) {
    const i = Math.floor(Math.random() * F.n), y = 2.5 + Math.random() * 10.5;
    F.pos[i * 3] = G.cam.x + (Math.random() - 0.5) * 260; F.pos[i * 3 + 1] = y; F.pos[i * 3 + 2] = -21.6 - (y - 7.6) * 0.29;
  }
  F.geo.attributes.position.needsUpdate = true; F.geo.setDrawRange(0, fN);
  drawVision(racing, tau);

  // カメラ
  xs.sort((a, b) => b - a);
  const pack = (xs[0] + xs[1] + xs[2]) / 3;
  const focus = myH ? pack * 0.55 + mine * 0.45 : pack;
  let id, px, py, pz, lx, ly, lz, fov, ease = 0;
  const far = cam.aspect < 1 ? 1.45 : 1;       // 縦長の画面では横からのカメラを引く
  if (replay) {                                   // ゴールの瞬間をもう一度、正面寄りから
    id = 'R'; px = TL + 6.5 * far; py = 1.5; pz = 4.5 * far; lx = TL - 3; ly = 1.45; lz = -0.5; fov = 36;
  } else if (!racing) {
    const mz = myH ? G.horses[myH - 1].z : 0;
    id = 'I'; px = 9 + Math.sin(s * 0.25) * 2.2; py = 2.3 + Math.sin(s * 0.4) * 0.25; pz = 10.5 - Math.cos(s * 0.25) * 1.2;
    lx = 0.4; ly = 1.35; lz = mz * 0.35; fov = 44; ease = 3;
  } else if (V.settled && t > R.tSettle + 0.3) {
    const w = G.horses[R.order[0] - 1], ss = t - R.tSettle, ang = -0.95 + ss * 0.3;
    id = 'E'; px = w.x + Math.cos(ang) * 8.5; pz = w.z - Math.sin(ang) * 8.5; py = 2 + ss * 0.2; lx = w.x; ly = 1.7; lz = w.z; fov = 38; ease = 6;
  } else {
    const u = tau / R.tWin;
    if (myH && V.leadSince && now - V.leadSince > 350 && u >= 0.22 && u < 0.78) {   // 自分の馬が先頭に立ったら専用カメラ
      const H = G.horses[myH - 1]; id = 'M'; px = H.x + 3.8; py = 1.3; pz = H.z + 4.6 * far; lx = H.x - 0.4; ly = 1.6; lz = H.z; fov = 44;
    } else if (u < 0.2) { id = 'A'; px = focus - 8.5; py = 2.7; pz = 2.2; lx = focus + 10; ly = 1.3; lz = 0; fov = 62; }
    else if (u < 0.5) { id = 'B'; px = focus + 5 / far; py = 3.1 * far; pz = 14 * far; lx = focus + 1.2; ly = 1.2; lz = 0; fov = 44; }
    else if (u < 0.78) { id = 'C'; px = lead + 15; py = 1.7; pz = 3.2; lx = focus; ly = 1.6; lz = -0.6; fov = 38; }
    else { const cx = Math.min(lead + 2, TL - 4), k = clamp((t - R.a) / 1.5, 0, 1); id = 'D'; px = cx; py = 3.0 * far; pz = 14.5 * far; lx = cx + 3.4; ly = 1.2; lz = 0; fov = 50 - 14 * k; }
  }
  if (id !== G.shot) { if (racing && G.shot && id !== 'A') sWhoosh(); G.shot = id; G.cam.set(px, py, pz); G.look.set(lx, ly, lz); }
  else if (!ease) { G.cam.set(px, py, pz); G.look.set(lx, ly, lz); }
  else { const f = 1 - Math.exp(-dt * ease); G.cam.x += (px - G.cam.x) * f; G.cam.y += (py - G.cam.y) * f; G.cam.z += (pz - G.cam.z) * f; G.look.x += (lx - G.look.x) * f; G.look.y += (ly - G.look.y) * f; G.look.z += (lz - G.look.z) * f; }
  G.kick *= Math.exp(-dt * 4.5);
  const amp = quiet ? 0 : (live ? 0.035 + beat * 0.03 : 0) + G.kick * 0.3;
  cam.position.set(G.cam.x + (Math.random() - 0.5) * amp, G.cam.y + (Math.random() - 0.5) * amp, G.cam.z + (Math.random() - 0.5) * amp);
  cam.lookAt(G.look);
  const asp = cam.aspect;
  cam.fov = (asp >= 1.3 ? fov : Math.min(100, fov * (1 + (1.3 - asp) * 0.75))) - (quiet || !live ? 0 : beat * 0.9);
  // 下の投票パネルに隠れないよう、画面の中心を上へずらす
  const want = (V.ph === 'bet' || V.late) ? 1 : 0;
  G.sheetVis += (want - G.sheetVis) * (1 - Math.exp(-dt * 9));
  const off = Math.round($('sheet').offsetHeight * 0.42 * G.sheetVis);
  if (off > 1) cam.setViewOffset(G.W, G.H, 0, off, G.W, G.H); else { if (cam.view) cam.clearViewOffset(); cam.updateProjectionMatrix(); }
  G.renderer.render(G.scene, cam);

  // 馬の頭上に、賭けた人の名札を重ねる
  for (const H of G.horses) {
    const el = tagEls[H.no - 1];
    if (!el) continue;
    if (!el.textContent) { el.style.opacity = '0'; continue; }
    const v = G.v.set(H.x, H.no === myH ? 5.3 : 3.6, H.z).project(cam);
    if (v.z > -1 && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05) {
      el.style.opacity = '1';
      el.style.transform = 'translate(' + ((v.x * 0.5 + 0.5) * G.W).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * G.H).toFixed(1) + 'px) translate(-50%,-100%)';
    } else el.style.opacity = '0';
  }
}

/* ================= 画面エフェクト(集中線・花火・星・紙吹雪・コイン) ================= */
const fx = $('fx'), fctx = fx.getContext('2d');
let parts = [], coinsFx = [], rain = [], fw = [], stars = [], rings = [], fxDirty = false, burst = 0, hueSpin = 0, rays = 0, raysRb = false, raysRot = 0;
function resizeFx(){ fx.width = window.innerWidth; fx.height = window.innerHeight; }
function confetti(n){
  if (calm()) return;
  const W = fx.width, H = fx.height, cols = ['#ffd60a', '#ff2d3d', '#f6f4ec', '#1f5fd1', '#12a150', '#ff5af0', '#2de2ff'];
  for (let i = 0; i < n; i++) parts.push({x:W * (0.1 + Math.random() * 0.8), y:H * 0.45, vx:(Math.random() - 0.5) * 26, vy:-6 - Math.random() * 18,
    w:6 + Math.random() * 9, rot:Math.random() * 6.28, vr:(Math.random() - 0.5) * 0.6, c:cols[i % cols.length], life:90 + Math.random() * 70});
}
function coinFly(n){
  if (calm()) return;
  const r = $('wallet').getBoundingClientRect(), W = fx.width, H = fx.height;
  for (let i = 0; i < n; i++) coinsFx.push({x0:W / 2 + (Math.random() - 0.5) * W * 0.5, y0:H * 0.5 + (Math.random() - 0.5) * 100,
    x1:r.left + r.width * 0.6, y1:r.top + r.height * 0.6, t:-i * 0.022, lift:120 + Math.random() * 180});
}
function coinRain(n){
  if (calm()) return;
  for (let i = 0; i < n; i++) rain.push({x:Math.random() * fx.width, y:-20 - Math.random() * fx.height * 0.9, vy:7 + Math.random() * 9, ph:Math.random() * 6, r:8 + Math.random() * 7});
}
function firework(nx, ny, hue, n){
  if (calm() || fw.length > 1600) return;
  const x = nx * fx.width, y = ny * fx.height;
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = 2 + Math.random() * 7.5; fw.push({x, y, px:x, py:y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp, life:38 + Math.random() * 42, hue:hue + (Math.random() - 0.5) * 40}); }
  rings.push({x, y, r:6, vr:9, life:1, col:'hsl(' + hue + ' 100% 75%)', w:3});
}
function starBurst(nx, ny, n, hue){
  if (calm()) return;
  const x = nx * fx.width, y = ny * fx.height;
  for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, sp = 1.5 + Math.random() * 6; stars.push({x, y, vx:Math.cos(a) * sp, vy:Math.sin(a) * sp - 1, s:5 + Math.random() * 11, life:1, rot:Math.random() * 3, hue}); }
}
function ring(nx, ny, col){ if (!calm()) rings.push({x:nx * fx.width, y:ny * fx.height, r:10, vr:26, life:1, col, w:8}); }
function starPath(c, x, y, s, rot){
  c.beginPath();
  for (let i = 0; i < 8; i++) { const a = rot + i * Math.PI / 4, r = i % 2 ? s * 0.28 : s; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.closePath();
}
function drawFx(dt, racing, u){
  const W = fx.width, H = fx.height, R = V.race;
  const hot = !!R && (S.streak >= 2 || R.gold);
  const lines = racing && !V.settled && !calm();
  // フィーバー中とゴールデンレースは、画面のあちこちで星がまたたく
  if (hot && !calm() && Math.random() < 0.25) stars.push({x:Math.random() * W, y:Math.random() * H * 0.8, vx:0, vy:-0.4, s:4 + Math.random() * 9, life:1, rot:Math.random() * 3, hue:R.gold ? 50 : Math.random() * 360});
  if (!lines && !parts.length && !coinsFx.length && !rain.length && !fw.length && !stars.length && !rings.length && burst <= 0 && rays <= 0) { if (fxDirty) { fctx.clearRect(0, 0, W, H); fxDirty = false; } return; }
  fxDirty = true;
  fctx.clearRect(0, 0, W, H);
  hueSpin = (hueSpin + dt * 240) % 360;
  if (rays > 0) {                                  // 的中の後光
    rays = Math.max(0, rays - dt / 2.9); raysRot += dt * 0.7;
    const cx = W / 2, cy = H * 0.44, RR = Math.hypot(W, H) * 0.62, a0 = Math.min(1, (1 - rays) * 12) * Math.min(1, rays * 2.5);
    const g = fctx.createRadialGradient(cx, cy, 0, cx, cy, RR);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    fctx.save(); fctx.globalAlpha = 0.55 * a0;
    for (let i = 0; i < 24; i++) {
      const a = raysRot + i * Math.PI / 12;
      fctx.fillStyle = raysRb ? 'hsl(' + ((i * 15 + hueSpin) % 360) + ' 100% 60%)' : '#ffd60a';
      fctx.beginPath(); fctx.moveTo(cx, cy); fctx.arc(cx, cy, RR, a, a + Math.PI / 24); fctx.closePath(); fctx.fill();
    }
    fctx.globalCompositeOperation = 'destination-out'; fctx.globalAlpha = 1;
    const m = fctx.createRadialGradient(cx, cy, RR * 0.3, cx, cy, RR); m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(1, 'rgba(0,0,0,1)');
    fctx.fillStyle = m; fctx.fillRect(0, 0, W, H);
    fctx.restore();
  }
  if (lines || burst > 0) {                       // 集中線(フィーバー中と的中時は虹色)
    const int = burst > 0 ? 1 : 0.3 + 0.7 * u * u;
    const n = Math.floor(14 + int * 50), cx = W / 2, cy = H * 0.46, RR = Math.hypot(W, H) / 2;
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * 6.283, r0 = RR * (0.62 + Math.random() * 0.3 - int * 0.22), wdt = (0.004 + Math.random() * 0.014) * (1 + int);
      fctx.fillStyle = burst > 0 ? 'hsl(' + ((hueSpin + i * 9) % 360) + ' 100% 65%)' : hot ? 'hsl(' + ((hueSpin + i * 14) % 360) + ' 100% 78%)' : '#ffffff';
      fctx.globalAlpha = burst > 0 ? 0.5 * burst : 0.07 + Math.random() * 0.2 * int;
      fctx.beginPath();
      fctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      fctx.lineTo(cx + Math.cos(ang - wdt) * RR * 1.1, cy + Math.sin(ang - wdt) * RR * 1.1);
      fctx.lineTo(cx + Math.cos(ang + wdt) * RR * 1.1, cy + Math.sin(ang + wdt) * RR * 1.1);
      fctx.fill();
    }
    fctx.globalAlpha = 1;
    burst = Math.max(0, burst - dt * 1.1);
  }
  // 光るもの(花火・星・輪)は加算合成
  fctx.globalCompositeOperation = 'lighter';
  fctx.lineWidth = 2.6;
  for (const p of fw) {
    p.px = p.x; p.py = p.y; p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.vx *= 0.975; p.vy *= 0.975; p.life--;
    fctx.strokeStyle = 'hsl(' + p.hue + ' 100% ' + (55 + Math.random() * 25) + '%)'; fctx.globalAlpha = clamp(p.life / 30, 0, 1);
    fctx.beginPath(); fctx.moveTo(p.px, p.py); fctx.lineTo(p.x, p.y); fctx.stroke();
  }
  fw = fw.filter(p => p.life > 0);
  for (const st of stars) {
    st.x += st.vx; st.y += st.vy; st.vx *= 0.94; st.vy *= 0.94; st.life -= dt * 1.5; st.rot += dt * 3;
    fctx.globalAlpha = clamp(st.life, 0, 1) * (0.6 + 0.4 * Math.sin(st.life * 30));
    fctx.fillStyle = 'hsl(' + st.hue + ' 100% 78%)';
    starPath(fctx, st.x, st.y, st.s * (0.5 + st.life * 0.5), st.rot); fctx.fill();
  }
  stars = stars.filter(st => st.life > 0);
  for (const g of rings) {
    g.r += g.vr; g.life -= dt * 2.2;
    fctx.globalAlpha = clamp(g.life, 0, 1); fctx.strokeStyle = g.col; fctx.lineWidth = g.w * clamp(g.life, 0.1, 1);
    fctx.beginPath(); fctx.arc(g.x, g.y, g.r, 0, 6.283); fctx.stroke();
  }
  rings = rings.filter(g => g.life > 0);
  fctx.globalCompositeOperation = 'source-over'; fctx.globalAlpha = 1;
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.45; p.vx *= 0.985; p.rot += p.vr; p.life--;
    fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.rot);
    fctx.globalAlpha = clamp(p.life / 25, 0, 1);
    fctx.fillStyle = p.c; fctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2);
    fctx.restore();
  }
  parts = parts.filter(p => p.life > 0 && p.y < H + 30);
  fctx.fillStyle = '#ffd60a'; fctx.strokeStyle = '#16130f'; fctx.lineWidth = 2;
  for (const c of rain) {
    c.y += c.vy; c.ph += 0.3;
    fctx.beginPath(); fctx.ellipse(c.x, c.y, c.r, c.r * Math.abs(Math.cos(c.ph)) + 2, 0, 0, 6.283); fctx.fill(); fctx.stroke();
  }
  rain = rain.filter(c => c.y < H + 30);
  let arrived = false;
  for (const c of coinsFx) {
    c.t += dt * 1.5;
    if (c.t <= 0) continue;
    const k = Math.min(1, c.t), e = k * k * (3 - 2 * k);
    const x = c.x0 + (c.x1 - c.x0) * e, y = c.y0 + (c.y1 - c.y0) * e - Math.sin(k * Math.PI) * c.lift;
    fctx.beginPath(); fctx.ellipse(x, y, 9, 9 * Math.abs(Math.cos(c.t * 9)) + 2, 0, 0, 6.283); fctx.fill(); fctx.stroke();
    if (k >= 1) { c.done = true; arrived = true; }
  }
  if (arrived) { sCoin(); const w = $('wallet'); w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump'); }
  coinsFx = coinsFx.filter(c => !c.done);
}
function flash(kind){
  if (calm()) return;
  const f = $('flash'); f.className = ''; void f.offsetWidth; f.className = 'go ' + kind;
}
function shake(big){
  if (calm()) return;
  const B = document.body.classList;
  B.remove('shake', 'shake2'); void document.body.offsetWidth; B.add(big ? 'shake2' : 'shake');
  setTimeout(() => B.remove('shake', 'shake2'), big ? 900 : 500);
}

/* ================= HUD ================= */
const elBash = $('bashira'), elPop = $('pop'), elDan = $('dan'), elCoins = $('coins'), elList = $('players'), elBoard = $('board'), elMap = $('map');
let umaEls = [], tagEls = [], voteSig = [], tagSig = [], plSig = '', shownCoins = 1000, mapDots = [], roomOpen = false, autoOpened = false;

function badge(no){
  const b = document.createElement('span');
  b.className = 'no'; b.textContent = String(no);
  b.style.background = FRAME[no - 1].bg; b.style.color = FRAME[no - 1].fg;
  return b;
}
function buildMap(){
  mapDots = FRAME.map((F, i) => {
    const d = document.createElement('span'); d.className = 'dot'; d.textContent = String(i + 1);
    d.style.background = F.bg; d.style.color = F.fg; elMap.appendChild(d); return d;
  });
  tagEls = FRAME.map(() => { const t = document.createElement('span'); t.className = 'tag3d'; $('tags').appendChild(t); return t; });
}
function toast(text, kind){
  const box = $('toasts'), t = document.createElement('div');
  t.className = 'toast ' + (kind || ''); t.textContent = text;
  box.appendChild(t);
  while (box.childElementCount > 4) box.firstElementChild.remove();
  setTimeout(() => t.remove(), 3600);
  if (kind !== 'join') sToast();
}
function callout(text, kind){
  const box = $('callouts'), c = document.createElement('span');
  c.className = 'callout ' + kind; c.textContent = text;
  box.appendChild(c);
  while (box.childElementCount > 4) box.firstElementChild.remove();
  setTimeout(() => c.remove(), 1100);
}
// 発走の瞬間、自分の馬の名前が画面を横切る
function cutIn(L){
  if (calm()) return;
  const el = $('cutin'), h = V.race.hs[L.h - 1], no = $('cutNo');
  no.textContent = String(L.h); no.style.background = FRAME[L.h - 1].bg; no.style.color = FRAME[L.h - 1].fg;
  $('cutName').textContent = h.name + (h.jk ? '(' + h.jk + ')' : '');
  $('cutSay').textContent = V.omen ? '激アツ!?' : L.all ? '全ツッパ!!' : h.odds >= 15 ? '大穴いけ!!' : '行け!!';
  el.className = ''; void el.offsetWidth; el.className = 'go' + (L.all ? ' all' : '') + (V.omen && Math.random() < 0.5 ? ' omen' : '');
}
// 騎手のひとこと(画面下の吹き出し)
let sayTimer = 0;
function jockeySay(no, kind, ms){
  const h = V.race && no && V.race.hs[no - 1];
  if (!h || !DATA || h.jki === undefined) return '';
  const j = DATA.jockeys[h.jki], lines = j.lines && j.lines[kind];
  if (!lines || !lines.length) return '';
  const text = lines[Math.floor(Math.random() * lines.length)];
  setText($('sayWho'), j.name + '(' + h.no + '番 ' + h.name + ')');
  setText($('sayText'), '「' + text + '」');
  $('sayFace').style.setProperty('--h', String((h.jki * 37 + 12) % 360));
  const el = $('say');
  el.className = ''; void el.offsetWidth; el.className = 'on';
  clearTimeout(sayTimer); sayTimer = setTimeout(() => { el.className = ''; }, ms || 2200);
  return text;
}
function showLucky(lk){
  const box = $('lucky'), reels = box.querySelectorAll('.reels span'), res = $('luckyRes'), syms = ['7', '◎', '★', '♪', '×'];
  box.hidden = false; box.className = 'lucky'; res.textContent = '';
  const stopAt = [450, 750, 1100], t0 = performance.now(), seq = ++saySeq;
  const spin = () => {
    if (seq !== saySeq || box.hidden) return;
    const el = performance.now() - t0;
    reels.forEach((r, i) => { r.textContent = el >= stopAt[i] ? lk.sym[i] : syms[Math.floor(Math.random() * syms.length)]; r.classList.toggle('stop', el >= stopAt[i]); });
    if (el < stopAt[2]) { sReel(); setTimeout(spin, 60); return; }
    res.textContent = lk.text;
    if (lk.kind === 'miss') { box.classList.add('miss'); return; }
    box.classList.add('hit');
    if (lk.kind === 'big') { S.coins = Math.min(1e12, S.coins + lk.v); inc('luckyBig'); coinRain(60); sWin(2); flash('gold'); buzz([50, 30, 50, 30, 150]); checkAch({type:'lucky'}); }
    else if (lk.kind === 'coin') { S.coins = Math.min(1e12, S.coins + lk.v); coinFly(8); sChance(); }
    else if (lk.kind === 'boost') { S.boost = 1.5; sLevel(); toast('次のレースの払戻×1.5', 'gold'); }
    else if (lk.kind === 'xp') { addXp(40); sChance(); }
    if (!calm()) starBurst(0.5, 0.62, 14, 50);
    save(); pushPresence();
  };
  spin();
}
function renderRound(){
  const R = V.race;
  elPop.className = 'pop'; $('popA').textContent = ''; $('popB').textContent = ''; $('popC').textContent = '';
  elBoard.hidden = true; rays = 0; $('lucky').hidden = true; saySeq++;
  document.body.classList.remove('lost');
  castSay('');
  voteSig = []; tagSig = [];
  umaEls = R.hs.map((h, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'uma' + (h.odds >= 15 ? ' ana' : ''); b.id = 'uma' + h.no;
    b.style.setProperty('--i', String(i));
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', h.no + '番 ' + h.name + ' ' + h.style + (h.jk ? ' 騎手' + h.jk : '') + ' 単勝' + h.odds.toFixed(1) + '倍');
    const waku = document.createElement('span'); waku.className = 'waku'; waku.textContent = String(h.no);
    waku.style.background = FRAME[h.no - 1].bg; waku.style.color = FRAME[h.no - 1].fg;
    const sh = document.createElement('span'); sh.className = 'shirushi'; sh.textContent = h.mark;
    const nm = document.createElement('span'); nm.className = 'name'; nm.textContent = h.name;
    const st = document.createElement('span'); st.className = 'style'; st.textContent = h.style;
    const jk = document.createElement('span'); jk.className = 'jk'; jk.textContent = h.jk;
    const od = document.createElement('span'); od.className = 'odds'; od.textContent = h.odds.toFixed(1);
    const sm = document.createElement('small'); sm.textContent = '倍'; od.appendChild(sm);
    const vt = document.createElement('span'); vt.className = 'votes';
    b.append(waku, sh, nm, st, jk, od, vt);
    b.addEventListener('click', () => pick(h.no));
    return b;
  });
  elBash.replaceChildren(...umaEls);
  if (G) for (const H of G.horses) { const c = COATS[R.hs[H.no - 1].coat]; H.mBody.color.set(c.body); H.mDark.color.set(c.dark); }
  if (R.gold && !V.late) {
    toast('ゴールデンレース! このレースは払戻2倍', 'gold');
    if (!calm()) { flash('gold'); for (let i = 0; i < 5; i++) setTimeout(() => starBurst(0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.3, 14, 50), i * 120); }
  }
}
function renderBoard(){
  const R = V.race, kids = [];
  const lamp = document.createElement('span'); lamp.className = 'lamp'; lamp.textContent = '確定'; kids.push(lamp);
  R.order.slice(0, 3).forEach((no, i) => {
    const s = document.createElement('span'); s.className = 'pos';
    const em = document.createElement('em'); em.textContent = (i + 1) + '着';
    s.append(em, badge(no));
    if (i === 0) s.append(document.createTextNode(R.hs[no - 1].name));
    kids.push(s);
  });
  const m = document.createElement('span'); m.className = 'margin';
  m.textContent = (R.photo ? '写真判定 ' : '') + R.margin;
  kids.push(m);
  elBoard.replaceChildren(...kids);
  elBoard.hidden = false;
}
// 払戻の倍率で演出が4段階に変わる
const CROSS = {1e4:'1万', 1e5:'10万', 1e6:'100万', 1e7:'1,000万', 1e8:'1億'};
function celebrate(res){
  const a = $('popA'), b = $('popB'), c = $('popC');
  const R = V.race, wn = R.hs[R.order[0] - 1];
  castSay(wn.name + ' ゴールイン!', true);
  sGoal(); kick3D(1);
  ring(0.5, 0.46, '#ffffff');
  if (A.ctx) { const t = A.ctx.currentTime; A.mfilt.frequency.setTargetAtTime(15000, t, 0.05); if (S.bgm) { A.music.gain.setTargetAtTime(0.55, t, 0.03); hiss(A.music, t, 1.4, 0.35, 'highpass', 4000, 0.5); } }
  A.lead = false;
  let cls = 'pop show';
  if (!res) { a.textContent = ''; b.textContent = ''; c.textContent = ''; flash(''); elPop.className = cls; return; }
  if (res.type === 'win') {
    const tr = res.tier;
    a.textContent = ['', '的中!!', '大的中!!', '大穴的中!!', '万馬券級!!!'][tr];
    b.textContent = '+0';
    V.payAnim = {from:0, to:res.pay, t0:performance.now(), dur:500 + tr * 250, last:-1};
    c.textContent = (S.streak >= 2 ? S.streak + '連勝!' : '') + (res.combo ? ' COMBO' : '') + (res.mult > 1 ? ' ボーナス×' + res.mult : '');
    cls += ' t' + tr + (unlocked(7) ? ' rb' : '');
    flash(tr >= 3 ? 'rainbow' : 'gold'); shake(tr >= 3); burst = 1;
    if (!calm()) { rays = 1; raysRb = tr >= 3; }
    confetti([0, 120, 190, 300, 460][tr]);
    coinFly([0, 22, 32, 46, 64][tr]);
    if (tr >= 2 || unlocked(20)) coinRain([0, 30, 40, 90, 170][tr]);
    const shots = [0, 3, 5, 9, 16][tr] * (unlocked(10) ? 2 : 1);
    for (let i = 0; i < shots; i++) setTimeout(() => firework(0.12 + Math.random() * 0.76, 0.1 + Math.random() * 0.32, Math.random() * 360, 50 + tr * 14), 120 + i * (1900 / shots));
    starBurst(0.5, 0.42, 16 + tr * 8, 50);
    sWin(tr); if (tr >= 3) sHorn();
    buzz(tr >= 3 ? [60, 40, 60, 40, 200] : [40, 30, 90]);
    setTimeout(() => { const line = jockeySay(res.h, 'win', 3200); if (line) speak(line); }, 1100);
    if (res.jp) setTimeout(() => {
      a.textContent = 'JACKPOT!!'; elPop.className = 'pop show t4 jp';
      V.payAnim = {from:res.pay, to:res.pay + res.jp, t0:performance.now(), dur:1600, last:-1};
      flash('rainbow'); shake(true); burst = 1; coinRain(220); confetti(300); sHorn(); setTimeout(sHorn, 700);
      for (let i = 0; i < 14; i++) setTimeout(() => firework(0.1 + Math.random() * 0.8, 0.1 + Math.random() * 0.35, Math.random() * 360, 90), i * 140);
      buzz([100, 50, 100, 50, 100, 50, 400]); toast('ジャックポット +' + fmt(res.jp) + 'コイン', 'gold'); checkAch({type:'jackpot'});
    }, 1700);
  } else if (res.bust) {
    cls += ' lose bust'; a.textContent = '破産!'; b.textContent = 'おこづかい +1,000'; c.textContent = '';
    flash(''); document.body.classList.add('lost'); sBust(); buzz(200);
    setTimeout(() => jockeySay(res.h, 'lose', 2600), 700);
  } else {
    cls += ' lose'; a.textContent = 'ハズレ'; b.textContent = '−' + fmt(res.bet);
    c.textContent = res.rank === 2 ? '惜しい!' + R.margin + 'の2着' : '';
    flash(''); document.body.classList.add('lost'); sLose();
    setTimeout(() => jockeySay(res.h, res.rank === 2 ? 'second' : 'lose', 2600), 600);
    if (res.lucky) setTimeout(() => showLucky(res.lucky), 900);
  }
  if (res.cross) setTimeout(() => {
    toast('大台突破! 所持コイン' + CROSS[res.cross], 'gold'); flash('gold'); coinRain(90); sHorn(); buzz([80, 40, 80, 40, 200]);
    if (!calm()) for (let i = 0; i < 6; i++) setTimeout(() => firework(0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.25, 48, 80), i * 160);
  }, res.jp ? 3400 : 2100);
  elPop.className = cls;
}
function shout(text, hue){
  const s = document.createElement('span');
  s.textContent = text;
  s.style.top = (14 + Math.random() * 52) + '%';
  s.style.color = 'hsl(' + hue + ' 95% 72%)';
  s.addEventListener('animationend', () => s.remove());
  elDan.appendChild(s);
  while (elDan.childElementCount > 16) elDan.firstElementChild.remove();
}
function ui(ps, now){
  const R = V.race;
  const multi = ps.filter(p => !p.away).length > 1;
  const canBet = V.ph === 'bet' && !V.late;
  const inRound = p => !!(p.pick && p.pick.n === V.n && p.pick.s === V.seed);
  const B = document.body.classList, quiet = calm();
  const live = V.ph === 'run' && !V.settled && !V.late;
  B.toggle('is-bet', V.ph === 'bet'); B.toggle('is-late', V.late);
  B.toggle('is-run', live);
  B.toggle('is-res', V.ph === 'run' && V.settled && !V.late);
  B.toggle('tense', live && (V.slow || !!(V.locked && V.locked.all)) && !quiet);
  B.toggle('slow', live && V.slow && !quiet);
  B.toggle('is-fever', S.streak >= 2 && !quiet);
  B.toggle('is-gold', !!R.gold && !quiet);
  B.toggle('calm', quiet);
  A.fever = S.streak >= 2;
  setText($('raceNo'), '第' + V.n + 'R');
  const fv = $('fever'), mult = streakMult(S.streak);
  fv.hidden = mult === 1; setText(fv, mult >= 1.5 ? 'FEVER 払戻×1.5' : '連勝ボーナス×1.2');
  const lv = lvOf(S.xp), base = lv > 1 ? xpNeed(lv - 1) : 0;
  setText($('lvText'), 'Lv.' + lv + ' ' + titleOf(lv));
  $('xpBar').style.width = (clamp((S.xp - base) / (xpNeed(lv) - base), 0, 1) * 100).toFixed(1) + '%';

  const myH = me.pick && inRound({pick:me.pick}) ? me.pick.h : 0;
  umaEls.forEach((el, i) => {
    const no = i + 1, pressed = String(no === myH);
    if (el.getAttribute('aria-pressed') !== pressed) el.setAttribute('aria-pressed', pressed);
    if (el.disabled !== !canBet) el.disabled = !canBet;
    const on = ps.filter(p => inRound(p) && p.pick.h === no);
    const sig = on.map(p => p.hue).slice(0, 5).join(',');
    if (voteSig[i] !== sig) {
      voteSig[i] = sig;
      el.lastElementChild.replaceChildren(...on.slice(0, 5).map(p => { const d = document.createElement('i'); d.style.background = 'hsl(' + p.hue + ' 85% 55%)'; return d; }));
    }
    // 3Dの名札
    const names = on.map(p => p.isMe ? 'あなた' : p.nick), tsig = names.join('|');
    if (tagSig[i] !== tsig && tagEls[i]) {
      tagSig[i] = tsig;
      tagEls[i].textContent = names.length ? names.slice(0, 2).join('・') + (names.length > 2 ? ' +' + (names.length - 2) : '') : '';
      tagEls[i].classList.toggle('mine', on.some(p => p.isMe));
    }
  });
  mapDots.forEach((d, i) => d.classList.toggle('mine', i + 1 === myHorseNo()));

  let text = '', fuse = 0;
  if (V.late) text = 'レース中。次のレースから賭けられます';
  else if (V.ph === 'bet') {
    const any = ps.some(inRound);
    if (!any) V.firstPick = 0; else if (!V.firstPick) V.firstPick = now;
    const left = any ? Math.max(0, GRACE_MS - (now - V.firstPick)) : GRACE_MS;
    const quick = !myH && now - V.betStart <= QUICK_MS;
    if (S.boost > 1 && !myH) text = '救済くじの効果で次の的中は×' + S.boost + '。';
    if (!multi) text = (text || '') + (quick ? '馬をタップで即発走。いまなら「秒で決断」×1.1' : A.ctx ? '馬をタップ。その瞬間に発走' : '馬をタップ。その瞬間に発走(BGMも鳴ります)');
    else if (myH) { text = '投票ずみ。全員そろうか、あと' + Math.ceil(left / 1000) + '秒で発走'; fuse = left / GRACE_MS; }
    else if (any) { text = '急げ!締切まで' + Math.ceil(left / 1000) + '秒'; fuse = left / GRACE_MS; }
    else text = '馬をタップで投票。全員そろうか、最初の1人から5秒で発走';
    if (R.gold) text = 'ゴールデンレース(払戻×2)。' + text;
  }
  setText($('callText'), text);
  $('call').classList.toggle('gold', !!R.gold);
  $('fuse').style.width = (fuse * 100).toFixed(1) + '%';
  document.querySelectorAll('.chip').forEach(c => {
    const on = String(String(S.bet) === c.dataset.bet);
    if (c.getAttribute('aria-pressed') !== on) c.setAttribute('aria-pressed', on);
  });

  const n = ps.length, netEl = $('net');
  netEl.classList.toggle('on', n > 1);
  setText(netEl, !net ? '接続の準備中' : n > 1 ? n + '人が同じレースに参加中' : (roomCode === 'lobby' ? 'みんなの部屋' : '部屋「' + roomCode + '」') + 'で待機中。URLを送ると合流できます');
  if (net && net.diag) {
    const d = net.diag();
    setText($('diag'), '合図の中継 Nostr ' + d.nostr.open + '/' + d.nostr.total + '・MQTT ' + d.mqtt.open + '/' + d.mqtt.total + ' 直結 ' + (d.links.nostr + d.links.mqtt) + '本' + (d.errors.length ? ' / ' + d.errors.slice(-3).join(' ') : ''));
  }
  setText($('btnRoom'), n > 1 ? '部屋 ' + n + '人' : '友だちを呼ぶ');
  if (n > 1 && !autoOpened) { autoOpened = true; if (window.innerWidth >= 900 && !roomOpen) $('btnRoom').click(); }
  setText($('jpVal'), fmt(S.jp));
  $('combo').dataset.n = String(S.combo); $('combo').classList.toggle('max', S.combo >= 5);
  $('recDot').hidden = !missionReady();
  const tb = ps.filter(p => p.tb > 0).sort((a, b) => b.tb - a.tb)[0];
  setText($('todayBest'), tb ? '本日の最高払戻:' + (tb.isMe ? 'あなた' : tb.nick) + ' +' + fmt(tb.tb) : '');

  const rows = ps.slice().sort((a, b) => (b.coins - a.coins) || (a.peer < b.peer ? -1 : 1));
  const sig = JSON.stringify(rows.map(p => [p.peer, p.nick, p.hue, p.coins, p.lv, p.away, p.sit, inRound(p) ? [p.pick.h, p.pick.bet] : 0, canBet]));
  if (sig !== plSig) {
    plSig = sig;
    elList.replaceChildren(...rows.map((p, i) => {
      const li = document.createElement('li'); if (p.isMe) li.className = 'me';
      const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = String(i + 1);
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = 'hsl(' + p.hue + ' 85% 55%)';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = p.nick;
      const y = document.createElement('small'); y.textContent = (p.isMe ? 'あなた ' : '') + 'Lv.' + p.lv; nm.appendChild(y);
      const pk = document.createElement('span'); pk.className = 'pk';
      if (inRound(p)) pk.append(badge(p.pick.h), document.createTextNode(fmt(p.pick.bet)));
      else pk.textContent = p.away ? '離席' : p.sit ? '見' : canBet ? '考え中' : '';
      const cn = document.createElement('span'); cn.className = 'cn'; cn.textContent = fmt(p.coins);
      li.append(rk, dot, nm, pk, cn);
      return li;
    }));
  }
}
// レース中の毎フレーム更新(順位・実況・コース図・払戻のカウントアップ)
function liveHud(now, racing, t, tau){
  if (!V.race) return;
  const R = V.race;
  for (let i = 0; i < 6; i++) {
    const p = racing ? Math.min(1.03, prog(R.hs[i], tau)) : 0;
    mapDots[i].style.left = (p / 1.03 * 100).toFixed(2) + '%';
  }
  if (V.payAnim) {
    const P = V.payAnim, k = clamp((now - P.t0) / P.dur, 0, 1), step = Math.floor(k * 14);
    setText($('popB'), '+' + fmt(Math.floor(P.from + (P.to - P.from) * (1 - Math.pow(1 - k, 3)))));
    if (step !== P.last) { P.last = step; sTick(k); }
    if (k >= 1) V.payAnim = null;
  }
  if (!racing) return;
  const key = h => tau >= h.T ? 10 - h.T : prog(h, tau);
  const sorted = R.hs.slice().sort((a, b) => key(b) - key(a));
  const leadNo = sorted[0].no, u = tau / R.tWin;
  const slow = t >= R.a && t < R.a + R.slowDisp;
  if (slow && !V.slow && !V.settled) {
    if (A.ctx) { A.mfilt.frequency.setTargetAtTime(380, A.ctx.currentTime, 0.07); if (S.bgm) A.music.gain.setTargetAtTime(0.12, A.ctx.currentTime, 0.08); }
    sRoll(); callout('勝負所!!', 'lead');
    if (V.omen) { setTimeout(() => { callout('激アツ!!', 'omen'); sOmen(); flash('rainbow'); buzz([120, 60, 120]); }, 150); }
    else if (V.chance) setTimeout(() => { callout('チャンス!', 'up'); sChance(); }, 150);
  }
  V.slow = slow;
  const myH = myHorseNo();
  if (!V.settled) {
    if (u >= 0.78 && !V.stretch) { V.stretch = true; castSay('最後の直線!先頭は' + leadNo + '番 ' + R.hs[leadNo - 1].name); cheer(0.16); }
    else if (leadNo !== V.lead && tau > 0.6) castSay(leadNo + '番 ' + R.hs[leadNo - 1].name + (V.lead ? ' かわして先頭!' : ' 先頭!'));
    if (slow && R.photo) castSay('これは際どい!写真判定か!');
  }
  V.lead = leadNo;
  const rk = $('rank'), si = $('stakeInfo');
  if (myH) {
    const h = R.hs[myH - 1], r = sorted.findIndex(x => x.no === myH) + 1, done = tau >= h.T;
    if (r !== V.myRank) {
      if (V.myRank && !done && tau > 0.5 && now - V.calloutAt > 320) {
        V.calloutAt = now;
        if (r < V.myRank) {
          if (r === 1) { callout('先頭だ!!', 'lead'); sLead(); flash('soft'); starBurst(0.16, 0.8, 16, 50); buzz([25, 25, 60]); jockeySay(myH, 'lead', 1500); }
          else { callout('↑ かわした! ' + r + '番手', 'up'); sRank(true); }
          addXp(2);
        } else { callout('↓ 抜かれた', 'down'); sRank(false); }
      }
      V.myRank = r; rk.classList.remove('bump'); void rk.offsetWidth; rk.classList.add('bump');
    }
    if (r === 1 && !done) { if (!V.leadSince) V.leadSince = now; } else V.leadSince = 0;
    A.lead = r === 1 && !done && !V.settled;
    setText(rk, done ? h.rank + '着' : r === 1 ? '先頭!!' : r + '番手'); rk.classList.toggle('first', r === 1);
    if (V.locked) setText(si, myH + '番に' + fmt(V.locked.bet) + (V.locked.all ? '(全ツッパ)' : '') + ' 当たれば +' + fmt(Math.floor(V.locked.bet * V.locked.odds * V.locked.mult)) + (V.locked.mult > 1 ? '(ボーナス×' + V.locked.mult + ')' : ''));
  } else { setText(rk, ''); setText(si, '見学中'); }
}

/* ================= ダイアログ(実績・ミッション・戦績・ログインボーナス) ================= */
const esc = t => String(t).replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[ch]));
let modalOpen = null, modalPrev = null, modalAfter = null, recTab = 'mis', achFilter = 'all';
function openModal(id, after){
  closeMenu();
  if (modalOpen) closeModal();
  const m = $(id);
  modalPrev = document.activeElement; modalAfter = after || null;
  m.hidden = false; modalOpen = m;
  setTimeout(() => { const f = m.querySelector('[aria-selected="true"]') || m.querySelector('.mbox button'); if (f) f.focus(); }, 0);
}
function closeModal(){
  if (!modalOpen) return;
  modalOpen.hidden = true; modalOpen = null;
  const after = modalAfter; modalAfter = null;
  try { if (modalPrev && modalPrev.focus) modalPrev.focus(); } catch (e) {}
  if (after) after();
}
function closeMenu(){ const m = $('menu'); if (m && !m.hidden) { m.hidden = true; $('btnMenu').setAttribute('aria-expanded', 'false'); } }
function setRecTab(tab){
  recTab = tab;
  for (const k of ['mis', 'ach', 'rec']) { $('t-' + k).setAttribute('aria-selected', String(k === tab)); $('t-' + k).tabIndex = k === tab ? 0 : -1; $('p-' + k).hidden = k !== tab; }
  if (tab === 'mis') renderMissions(); else if (tab === 'ach') renderAch(); else renderStats();
}
const pbar = (cur, goal) => '<span class="pbar"><i style="width:' + clamp(cur / goal * 100, 0, 100).toFixed(1) + '%"></i></span>';
function renderMissions(){
  ensureDaily();
  const lv = lvOf(S.xp), next = ACHD.unlocks.find(u => u.lv > lv);
  $('p-mis').innerHTML = '<p class="lead">毎日0時に3つ入れ替わります。宝箱の中身は開けるまでわかりません。</p><ul class="misList">' +
    S.daily.ids.map((id, i) => {
      const m = ACHD.missions.find(x => x.id === id) || {text:'?', goal:1}, p = S.daily.p[i], done = p >= m.goal, got = S.daily.c[i];
      return '<li class="mis' + (got ? ' got' : done ? ' ready' : '') + '"><div><b>' + esc(m.text) + '</b>' + pbar(p, m.goal) + '<small>' + p + ' / ' + m.goal + '</small></div>' +
        (got ? '<span class="claimed">受け取り済み</span>' : done ? '<button type="button" class="chest" data-claim="' + i + '">宝箱をあける</button>' : '<span class="chest locked" aria-label="未達成">宝箱</span>') + '</li>';
    }).join('') + '</ul>' +
    '<dl class="kvs"><div><dt>連続ログイン</dt><dd>' + S.login.streak + '日(最長 ' + (S.st.loginBest || 0) + '日)</dd></div>' +
    '<div><dt>コンボ</dt><dd>' + S.combo + ' / 5' + (S.combo >= 5 ? '(次のレース×1.3)' : '') + '</dd></div>' +
    '<div><dt>ジャックポット</dt><dd>' + fmt(S.jp) + 'コイン(払戻30倍以上の的中で獲得)</dd></div>' +
    '<div><dt>次の解放</dt><dd>' + (next ? 'Lv.' + next.lv + ':' + esc(next.name) : 'すべて解放済み') + '</dd></div></dl>';
}
function renderAch(){
  const c = {st:S.st, S, ev:{type:'none'}, lv:lvOf(S.xp)}, total = ACHD.list.length, got = ACHD.list.filter(a => S.ach[a.id]).length;
  setText($('achCount'), got + '/' + total);
  const tierCount = t => ACHD.list.filter(a => (a.hidden ? 'h' : a.tier) === t && S.ach[a.id]).length + '/' + ACHD.list.filter(a => (a.hidden ? 'h' : a.tier) === t).length;
  let html = '<div class="achTop"><p><b>' + got + '</b> / ' + total + ' 取得</p>' + pbar(got, total) +
    '<p class="tiers"><span class="m b">銅 ' + tierCount('b') + '</span><span class="m s">銀 ' + tierCount('s') + '</span><span class="m g">金 ' + tierCount('g') + '</span><span class="m h">隠し ' + tierCount('h') + '</span></p>' +
    '<div class="seg" role="group" aria-label="絞り込み">' + [['all', 'すべて'], ['got', '取得済み'], ['lock', '未取得']].map(f => '<button type="button" data-af="' + f[0] + '" aria-pressed="' + (achFilter === f[0]) + '">' + f[1] + '</button>').join('') + '</div></div>';
  for (const cat of ACHD.cats) {
    const all = ACHD.list.filter(a => a.cat === cat), list = all.filter(a => achFilter === 'all' || (achFilter === 'got') === !!S.ach[a.id]);
    if (!list.length) continue;
    html += '<h3>' + esc(cat) + ' <small>' + all.filter(a => S.ach[a.id]).length + '/' + all.length + '</small></h3><ul class="achList">' + list.map(a => {
      const own = !!S.ach[a.id], t = a.hidden ? 'h' : a.tier, secret = a.hidden && !own;
      let pr = '';
      if (!own && !secret && a.prog) { try { const v = a.prog(c); pr = pbar(v[0], v[1]) + '<small class="num">' + fmt(v[0]) + ' / ' + fmt(v[1]) + '</small>'; } catch (e) { pr = ''; } }
      return '<li class="ach ' + (own ? 'got' : 'lock') + '"><span class="m ' + t + '">' + (ACHD.tiers[t] || '') + '</span><div><b>' + (secret ? '？？？' : esc(a.name)) + '</b><small>' + (secret ? '条件はひみつ' : esc(a.desc)) + '</small>' + pr + '</div></li>';
    }).join('') + '</ul>';
  }
  $('p-ach').innerHTML = html;
}
function renderStats(){
  const st = S.st, lv = lvOf(S.xp);
  const top = o => { const e = Object.entries(o || {}).sort((a, b) => b[1] - a[1])[0]; return e || null; };
  const th = top(st.byHorse), tj = top(st.byJockey);
  const rows = [['出走', fmt(st.races || 0) + 'レース'], ['的中', fmt(st.wins || 0) + '回(' + (st.races ? ((st.wins || 0) / st.races * 100).toFixed(1) : '0.0') + '%)'],
    ['最高払戻', fmt(st.bestPay || 0) + 'コイン'], ['払戻の合計', fmt(st.totalPay || 0) + 'コイン'], ['最高所持', fmt(S.best) + 'コイン'],
    ['最長連勝', (st.maxStreak || 0) + '連勝'], ['最長連敗', (st.maxLose || 0) + '連敗'], ['破産', S.busts + '回'], ['ジャックポット', (st.jackpots || 0) + '回'],
    ['確定演出', (st.omens || 0) + '回'], ['推し馬', th && DATA && DATA.horses[th[0]] ? DATA.horses[th[0]].name + '(' + th[1] + '勝)' : '-'], ['相棒の騎手', tj ? tj[0] + '(' + tj[1] + '勝)' : '-'],
    ['ヤジ', fmt(st.stamps || 0) + '回']];
  $('p-rec').innerHTML = '<p class="lead">Lv.' + lv + ' ' + esc(titleOf(lv)) + '</p><dl class="kvs">' + rows.map(r => '<div><dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd></div>').join('') + '</dl>' +
    '<h3>レベルで解放</h3><ul class="unl">' + ACHD.unlocks.map(u => '<li class="' + (lv >= u.lv ? 'on' : '') + '"><span>Lv.' + u.lv + '</span>' + esc(u.name) + (lv >= u.lv ? '<b>解放済み</b>' : '') + '</li>').join('') + '</ul>' +
    '<p class="note"><a href="db.html">馬と騎手のデータを見る</a></p>';
}
function openTreasure(i, btn){
  const prize = claimMission(i);
  if (!prize) return;
  const box = document.createElement('div');
  box.className = 'chestOpen' + (prize.v >= 1500 ? ' big' : '');
  box.innerHTML = '<i aria-hidden="true"></i><b>' + esc(prize.label) + ' +' + fmt(prize.v) + '</b>';
  btn.replaceWith(box);
  sTreasure(); buzz([30, 30, 30, 30, 100]);
  setTimeout(() => { coinFly(prize.v >= 1500 ? 30 : 14); if (prize.v >= 1500) { coinRain(60); sHorn(); } }, 450);
  setTimeout(() => { if (recTab === 'mis' && modalOpen) renderMissions(); }, 2200);
}

/* ================= メインループ ================= */
let lastFrame = performance.now(), beatShown = -1;
// 確定のあと1.3秒だけ、ゴール前をもう一度スローで映す
function replayTau(t){
  const R = V.race;
  if (!R || V.ph !== 'run' || !V.settled || V.late || calm()) return null;
  const k = t - (R.tSettle + 0.5);
  return k < 0 || k > 1.3 ? null : R.tWin - 0.3 + k * 0.27;
}
function frame(){
  const now = performance.now(), dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const racing = V.ph === 'run' && !V.late;
  const t = racing ? (now - V.raceStart) / 1000 : 0;
  const tau = racing ? warp(V.race, t) : 0;
  if (racing && !V.settled && t >= V.race.tSettle) settle(false);
  beatFrame(now, dt);
  liveHud(now, racing, t, tau);
  const rp = replayTau(t);
  document.body.classList.toggle('replay', rp !== null);
  update3D(now, dt, racing, t, rp !== null ? rp : tau, rp !== null);
  const u = racing ? clamp(tau / V.race.tWin, 0, 1) : 0;
  drawFx(dt, racing, u);
  audioFrame(racing && !V.settled, racing && V.slow && !V.settled, u);
  const bq = Math.round(beat * 5);
  if (bq !== beatShown) { beatShown = bq; document.documentElement.style.setProperty('--beat', (bq / 5).toFixed(1)); }
  if (Math.abs(S.coins - shownCoins) > 0.5) shownCoins += (S.coins - shownCoins) * 0.14; else shownCoins = S.coins;
  setText(elCoins, fmt(shownCoins));
  requestAnimationFrame(frame);
}

/* ================= 起動 ================= */
function inviteUrl(code){
  const u = new URL(window.location.href);
  u.hash = '';
  u.searchParams.delete('relay');
  if (code === 'lobby') u.searchParams.delete('room'); else u.searchParams.set('room', code);
  return u.toString();
}
function start(){
  let stored = null;
  try { stored = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  adopt(stored);
  if (!S.nick) { S.nick = 'ドパガキ' + (100 + Math.floor(Math.random() * 900)); S.hue = Math.floor(Math.random() * 360); }
  shownCoins = S.coins;
  save();
  try {
    const q = new URLSearchParams(window.location.search).get('room');
    if (q) { const c = q.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16); if (c) roomCode = c; }
    // 開発用:自分のPCで動かしたMQTTブローカーだけを使う(?relay=ws://localhost:1884)
    const rl = new URLSearchParams(window.location.search).get('relay');
    if (rl && /^ws:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/.test(rl)) netOpts = {mqttUrls:[rl], nostrUrls:[]};
  } catch (e) {}

  try { G = init3D(); } catch (e) { G = null; }
  if (!G) document.body.classList.add('no3d');
  buildMap();

  $('nick').value = S.nick;
  $('nick').addEventListener('input', e => { S.nick = clean(e.target.value) || 'ななし'; save(); pushPresence(); });
  const paintTools = () => {
    $('btnBgm').setAttribute('aria-pressed', String(S.bgm)); setText($('btnBgm'), 'BGM:' + (S.bgm ? 'オン' : 'オフ'));
    $('btnSfx').setAttribute('aria-pressed', String(S.sfx)); setText($('btnSfx'), '効果音:' + (S.sfx ? 'オン' : 'オフ'));
    $('btnFx').setAttribute('aria-pressed', String(!S.calm)); setText($('btnFx'), '演出:' + (S.calm ? 'ひかえめ' : '全開'));
    $('btnTts').setAttribute('aria-pressed', String(S.tts)); setText($('btnTts'), '実況の読み上げ:' + (S.tts ? 'オン' : 'オフ'));
    $('btnRoom').setAttribute('aria-pressed', String(roomOpen)); document.body.classList.toggle('room-open', roomOpen);
    if (A.ctx) { A.music.gain.setTargetAtTime(S.bgm ? 0.55 : 0, A.ctx.currentTime, 0.03); A.sfx.gain.setTargetAtTime(S.sfx ? 0.9 : 0, A.ctx.currentTime, 0.03); }
  };
  $('btnBgm').addEventListener('click', () => { S.bgm = !S.bgm; save(); audioUnlock(); paintTools(); });
  $('btnSfx').addEventListener('click', () => { S.sfx = !S.sfx; save(); audioUnlock(); paintTools(); sClick(); });
  $('btnFx').addEventListener('click', () => { S.calm = !S.calm; save(); paintTools(); sClick(); });
  $('btnTts').addEventListener('click', () => { S.tts = !S.tts; save(); paintTools(); if (S.tts) speak('実況をオンにしました', true); else try { window.speechSynthesis.cancel(); } catch (e) {} });
  $('btnRoom').addEventListener('click', () => { roomOpen = !roomOpen; closeMenu(); paintTools(); });
  $('roomClose').addEventListener('click', () => { roomOpen = false; paintTools(); $('btnRoom').focus(); });
  $('btnMenu').addEventListener('click', e => { e.stopPropagation(); const m = $('menu'); m.hidden = !m.hidden; $('btnMenu').setAttribute('aria-expanded', String(!m.hidden)); if (!m.hidden) { const f = m.querySelector('button'); if (f) f.focus(); } });
  $('btnAbout').addEventListener('click', () => { closeMenu(); if (window.FKAbout) window.FKAbout.open(); });
  $('btnRec').addEventListener('click', () => { setRecTab(missionReady() ? 'mis' : recTab); openModal('rec'); });
  for (const k of ['mis', 'ach', 'rec']) $('t-' + k).addEventListener('click', () => setRecTab(k));
  $('rec').querySelector('.tabs').addEventListener('keydown', e => {
    const order = ['mis', 'ach', 'rec'], i = order.indexOf(recTab);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const k = order[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; setRecTab(k); $('t-' + k).focus(); }
  });
  $('rec').addEventListener('click', e => {
    const cl = e.target.closest('[data-claim]'), af = e.target.closest('[data-af]');
    if (cl) openTreasure(Number(cl.dataset.claim), cl);
    else if (af) { achFilter = af.dataset.af; renderAch(); const again = $('p-ach').querySelector('[data-af="' + achFilter + '"]'); if (again) again.focus(); }
  });
  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) closeModal();
    else if (modalOpen && e.target === modalOpen) closeModal();
    if (!e.target.closest('#menu') && !e.target.closest('#btnMenu')) closeMenu();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { if (modalOpen) closeModal(); else closeMenu(); return; }
    if (e.key === 'Tab' && modalOpen) {   // ダイアログの外にフォーカスを出さない
      const f = Array.from(modalOpen.querySelectorAll('button, a[href], input')).filter(x => !x.disabled && x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  paintTools();
  document.querySelectorAll('.chip').forEach(c => c.addEventListener('click', () => setBet(c.dataset.bet === 'all' ? 'all' : Number(c.dataset.bet))));
  $('stamps').replaceChildren(...STAMPS.map((s, k) => {
    const b = document.createElement('button'); b.type = 'button'; b.id = 'stamp' + k; b.textContent = s;
    b.addEventListener('click', () => stamp(k));
    return b;
  }));
  $('btnCopy').addEventListener('click', () => {
    const url = inviteUrl(roomCode), btn = $('btnCopy'), box = $('inviteUrl');
    const done = ok => { setText(btn, ok ? 'コピーしました' : '下のURLを共有'); if (!ok) { box.hidden = false; box.value = url; box.focus(); box.select(); } setTimeout(() => setText(btn, '招待リンクをコピー'), 1800); };
    try { navigator.clipboard.writeText(url).then(() => done(true), () => done(false)); } catch (e) { done(false); }
  });
  $('btnNew').addEventListener('click', () => {
    const code = Array.from({length:6}, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
    window.location.href = inviteUrl(code);
  });
  document.addEventListener('keydown', e => {
    if ((e.target && e.target.tagName === 'INPUT') || modalOpen || document.querySelector('.fka-back')) return;
    if (e.key >= '1' && e.key <= '6' && !e.ctrlKey && !e.metaKey && !e.altKey) pick(Number(e.key));
  });
  document.addEventListener('pointerdown', audioUnlock, {passive:true});
  document.addEventListener('visibilitychange', () => {
    me.away = document.hidden;
    if (me.away) me.g = null;
    pushPresence(); tick();
  });
  const onResize = () => { resize3D(); resizeFx(); };
  window.addEventListener('resize', onResize);
  onResize();
  // ヘッダーと投票パネルの高さに合わせて、ほかの表示の位置をずらす
  const root = document.documentElement.style, topEl = $('top'), sheetEl = $('sheet');
  const measure = () => { root.setProperty('--hud-top', topEl.offsetHeight + 'px'); root.setProperty('--sheet-h', sheetEl.offsetHeight + 'px'); };
  if (window.ResizeObserver) { const ro = new ResizeObserver(measure); ro.observe(topEl); ro.observe(sheetEl); }
  window.addEventListener('resize', measure);
  measure();
  ensureDaily();
  try { if (localStorage.getItem('fastkeiba.dbseen') === '1') checkAch({type:'boot', dbSeen:true}); } catch (e) {}
  checkAch({type:'boot'});
  // 初めての人にはジョークサイトの告知を出し、閉じたらログインボーナス
  const afterAbout = v => { if (v === 'calm') { S.calm = true; save(); paintTools(); } setTimeout(loginBonus, v === 'seen' ? 500 : 150); };
  if (window.FKAbout) window.FKAbout.ready.then(afterAbout); else afterAbout('seen');
  tick();
  setInterval(tick, 100);
  requestAnimationFrame(frame);
}
// 動作確認用(?debug=1 のときだけ)。コインは元々自己申告なので、これで困ることはない
if (/[?&]debug=1/.test(window.location.search)) window.__fk = {get G(){ return G; }, V, me, S, checkAch, showLucky, celebrate, rollLucky, openModal, setRecTab};
start();
})();
