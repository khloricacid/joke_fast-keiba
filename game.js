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
  {bg:'#f7f7f2',fg:'#16130f'},{bg:'#1b1b1b',fg:'#ffffff'},{bg:'#e5252c',fg:'#ffffff'},
  {bg:'#1f5fd1',fg:'#ffffff'},{bg:'#ffd60a',fg:'#16130f'},{bg:'#12a150',fg:'#ffffff'}
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
const STAMPS = ['うおおお','草','は?','神','差せ!','そのまま!'];
const GRACE_MS = 5000;                  // 最初の1人が賭けてから締切までの時間
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
    hs.push({no:i + 1, name:NAMES[idx[i]], w, coat:Math.floor(r() * COATS.length), mark:''});
  }
  for (const h of hs) { h.p = h.w / sum; h.odds = Math.min(99.9, Math.max(1.1, Math.round(0.94 / h.p * 10) / 10)); }
  const fav = hs.slice().sort((a, b) => (b.p - a.p) || (a.no - b.no));
  ['◎','○','▲','△'].forEach((m, i) => { fav[i].mark = m; });
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
    const s = r();
    h.k = 0.9 + s * 0.25;
    h.style = s < 0.25 ? '逃げ' : s < 0.5 ? '先行' : s < 0.78 ? '差し' : '追込';
    h.amp = 0.012 + r() * 0.02; h.fq = 1 + r() * 1.5; h.ph = r() * 6.28;
  }
  const margin = gap1 < 0.05 ? 'ハナ差' : gap1 < 0.085 ? 'アタマ差' : gap1 < 0.13 ? 'クビ差' : gap1 < 0.2 ? '半馬身差' : gap1 < 0.29 ? '1馬身差' : '2馬身差';
  const tWin = hs[order[0] - 1].T, a = tWin - SL_PRE, slowDisp = (SL_PRE + SL_POST) / SL_RATE;
  return {seed, hs, order, margin, photo:gap1 < 0.05, tWin, a, slowDisp,
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
const S = {coins:1000, nick:'', hue:0, bet:100, bgm:true, sfx:true, streak:0, best:1000, busts:0};
function clean(s){ return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁯]/g, '').slice(0, 10); }
function adopt(d){
  if (!d || typeof d !== 'object') return;
  if (Number.isFinite(d.coins) && d.coins > 0) S.coins = Math.min(1e12, Math.floor(d.coins));
  if (typeof d.nick === 'string' && clean(d.nick)) S.nick = clean(d.nick);
  if (Number.isFinite(d.hue)) S.hue = ((Math.floor(d.hue) % 360) + 360) % 360;
  if (d.bet === 'all' || d.bet === 10 || d.bet === 100 || d.bet === 500) S.bet = d.bet;
  if (typeof d.bgm === 'boolean') S.bgm = d.bgm;
  if (typeof d.sfx === 'boolean') S.sfx = d.sfx;
  if (Number.isFinite(d.streak)) S.streak = Math.max(0, Math.floor(d.streak));
  if (Number.isFinite(d.best)) S.best = Math.max(S.coins, Math.floor(d.best));
  if (Number.isFinite(d.busts)) S.busts = Math.max(0, Math.floor(d.busts));
}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
const streakMult = s => s >= 2 ? 1.5 : s === 1 ? 1.2 : 1;

/* ================= ゲーム進行 ================= */
const PID = Array.from({length:12}, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');
const me = {pick:null, sit:false, missed:0, away:document.hidden, g:null, emo:null};
const V = {n:0, seed:-1, ph:'idle', race:null, betStart:0, firstPick:0, raceStart:0, settled:false, settledAt:0, late:false, locked:null, res:null,
  lead:0, slow:false, stretch:false, myRank:0};
let lastG = null, hostPhaseAt = 0, hostFirstPick = 0, dirty = false, lastSent = 0;
let net = null, roomCode = 'lobby', netOpts = null;
const others = new Map(), linkPid = new Map(), seenPeers = new Set(), emoSeen = new Map();

const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
const vG = g => (g && typeof g === 'object' && isInt(g.n, 1, 1e9) && isInt(g.seed, 0, 4294967295) && (g.ph === 'bet' || g.ph === 'run') && Number.isFinite(g.hs)) ? {n:g.n, seed:g.seed, ph:g.ph, hs:g.hs} : null;
const vPick = p => (p && typeof p === 'object' && isInt(p.n, 1, 1e9) && isInt(p.s, 0, 4294967295) && isInt(p.h, 1, 6) && isInt(p.bet, 1, 1e12)) ? {n:p.n, s:p.s, h:p.h, bet:p.bet} : null;
const vEmo = e => (e && typeof e === 'object' && isInt(e.k, 0, STAMPS.length - 1) && Number.isFinite(e.t)) ? {k:e.k, t:e.t} : null;
const newSeed = () => (Math.random() * 4294967296) >>> 0;

function myState(){
  return {pid:PID, fk:2, nick:S.nick, hue:S.hue, coins:S.coins, streak:S.streak,
    pick:me.pick, sit:me.sit, away:me.away, g:me.g, emo:me.emo};
}
function pushPresence(){
  dirty = false; lastSent = performance.now();
  if (net) { try { net.send(myState()); } catch (e) {} }
}
function players(now){
  const out = [{peer:PID, isMe:true, nick:S.nick, hue:S.hue, coins:S.coins, streak:S.streak,
    pick:me.pick, sit:me.sit, away:me.away, g:me.g, emo:me.emo}];
  for (const [pid, o] of others) {
    if (now - o.seen > 7000) { others.delete(pid); continue; }
    const s = o.st;
    if (!s || s.fk !== 2) continue;
    out.push({peer:pid, isMe:false, nick:clean(s.nick) || 'ななし',
      hue:Number.isFinite(s.hue) ? ((Math.floor(s.hue) % 360) + 360) % 360 : 0,
      coins:Number.isFinite(s.coins) ? clamp(Math.floor(s.coins), 0, 1e12) : 0,
      streak:isInt(s.streak, 0, 1e6) ? s.streak : 0,
      pick:vPick(s.pick), sit:!!s.sit, away:!!s.away, g:vG(s.g), emo:vEmo(s.emo)});
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
    if (el >= dur + (visible.length > 1 ? 2600 : 2000)) {
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
    V.lead = 0; V.slow = false; V.stretch = false; V.myRank = 0;
    if (me.pick && !(me.pick.n === g.n && me.pick.s === g.seed)) { me.pick = null; dirty = true; }
    if (g.ph === 'run') { V.ph = 'run'; V.late = true; V.settled = true; }
    renderRound();
    audioMode(0);
  }
  if (g.ph === 'run' && V.ph === 'bet') startRace(now);
}
function startRace(now){
  V.ph = 'run'; V.raceStart = now;
  if (me.pick) {
    const bet = Math.min(me.pick.bet, S.coins);
    if (bet > 0) {
      const mult = streakMult(S.streak);
      V.locked = {h:me.pick.h, bet, odds:V.race.hs[me.pick.h - 1].odds, mult, all:bet >= S.coins};
      S.coins -= bet;
    }
    me.missed = 0;
  } else {
    me.missed++;
    if (me.missed >= 2 && !me.sit) me.sit = true;
  }
  dirty = true;
  setText($('caster'), 'スタートしました!');
  kick3D(1);
  flash(false);
  sGate();
  audioMode(1);
}
function settle(forced){
  V.settled = true; V.settledAt = performance.now();
  const R = V.race, win = R.order[0];
  let res = null;
  if (V.locked) {
    if (V.locked.h === win) {
      const pay = Math.floor(V.locked.bet * V.locked.odds * V.locked.mult);
      S.coins = Math.min(1e12, S.coins + pay); S.streak++;
      res = {type:'win', pay, odds:V.locked.odds, mult:V.locked.mult};
    } else {
      S.streak = 0;
      res = {type:'lose', bet:V.locked.bet, rank:R.hs[V.locked.h - 1].rank};
      if (S.coins <= 0) { S.coins = 1000; S.busts++; res.bust = true; }
    }
    S.best = Math.max(S.best, S.coins);
    save();
  }
  V.res = res;
  renderBoard();
  if (!forced) celebrate(res);
  pushPresence();
}
function tick(){
  const now = performance.now();
  netOpen();
  const ps = players(now);
  const host = elect(ps);
  if (host && host.isMe) drive(ps, now);
  else if (me.g) { me.g = null; dirty = true; }
  const g = host ? (host.isMe ? me.g : host.g) : null;
  if (g) observe(g, now);
  for (const p of ps) {
    if (p.isMe) continue;
    const t = p.emo ? p.emo.t : undefined;
    if (!seenPeers.has(p.peer)) seenPeers.add(p.peer);
    else if (p.emo && emoSeen.get(p.peer) !== t) shout(STAMPS[p.emo.k], p.hue);
    emoSeen.set(p.peer, t);
  }
  if (dirty || now - lastSent > 1800) pushPresence();
  ui(ps, now);
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
  me.pick = {n:V.n, s:V.seed, h:no, bet};
  me.sit = false; me.missed = 0;
  sPick();
  pushPresence();
  tick();
}
function setBet(b){
  audioUnlock();
  S.bet = b; save();
  if (me.pick && V.ph === 'bet') { me.pick = {n:me.pick.n, s:me.pick.s, h:me.pick.h, bet:Math.max(1, stakeNow())}; pushPresence(); }
  sClick();
  tick();
}
function stamp(k){
  audioUnlock();
  const e = {k, t:Date.now()};
  me.emo = e;
  shout(STAMPS[k], S.hue);
  sClick();
  pushPresence();
  setTimeout(() => { if (me.emo === e) { me.emo = null; pushPresence(); } }, 3000);
}

/* ================= 音(BGMも効果音もその場で合成) ================= */
const A = {ctx:null, master:null, music:null, mfilt:null, sfx:null, crowd:null, noise:null, step:0, nextT:0, mode:0, gallopAt:0, heartAt:0};
const BPM = 168, STEP = 60 / BPM / 4;
const CH = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];           // Am F C G
const MEL = [
  [76,0,76,79, 0,81,0,79, 76,0,74,0, 76,0,0,0],
  [77,0,77,81, 0,84,0,81, 77,0,76,0, 77,0,0,0],
  [79,0,79,84, 0,88,0,84, 79,0,76,0, 79,0,0,0],
  [74,0,79,83, 0,86,0,83, 79,0,81,0, 83,0,86,0]
];
const LOBBY = [[69,0,0,72, 0,0,76,0], [69,0,0,72, 0,0,77,0], [67,0,0,72, 0,0,76,0], [67,0,0,71, 0,0,74,0]];
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
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
function hiss(dest, t, dur, vol, type, freq, q){
  const ctx = A.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = A.noise; s.loop = true;
  f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.03);
}
function sequencer(){
  const ctx = A.ctx;
  if (!ctx || ctx.state !== 'running') return;
  if (A.nextT < ctx.currentTime) A.nextT = ctx.currentTime + 0.05;
  while (A.nextT < ctx.currentTime + 0.16) {
    if (S.bgm && !document.hidden) musicStep(A.step, A.nextT);
    A.step++; A.nextT += STEP;
  }
}
function musicStep(i, t){
  const bar = Math.floor(i / 16) % 4, s = i % 16, ch = CH[bar], hi = A.mode === 1, m = A.music;
  if (hi ? s % 4 === 0 : (s === 0 || s === 10)) tone(m, 'sine', 150, t, 0.16, hi ? 0.95 : 0.6, 42);            // キック
  if (hi && (s === 4 || s === 12)) { hiss(m, t, 0.13, 0.42, 'bandpass', 1900, 0.8); tone(m, 'triangle', 190, t, 0.08, 0.25, 120); }   // スネア
  if (hi || s % 2 === 0) hiss(m, t, s % 4 === 2 ? 0.07 : 0.03, (s % 4 === 2 ? 0.2 : 0.11) * (hi ? 1 : 0.7), 'highpass', 7500, 0.7);       // ハット
  if (s % 2 === 0) tone(m, hi ? 'sawtooth' : 'triangle', mtof(ch[0] - 24 + (s % 4 === 2 ? 12 : 0)), t, STEP * 1.8, hi ? 0.2 : 0.3);       // ベース
  tone(m, hi ? 'square' : 'triangle', mtof(ch[[0, 1, 2, 1][s % 4]] + 12 + (hi && s % 8 >= 4 ? 12 : 0)), t, STEP * 0.9, hi ? 0.05 : 0.07); // アルペジオ
  if (hi) { const n = MEL[bar][s]; if (n) tone(m, 'sawtooth', mtof(n), t, STEP * 1.9, 0.085); }
  else if (s % 2 === 0) { const n = LOBBY[bar][s / 2]; if (n) tone(m, 'sine', mtof(n), t, STEP * 3.5, 0.1); }
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
function sPick(){ if (sfxOK()) { const t = A.ctx.currentTime; tone(A.sfx, 'square', 880, t, 0.06, 0.1); tone(A.sfx, 'square', 1320, t + 0.06, 0.09, 0.1); } }
function sGate(){ if (sfxOK()) { const t = A.ctx.currentTime; hiss(A.sfx, t, 0.22, 0.7, 'bandpass', 2400, 1.2); tone(A.sfx, 'sine', 120, t, 0.3, 0.8, 38); } }
function sCoin(){ if (sfxOK()) tone(A.sfx, 'sine', 1700 + Math.random() * 900, A.ctx.currentTime, 0.07, 0.07); }
function sRank(up){ if (sfxOK()) { const t = A.ctx.currentTime; tone(A.sfx, 'triangle', up ? 660 : 440, t, 0.07, 0.16, up ? 990 : 330); } }
function sGoal(){ if (sfxOK()) { const t = A.ctx.currentTime; hiss(A.sfx, t, 0.9, 0.5, 'highpass', 3000, 0.5); tone(A.sfx, 'sine', 90, t, 0.5, 0.9, 30); } }
function sWin(big){
  if (!sfxOK()) return;
  const t = A.ctx.currentTime;
  [72, 76, 79, 84, 88].forEach((n, i) => { tone(A.sfx, 'square', mtof(n), t + i * 0.07, 0.16, 0.11); tone(A.sfx, 'triangle', mtof(n - 12), t + i * 0.07, 0.2, 0.14); });
  if (big) [84, 88, 91, 96, 100, 103].forEach((n, i) => tone(A.sfx, 'square', mtof(n), t + 0.4 + i * 0.06, 0.2, 0.09));
  [72, 76, 79].forEach(n => tone(A.sfx, 'sawtooth', mtof(n), t + (big ? 0.8 : 0.4), 0.7, 0.06));
  A.crowd.gain.cancelScheduledValues(t);
  A.crowd.gain.setValueAtTime(big ? 0.4 : 0.26, t);
  A.crowd.gain.setTargetAtTime(0.012, t + 0.6, 0.7);
}
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

/* ================= 3D ================= */
let G = null;
function canvasTex(w, h, paint){
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  return new THREE.CanvasTexture(c);
}
function init3D(){
  const T = window.THREE;
  if (!T) return null;
  const canvas = $('gl');
  const renderer = new T.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new T.Scene();
  scene.fog = new T.Fog(0x1a1438, 60, 430);
  scene.background = canvasTex(4, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#040618'); g.addColorStop(0.38, '#0d1238'); g.addColorStop(0.5, '#3a1d5c'); g.addColorStop(0.56, '#c2415a'); g.addColorStop(0.6, '#1a1438'); g.addColorStop(1, '#0a0e24');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const camera = new T.PerspectiveCamera(50, 1, 0.1, 900);
  scene.add(new T.HemisphereLight(0xaab4ff, 0x1c4a2a, 0.85));
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
  // 看板(奥側)
  const adCols = [0xff2d3d, 0xffd60a, 0x1f5fd1, 0xf6f4ec, 0x12a150, 0xff7a1a, 0xb14cff];
  for (let x = X0 + 8, i = 0; x < X1; x += 14, i++) add(new T.BoxGeometry(12.4, 1.5, 0.2), new T.MeshLambertMaterial({color:adCols[i % adCols.length], emissive:adCols[i % adCols.length], emissiveIntensity:0.35}), x, 0.95, -11.2);
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
  // 発馬機
  const gate = lam(0x24306b);
  for (let i = 0; i <= 6; i++) add(new T.BoxGeometry(0.16, 2.8, 0.16), gate, -1.9, 1.4, (i - 3) * 2.4);
  add(new T.BoxGeometry(0.5, 0.4, 15), gate, -1.9, 2.9, 0);
  // ゴール
  const gl = add(new T.PlaneGeometry(0.6, 17.4), new T.MeshBasicMaterial({color:0xffffff}), TL, 0.03, 0); gl.rotation.x = -Math.PI / 2;
  for (const z of [-9.4, 9.4]) add(new T.BoxGeometry(0.6, 7.4, 0.6), white, TL, 3.7, z);
  add(new T.BoxGeometry(1, 1.6, 19.4), new T.MeshLambertMaterial({color:0xff2d3d, emissive:0xff2d3d, emissiveIntensity:0.6}), TL, 7.6, 0);
  const goalTex = canvasTex(512, 64, (c, w, h) => { c.fillStyle = '#ff2d3d'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = '900 52px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('G O A L', w / 2, h / 2 + 3); });
  const gb = add(new T.PlaneGeometry(18, 1.5), new T.MeshBasicMaterial({map:goalTex}), TL - 0.52, 7.6, 0); gb.rotation.y = -Math.PI / 2;

  // 馬
  const horses = [];
  for (let no = 1; no <= 6; no++) horses.push(makeHorse(T, scene, no));
  // 砂ぼこり
  const DN = 360, dpos = new Float32Array(DN * 3).fill(-999), dgeo = new T.BufferGeometry();
  dgeo.setAttribute('position', new T.BufferAttribute(dpos, 3));
  const dust = new T.Points(dgeo, new T.PointsMaterial({color:0x0f5a2c, size:0.2, transparent:true, opacity:0.9, depthWrite:false}));
  dust.frustumCulled = false; scene.add(dust);
  const dvel = new Float32Array(DN * 3), dlife = new Float32Array(DN);

  const g3 = {T, renderer, scene, camera, horses, dust:{pos:dpos, vel:dvel, life:dlife, geo:dgeo, n:DN, i:0},
    shot:'', cam:new T.Vector3(8, 2.4, 10), look:new T.Vector3(0, 1.4, 0), kick:0, sheetVis:1, W:1, H:1};
  return g3;
}
function makeHorse(T, scene, no){
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
  // 自分の馬の目印
  const marker = new T.Mesh(new T.ConeGeometry(0.6, 1.1, 4), new T.MeshBasicMaterial({color:0xffd60a, fog:false}));
  marker.rotation.x = Math.PI; marker.position.y = 4.1; marker.visible = false; g.add(marker);
  const beam = new T.Mesh(new T.CylinderGeometry(0.12, 0.5, 5, 8, 1, true), new T.MeshBasicMaterial({color:0xffe45c, transparent:true, opacity:0.32, blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide, fog:false}));
  beam.position.y = 6.9; beam.visible = false; g.add(beam);
  const z = (no - 3.5) * 2.4;
  g.position.set(0, 0, z);
  scene.add(g);
  return {no, g, z, x:0, p:0, torso, neck, tail, legs, jk, marker, beam, mBody, mDark};
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
function update3D(now, dt, racing, t, tau){
  if (!G || !V.race) return;
  const R = V.race, cam = G.camera, myH = myHorseNo();
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
    if (isMine) { H.marker.position.y = 4.1 + Math.sin(now / 150) * 0.2; H.marker.rotation.y = now / 260; mine = H.x; }
    xs.push(H.x); if (H.x > lead) lead = H.x;
    // 砂ぼこり
    if (racing && run > 0.5 && !reduced && Math.random() < 0.7) {
      const d = G.dust, i = d.i; d.i = (d.i + 1) % d.n;
      d.pos[i * 3] = H.x - 0.9; d.pos[i * 3 + 1] = 0.12; d.pos[i * 3 + 2] = H.z + (Math.random() - 0.5) * 0.5;
      d.vel[i * 3] = -3 - Math.random() * 5; d.vel[i * 3 + 1] = 1.5 + Math.random() * 2.5; d.vel[i * 3 + 2] = (Math.random() - 0.5) * 2;
      d.life[i] = 0.55;
    }
  }
  const d = G.dust, rate = racing && V.slow ? SL_RATE : 1;
  for (let i = 0; i < d.n; i++) {
    if (d.life[i] <= 0) continue;
    d.life[i] -= dt * rate;
    if (d.life[i] <= 0) { d.pos[i * 3 + 1] = -999; continue; }
    d.pos[i * 3] += d.vel[i * 3] * dt * rate; d.pos[i * 3 + 1] += d.vel[i * 3 + 1] * dt * rate; d.pos[i * 3 + 2] += d.vel[i * 3 + 2] * dt * rate;
    d.vel[i * 3 + 1] -= 6 * dt * rate;
  }
  d.geo.attributes.position.needsUpdate = true;

  // カメラ
  xs.sort((a, b) => b - a);
  const pack = (xs[0] + xs[1] + xs[2]) / 3;
  const focus = myH ? pack * 0.55 + mine * 0.45 : pack;
  let id, px, py, pz, lx, ly, lz, fov, ease = 0;
  const far = cam.aspect < 1 ? 1.45 : 1;       // 縦長の画面では横からのカメラを引く
  if (!racing) {
    const s = now / 1000, mz = myH ? G.horses[myH - 1].z : 0;
    id = 'I'; px = 9 + Math.sin(s * 0.25) * 2.2; py = 2.3 + Math.sin(s * 0.4) * 0.25; pz = 10.5 - Math.cos(s * 0.25) * 1.2;
    lx = 0.4; ly = 1.35; lz = mz * 0.35; fov = 44; ease = 3;
  } else if (V.settled && t > R.tSettle + 0.3) {
    const w = G.horses[R.order[0] - 1], s = t - R.tSettle, ang = -0.95 + s * 0.3;
    id = 'E'; px = w.x + Math.cos(ang) * 8.5; pz = w.z - Math.sin(ang) * 8.5; py = 2 + s * 0.2; lx = w.x; ly = 1.7; lz = w.z; fov = 38; ease = 6;
  } else {
    const u = tau / R.tWin;
    if (u < 0.2) { id = 'A'; px = focus - 8.5; py = 2.7; pz = 2.2; lx = focus + 10; ly = 1.3; lz = 0; fov = 62; }
    else if (u < 0.5) { id = 'B'; px = focus + 5 / far; py = 3.1 * far; pz = 14 * far; lx = focus + 1.2; ly = 1.2; lz = 0; fov = 44; }
    else if (u < 0.78) { id = 'C'; px = lead + 15; py = 1.7; pz = 3.2; lx = focus; ly = 1.6; lz = -0.6; fov = 38; }
    else { const cx = Math.min(lead + 2, TL - 4), k = clamp((t - R.a) / 1.5, 0, 1); id = 'D'; px = cx; py = 3.0 * far; pz = 14.5 * far; lx = cx + 3.4; ly = 1.2; lz = 0; fov = 50 - 14 * k; }
  }
  if (id !== G.shot || !ease) { G.shot = id; G.cam.set(px, py, pz); G.look.set(lx, ly, lz); }
  else { const f = 1 - Math.exp(-dt * ease); G.cam.x += (px - G.cam.x) * f; G.cam.y += (py - G.cam.y) * f; G.cam.z += (pz - G.cam.z) * f; G.look.x += (lx - G.look.x) * f; G.look.y += (ly - G.look.y) * f; G.look.z += (lz - G.look.z) * f; }
  G.kick *= Math.exp(-dt * 4.5);
  const amp = reduced ? 0 : (racing && !V.settled ? 0.035 : 0) + G.kick * 0.3;
  cam.position.set(G.cam.x + (Math.random() - 0.5) * amp, G.cam.y + (Math.random() - 0.5) * amp, G.cam.z + (Math.random() - 0.5) * amp);
  cam.lookAt(G.look);
  const asp = cam.aspect;
  cam.fov = asp >= 1.3 ? fov : Math.min(100, fov * (1 + (1.3 - asp) * 0.75));
  // 下の投票パネルに隠れないよう、画面の中心を上へずらす
  const want = (V.ph === 'bet' || V.late) ? 1 : 0;
  G.sheetVis += (want - G.sheetVis) * (1 - Math.exp(-dt * 9));
  const off = Math.round($('sheet').offsetHeight * 0.42 * G.sheetVis);
  if (off > 1) cam.setViewOffset(G.W, G.H, 0, off, G.W, G.H); else { if (cam.view) cam.clearViewOffset(); cam.updateProjectionMatrix(); }
  G.renderer.render(G.scene, cam);
}

/* ================= 画面エフェクト(集中線・紙吹雪・コイン) ================= */
const fx = $('fx'), fctx = fx.getContext('2d');
let parts = [], coinsFx = [], fxDirty = false, burst = 0;
function resizeFx(){ fx.width = window.innerWidth; fx.height = window.innerHeight; }
function confetti(n){
  if (reduced) return;
  const W = fx.width, H = fx.height, cols = ['#ffd60a', '#ff2d3d', '#f6f4ec', '#1f5fd1', '#12a150'];
  for (let i = 0; i < n; i++) parts.push({x:W * (0.15 + Math.random() * 0.7), y:H * 0.45, vx:(Math.random() - 0.5) * 22, vy:-6 - Math.random() * 16,
    w:6 + Math.random() * 8, rot:Math.random() * 6.28, vr:(Math.random() - 0.5) * 0.6, c:cols[i % cols.length], life:90 + Math.random() * 60});
}
function coinRain(n){
  if (reduced) return;
  const r = $('wallet').getBoundingClientRect(), W = fx.width, H = fx.height;
  for (let i = 0; i < n; i++) coinsFx.push({x0:W / 2 + (Math.random() - 0.5) * W * 0.4, y0:H * 0.5 + (Math.random() - 0.5) * 80,
    x1:r.left + r.width * 0.6, y1:r.top + r.height * 0.6, t:-i * 0.025, lift:120 + Math.random() * 160});
}
function drawFx(dt, racing, u){
  const W = fx.width, H = fx.height;
  const lines = racing && !V.settled && !reduced;
  if (!lines && !parts.length && !coinsFx.length && burst <= 0) { if (fxDirty) { fctx.clearRect(0, 0, W, H); fxDirty = false; } return; }
  fxDirty = true;
  fctx.clearRect(0, 0, W, H);
  if (lines || burst > 0) {                       // 集中線
    const int = burst > 0 ? 1 : 0.3 + 0.7 * u * u;
    const n = Math.floor(14 + int * 46), cx = W / 2, cy = H * 0.46, RR = Math.hypot(W, H) / 2;
    fctx.fillStyle = burst > 0 ? 'rgba(255,214,10,' + (0.5 * burst).toFixed(3) + ')' : '#ffffff';
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * 6.283, r0 = RR * (0.62 + Math.random() * 0.3 - int * 0.22), wdt = (0.004 + Math.random() * 0.014) * (1 + int);
      if (burst <= 0) fctx.globalAlpha = 0.07 + Math.random() * 0.2 * int;
      fctx.beginPath();
      fctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      fctx.lineTo(cx + Math.cos(ang - wdt) * RR * 1.1, cy + Math.sin(ang - wdt) * RR * 1.1);
      fctx.lineTo(cx + Math.cos(ang + wdt) * RR * 1.1, cy + Math.sin(ang + wdt) * RR * 1.1);
      fctx.fill();
    }
    fctx.globalAlpha = 1;
    burst = Math.max(0, burst - dt * 1.6);
  }
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.45; p.vx *= 0.985; p.rot += p.vr; p.life--;
    fctx.save(); fctx.translate(p.x, p.y); fctx.rotate(p.rot);
    fctx.globalAlpha = clamp(p.life / 25, 0, 1);
    fctx.fillStyle = p.c; fctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2);
    fctx.restore();
  }
  parts = parts.filter(p => p.life > 0 && p.y < H + 30);
  let arrived = false;
  for (const c of coinsFx) {
    c.t += dt * 1.5;
    if (c.t <= 0) continue;
    const k = Math.min(1, c.t), e = k * k * (3 - 2 * k);
    const x = c.x0 + (c.x1 - c.x0) * e, y = c.y0 + (c.y1 - c.y0) * e - Math.sin(k * Math.PI) * c.lift;
    fctx.fillStyle = '#ffd60a'; fctx.strokeStyle = '#16130f'; fctx.lineWidth = 2;
    fctx.beginPath(); fctx.ellipse(x, y, 9, 9 * Math.abs(Math.cos(c.t * 9)) + 2, 0, 0, 6.283); fctx.fill(); fctx.stroke();
    if (k >= 1) { c.done = true; arrived = true; }
  }
  if (arrived) { sCoin(); const w = $('wallet'); w.classList.remove('bump'); void w.offsetWidth; w.classList.add('bump'); }
  coinsFx = coinsFx.filter(c => !c.done);
}
function flash(gold){
  if (reduced) return;
  const f = $('flash'); f.className = ''; void f.offsetWidth; f.className = gold ? 'go gold' : 'go';
}
function shake(){
  if (reduced) return;
  document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake');
  setTimeout(() => document.body.classList.remove('shake'), 500);
}

/* ================= HUD ================= */
const elBash = $('bashira'), elPop = $('pop'), elDan = $('dan'), elCoins = $('coins'), elList = $('players'), elBoard = $('board'), elMap = $('map');
let umaEls = [], voteSig = [], plSig = '', shownCoins = 1000, mapDots = [], roomOpen = false, autoOpened = false;

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
}
function renderRound(){
  elPop.className = 'pop'; $('popA').textContent = ''; $('popB').textContent = ''; $('popC').textContent = '';
  elBoard.hidden = true;
  document.body.classList.remove('lost');
  setText($('caster'), '');
  voteSig = [];
  umaEls = V.race.hs.map(h => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'uma'; b.id = 'uma' + h.no;
    b.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-label', h.no + '番 ' + h.name + ' ' + h.style + ' 単勝' + h.odds.toFixed(1) + '倍');
    const waku = document.createElement('span'); waku.className = 'waku'; waku.textContent = String(h.no);
    waku.style.background = FRAME[h.no - 1].bg; waku.style.color = FRAME[h.no - 1].fg;
    const sh = document.createElement('span'); sh.className = 'shirushi'; sh.textContent = h.mark;
    const nm = document.createElement('span'); nm.className = 'name'; nm.textContent = h.name;
    const st = document.createElement('span'); st.className = 'style'; st.textContent = h.style;
    const od = document.createElement('span'); od.className = 'odds'; od.textContent = h.odds.toFixed(1);
    const sm = document.createElement('small'); sm.textContent = '倍'; od.appendChild(sm);
    const vt = document.createElement('span'); vt.className = 'votes';
    b.append(waku, sh, nm, st, od, vt);
    b.addEventListener('click', () => pick(h.no));
    return b;
  });
  elBash.replaceChildren(...umaEls);
  if (G) for (const H of G.horses) { const c = COATS[V.race.hs[H.no - 1].coat]; H.mBody.color.set(c.body); H.mDark.color.set(c.dark); }
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
function celebrate(res){
  const a = $('popA'), b = $('popB'), c = $('popC');
  const R = V.race;
  setText($('caster'), R.hs[R.order[0] - 1].name + ' ゴールイン!');
  sGoal(); kick3D(1);
  if (A.ctx) A.mfilt.frequency.setTargetAtTime(15000, A.ctx.currentTime, 0.05);
  let cls = 'pop show';
  if (!res) { a.textContent = ''; b.textContent = ''; c.textContent = ''; flash(false); elPop.className = cls; return; }
  if (res.type === 'win') {
    const big = res.odds >= 10;
    a.textContent = big ? '大穴的中!!' : '的中!!';
    b.textContent = '+' + fmt(res.pay);
    c.textContent = (S.streak >= 2 ? S.streak + '連勝!' : '') + (res.mult > 1 ? ' 連勝ボーナス×' + res.mult : '');
    flash(true); shake(); burst = 1;
    confetti(big ? 260 : 110);
    coinRain(big ? 46 : 22);
    sWin(big);
  } else if (res.bust) {
    cls += ' lose bust'; a.textContent = '破産!'; b.textContent = 'おこづかい +1,000'; c.textContent = '';
    flash(false); document.body.classList.add('lost'); sBust();
  } else {
    cls += ' lose'; a.textContent = 'ハズレ'; b.textContent = '−' + fmt(res.bet);
    c.textContent = res.rank === 2 ? '惜しい!' + R.margin + 'の2着' : '';
    flash(false); document.body.classList.add('lost'); sLose();
  }
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
  const multi = ps.filter(p => !p.away).length > 1;
  const canBet = V.ph === 'bet' && !V.late;
  const inRound = p => !!(p.pick && p.pick.n === V.n && p.pick.s === V.seed);
  const B = document.body.classList;
  B.toggle('is-bet', V.ph === 'bet'); B.toggle('is-late', V.late);
  B.toggle('is-run', V.ph === 'run' && !V.settled && !V.late);
  B.toggle('is-res', V.ph === 'run' && V.settled && !V.late);
  B.toggle('tense', V.ph === 'run' && !V.settled && !V.late && (V.slow || !!(V.locked && V.locked.all)) && !reduced);
  setText($('raceNo'), '第' + V.n + 'R');
  const fv = $('fever'), mult = streakMult(S.streak);
  fv.hidden = mult === 1; setText(fv, mult >= 1.5 ? 'FEVER 払戻×1.5' : '連勝ボーナス×1.2');

  const myH = me.pick && inRound({pick:me.pick}) ? me.pick.h : 0;
  umaEls.forEach((el, i) => {
    const no = i + 1, pressed = String(no === myH);
    if (el.getAttribute('aria-pressed') !== pressed) el.setAttribute('aria-pressed', pressed);
    if (el.disabled !== !canBet) el.disabled = !canBet;
    const hues = ps.filter(p => inRound(p) && p.pick.h === no).map(p => p.hue).slice(0, 5);
    const sig = hues.join(',');
    if (voteSig[i] !== sig) {
      voteSig[i] = sig;
      el.lastElementChild.replaceChildren(...hues.map(h => { const d = document.createElement('i'); d.style.background = 'hsl(' + h + ' 85% 55%)'; return d; }));
    }
  });
  mapDots.forEach((d, i) => d.classList.toggle('mine', i + 1 === myHorseNo()));

  let text = '', fuse = 0;
  if (V.late) text = 'レース中。次のレースから賭けられます';
  else if (V.ph === 'bet') {
    const any = ps.some(inRound);
    if (!any) V.firstPick = 0; else if (!V.firstPick) V.firstPick = now;
    const left = any ? Math.max(0, GRACE_MS - (now - V.firstPick)) : GRACE_MS;
    if (!multi) text = A.ctx ? '馬をタップ。その瞬間に発走' : '馬をタップ。その瞬間に発走(BGMも鳴ります)';
    else if (myH) { text = '投票ずみ。全員そろうか、あと' + Math.ceil(left / 1000) + '秒で発走'; fuse = left / GRACE_MS; }
    else if (any) { text = '急げ!締切まで' + Math.ceil(left / 1000) + '秒'; fuse = left / GRACE_MS; }
    else text = '馬をタップで投票。全員そろうか、最初の1人から5秒で発走';
  }
  setText($('callText'), text);
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
  setText($('stStreak'), String(S.streak));
  setText($('stBest'), fmt(S.best));
  setText($('stBust'), S.busts + '回');

  const rows = ps.slice().sort((a, b) => (b.coins - a.coins) || (a.peer < b.peer ? -1 : 1));
  const sig = JSON.stringify(rows.map(p => [p.peer, p.nick, p.hue, p.coins, p.away, p.sit, inRound(p) ? [p.pick.h, p.pick.bet] : 0, canBet]));
  if (sig !== plSig) {
    plSig = sig;
    elList.replaceChildren(...rows.map((p, i) => {
      const li = document.createElement('li'); if (p.isMe) li.className = 'me';
      const rk = document.createElement('span'); rk.className = 'rk'; rk.textContent = String(i + 1);
      const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = 'hsl(' + p.hue + ' 85% 55%)';
      const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = p.nick;
      if (p.isMe) { const y = document.createElement('small'); y.textContent = 'あなた'; nm.appendChild(y); }
      const pk = document.createElement('span'); pk.className = 'pk';
      if (inRound(p)) pk.append(badge(p.pick.h), document.createTextNode(fmt(p.pick.bet)));
      else pk.textContent = p.away ? '離席' : p.sit ? '見' : canBet ? '考え中' : '';
      const cn = document.createElement('span'); cn.className = 'cn'; cn.textContent = fmt(p.coins);
      li.append(rk, dot, nm, pk, cn);
      return li;
    }));
  }
}
// レース中の毎フレーム更新(順位・実況・コース図)
function liveHud(racing, t, tau){
  if (!V.race) return;
  const R = V.race;
  for (let i = 0; i < 6; i++) {
    const p = racing ? Math.min(1.03, prog(R.hs[i], tau)) : 0;
    mapDots[i].style.left = (p / 1.03 * 100).toFixed(2) + '%';
  }
  if (!racing) return;
  const key = h => tau >= h.T ? 10 - h.T : prog(h, tau);
  const sorted = R.hs.slice().sort((a, b) => key(b) - key(a));
  const leadNo = sorted[0].no, u = tau / R.tWin;
  const slow = t >= R.a && t < R.a + R.slowDisp;
  if (slow && !V.slow && A.ctx) A.mfilt.frequency.setTargetAtTime(380, A.ctx.currentTime, 0.07);
  V.slow = slow;
  const myH = myHorseNo();
  if (!V.settled) {
    if (u >= 0.78 && !V.stretch) { V.stretch = true; setText($('caster'), '最後の直線!先頭は' + leadNo + '番 ' + R.hs[leadNo - 1].name); }
    else if (leadNo !== V.lead && tau > 0.6) setText($('caster'), (V.stretch ? '' : '') + leadNo + '番 ' + R.hs[leadNo - 1].name + (V.lead ? ' かわして先頭!' : ' 先頭!'));
    if (slow && R.photo) setText($('caster'), 'これは際どい!写真判定か!');
  }
  V.lead = leadNo;
  const rk = $('rank'), si = $('stakeInfo');
  if (myH) {
    const h = R.hs[myH - 1], r = sorted.findIndex(x => x.no === myH) + 1;
    const txt = tau >= h.T ? h.rank + '着' : r === 1 ? '先頭!!' : r + '番手';
    if (r !== V.myRank) {
      if (V.myRank) sRank(r < V.myRank);
      V.myRank = r; rk.classList.remove('bump'); void rk.offsetWidth; rk.classList.add('bump');
    }
    setText(rk, txt); rk.classList.toggle('first', r === 1);
    if (V.locked) setText(si, myH + '番に' + fmt(V.locked.bet) + (V.locked.all ? '(全ツッパ)' : '') + ' 当たれば +' + fmt(Math.floor(V.locked.bet * V.locked.odds * V.locked.mult)));
  } else { setText(rk, ''); setText(si, '見学中'); }
}

/* ================= メインループ ================= */
let lastFrame = performance.now();
function frame(){
  const now = performance.now(), dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  const racing = V.ph === 'run' && !V.late;
  const t = racing ? (now - V.raceStart) / 1000 : 0;
  const tau = racing ? warp(V.race, t) : 0;
  if (racing && !V.settled && t >= V.race.tSettle) settle(false);
  liveHud(racing, t, tau);
  update3D(now, dt, racing, t, tau);
  const u = racing ? clamp(tau / V.race.tWin, 0, 1) : 0;
  drawFx(dt, racing, u);
  audioFrame(racing && !V.settled, racing && V.slow && !V.settled, u);
  if (Math.abs(S.coins - shownCoins) > 0.5) shownCoins += (S.coins - shownCoins) * 0.14; else shownCoins = S.coins;
  setText(elCoins, fmt(shownCoins));
  requestAnimationFrame(frame);
}

/* ================= 起動 ================= */
function inviteUrl(code){
  const u = new URL(window.location.href);
  u.hash = '';
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
    $('btnBgm').setAttribute('aria-pressed', String(S.bgm)); $('btnSfx').setAttribute('aria-pressed', String(S.sfx));
    $('btnRoom').setAttribute('aria-pressed', String(roomOpen)); document.body.classList.toggle('room-open', roomOpen);
    if (A.ctx) { A.music.gain.setTargetAtTime(S.bgm ? 0.55 : 0, A.ctx.currentTime, 0.03); A.sfx.gain.setTargetAtTime(S.sfx ? 0.9 : 0, A.ctx.currentTime, 0.03); }
  };
  roomOpen = false;
  $('btnBgm').addEventListener('click', () => { S.bgm = !S.bgm; save(); audioUnlock(); paintTools(); });
  $('btnSfx').addEventListener('click', () => { S.sfx = !S.sfx; save(); audioUnlock(); paintTools(); sClick(); });
  $('btnRoom').addEventListener('click', () => { roomOpen = !roomOpen; paintTools(); });
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
    if (e.target && e.target.tagName === 'INPUT') return;
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
  tick();
  setInterval(tick, 100);
  requestAnimationFrame(frame);
}
start();
})();
