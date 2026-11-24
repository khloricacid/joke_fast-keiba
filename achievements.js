/* ファスト競馬の実績とデイリーミッション。game.js が読む。
   実績の id は保存データのキーなので、変えたり消したりしないこと(追加は自由)。
   test(c) と prog(c) の c = {st:記録, S:保存データ, ev:直近の出来事, lv:レベル}。
   ev.type は 'settle'(レース確定) / 'level' / 'stamp' / 'room' / 'boot' / 'daily' / 'jackpot' / 'lucky' / 'omen' / 'combo'。 */
window.FK_ACH = (() => {
  const W = c => c.ev.type === 'settle' && c.ev.win;               // 的中したレース
  const S_ = c => c.ev.type === 'settle';                           // 賭けて確定したレース
  const n = (o, k) => (o && o[k]) || 0;
  const keys = o => Object.keys(o || {}).filter(k => o[k] > 0).length;
  const cnt = (key, goal) => ({test:c => (c.st[key] || 0) >= goal, prog:c => [Math.min(goal, c.st[key] || 0), goal]});
  const A = (id, cat, tier, name, desc, rule, hidden) => Object.assign({id, cat, tier, name, desc, hidden:!!hidden}, rule);

  const list = [
    // ---- 的中・払戻 ----
    A('first', '的中', 'b', '初的中', 'はじめて的中させる', cnt('wins', 1)),
    A('hit10', '的中', 'b', '当てる人', '的中 10回', cnt('wins', 10)),
    A('hit100', '的中', 's', '当てまくる人', '的中 100回', cnt('wins', 100)),
    A('hit1000', '的中', 'g', '的中マシーン', '的中 1,000回', cnt('wins', 1000)),
    A('race50', '的中', 'b', '常連', '50レースに賭ける', cnt('races', 50)),
    A('race500', '的中', 's', '住人', '500レースに賭ける', cnt('races', 500)),
    A('race3000', '的中', 'g', '主', '3,000レースに賭ける', cnt('races', 3000)),
    A('pay1k', '的中', 'b', '4桁の快感', '1回で1,000コイン以上の払戻', {test:c => (c.st.bestPay || 0) >= 1000, prog:c => [Math.min(1000, c.st.bestPay || 0), 1000]}),
    A('pay10k', '的中', 's', '5桁の衝撃', '1回で1万コイン以上の払戻', {test:c => (c.st.bestPay || 0) >= 10000, prog:c => [Math.min(10000, c.st.bestPay || 0), 10000]}),
    A('pay100k', '的中', 'g', '6桁の向こう側', '1回で10万コイン以上の払戻', {test:c => (c.st.bestPay || 0) >= 100000, prog:c => [Math.min(100000, c.st.bestPay || 0), 100000]}),
    A('total100k', '的中', 's', '積み上げ', '払戻の合計 10万コイン', cnt('totalPay', 100000)),
    A('total1m', '的中', 'g', 'ミリオン', '払戻の合計 100万コイン', cnt('totalPay', 1000000)),
    A('rich', '的中', 'b', '小金持ち', '所持コイン 1万に到達', {test:c => c.S.coins >= 10000}),
    A('rich2', '的中', 's', 'ドパミン長者', '所持コイン 10万に到達', {test:c => c.S.coins >= 100000}),
    A('rich3', '的中', 'g', 'ドパミン富豪', '所持コイン 100万に到達', {test:c => c.S.coins >= 1000000}),
    A('rich4', '的中', 'g', 'MEGA', '所持コイン 1億に到達', {test:c => c.S.coins >= 1e8}),
    A('rich5', '的中', 'g', 'GIGA', '所持コイン 10億に到達', {test:c => c.S.coins >= 1e9}),
    A('big10', '的中', 'b', '大穴ハンター', '単勝10倍以上を的中', {test:c => W(c) && c.ev.odds >= 10}),
    A('big30', '的中', 's', '万馬券ハンター', '単勝30倍以上を的中', {test:c => W(c) && c.ev.odds >= 30}),
    A('big60', '的中', 'g', '奇跡の目撃者', '単勝60倍以上を的中', {test:c => W(c) && c.ev.odds >= 60}),
    A('gates', '的中', 's', '全枠制覇', '1〜6枠すべてで的中', {test:c => keys(c.st.gates) >= 6, prog:c => [keys(c.st.gates), 6]}),
    A('styles', '的中', 'b', '脚質コンプ', '逃げ・先行・差し・追込すべてで的中', {test:c => keys(c.st.styles) >= 4, prog:c => [keys(c.st.styles), 4]}),
    A('fav5', '的中', 's', '堅実派', '1番人気で5連続的中', {test:c => (c.st.favStreak || 0) >= 5, prog:c => [Math.min(5, c.st.favStreak || 0), 5]}),
    A('lowest', '的中', 's', '逆張りの美学', '最低人気(6番人気)で的中', {test:c => W(c) && c.ev.pop === 6}),

    // ---- 連勝・連敗 ----
    A('streak3', '連勝', 'b', '3連勝', '3レース続けて的中', {test:c => (c.st.maxStreak || 0) >= 3, prog:c => [Math.min(3, c.st.maxStreak || 0), 3]}),
    A('streak5', '連勝', 'b', '5連勝', '5レース続けて的中', {test:c => (c.st.maxStreak || 0) >= 5, prog:c => [Math.min(5, c.st.maxStreak || 0), 5]}),
    A('streak7', '連勝', 's', '7連勝', '7レース続けて的中', {test:c => (c.st.maxStreak || 0) >= 7, prog:c => [Math.min(7, c.st.maxStreak || 0), 7]}),
    A('streak10', '連勝', 'g', '10連勝', '10レース続けて的中', {test:c => (c.st.maxStreak || 0) >= 10, prog:c => [Math.min(10, c.st.maxStreak || 0), 10]}),
    A('lose5', '連勝', 'b', 'まだいける', '5連敗する', {test:c => (c.st.maxLose || 0) >= 5}),
    A('lose10', '連勝', 's', 'それでも賭ける', '10連敗する', {test:c => (c.st.maxLose || 0) >= 10, prog:c => [Math.min(10, c.st.maxLose || 0), 10]}),
    A('bust', '連勝', 'b', 'はじめての破産', 'コインを使い切る', {test:c => (c.S.busts || 0) >= 1}),
    A('bust5', '連勝', 's', '破産慣れ', '破産 5回', {test:c => (c.S.busts || 0) >= 5, prog:c => [Math.min(5, c.S.busts || 0), 5]}),
    A('bust20', '連勝', 'g', '不死鳥', '破産 20回', {test:c => (c.S.busts || 0) >= 20, prog:c => [Math.min(20, c.S.busts || 0), 20]}),
    A('comeback', '連勝', 's', '大逆転', '破産してから所持コイン 1万まで戻す', {test:c => (c.st.comebacks || 0) >= 1}),

    // ---- 賭け方 ----
    A('push1', '賭け方', 'b', '倍プッシュ', '倍プッシュに乗って的中', {test:c => (c.st.bestPush || 0) >= 1, prog:c => [Math.min(1, c.st.bestPush || 0), 1]}),
    A('push3', '賭け方', 's', '倍々ゲーム', '倍プッシュ 3連成功', {test:c => (c.st.bestPush || 0) >= 3, prog:c => [Math.min(3, c.st.bestPush || 0), 3]}),
    A('push5', '賭け方', 'g', '止まれない人', '倍プッシュ 5連成功', {test:c => (c.st.bestPush || 0) >= 5, prog:c => [Math.min(5, c.st.bestPush || 0), 5]}),
    A('pushOut', '賭け方', 's', '勝ち逃げ', '倍プッシュ2連以上で勝ち逃げする', cnt('pushOut2', 1)),
    A('rushAll', '賭け方', 's', 'RUSH全ツッパ', 'RUSH中に全ツッパを選んで的中', cnt('rushAllWins', 1)),
    A('bigFirst', '賭け方', 'b', 'BIGデビュー', 'BIG BET で賭ける(所持100万から)', cnt('bigBets', 1)),
    A('big50', '賭け方', 's', 'ハーフ&ハーフ', 'BIG BET 50%で的中', {test:c => W(c) && c.ev.big === 50}),
    A('big100', '賭け方', 'g', '全部いった', 'BIG BET 100%で的中', {test:c => W(c) && c.ev.big === 100}),
    A('exFirst', '賭け方', 'b', '馬単的中', '馬単(1着と2着)を的中', cnt('exWins', 1)),
    A('ex100', '賭け方', 's', '3桁の男', '馬単100倍以上を的中', {test:c => W(c) && c.ev.ex && c.ev.exOdds >= 100}),
    A('rideWin', '賭け方', 's', 'ちゃっかり', '相乗りして的中', cnt('rideWins', 1)),
    A('melt1', '賭け方', 's', '溶かし屋', '1レースで100万コイン以上を溶かす', {test:c => (c.st.maxMelt || 0) >= 1e6}),
    A('melt2', '賭け方', 'g', '億り人(溶かす側)', '1レースで1億コイン以上を溶かす', {test:c => (c.st.maxMelt || 0) >= 1e8}),
    A('allin', '賭け方', 'b', '全ツッパ成功', '500コイン以上の全ツッパで的中', {test:c => W(c) && c.ev.all && c.ev.bet >= 500}),
    A('allin3', '賭け方', 's', '全ツッパ3連', '全ツッパで3連続的中', {test:c => (c.st.allinStreak || 0) >= 3, prog:c => [Math.min(3, c.st.allinStreak || 0), 3]}),
    A('allinBust', '賭け方', 'b', '散り際', '全ツッパで破産する', {test:c => S_(c) && c.ev.all && c.ev.bust}),
    A('quick', '賭け方', 'b', '秒で決断', '「秒で決断」で賭けて的中', {test:c => W(c) && c.ev.quick}),
    A('quick10', '賭け方', 'b', '即決の人', '「秒で決断」で10回賭ける', cnt('quick', 10)),
    A('quick100', '賭け方', 's', '考えるな、押せ', '「秒で決断」で100回賭ける', cnt('quick', 100)),
    A('tiny10', '賭け方', 'b', '少額コツコツ', '10コイン賭けで10回的中', cnt('tinyWins', 10)),
    A('deadline', '賭け方', 's', '滑り込み', 'みんなの部屋で、締切まで1秒を切ってから賭けて的中', {test:c => W(c) && c.ev.deadline}),
    A('combo', '賭け方', 'b', 'コンボ満タン', 'コンボゲージを満タンにする', cnt('combos', 1)),
    A('combo20', '賭け方', 's', '止まらない', 'コンボゲージを20回満タンにする', cnt('combos', 20)),

    // ---- 馬・騎手 ----
    A('oshi', '馬・騎手', 's', '推し馬', '同じ馬で10回的中', {test:c => Math.max(0, ...Object.values(c.st.byHorse || {})) >= 10, prog:c => [Math.min(10, Math.max(0, ...Object.values(c.st.byHorse || {}))), 10]}),
    A('horses10', '馬・騎手', 'b', '目移り', '10頭で的中', {test:c => keys(c.st.byHorse) >= 10, prog:c => [Math.min(10, keys(c.st.byHorse)), 10]}),
    A('horses30', '馬・騎手', 'g', '全頭制覇', '30頭すべてで的中', {test:c => keys(c.st.byHorse) >= 30, prog:c => [keys(c.st.byHorse), 30]}),
    A('jockeys', '馬・騎手', 's', '騎手コンプ', '騎手10人すべての騎乗で的中', {test:c => keys(c.st.byJockey) >= 10, prog:c => [keys(c.st.byJockey), 10]}),
    A('juden', '馬・騎手', 's', '充電完了', 'ジュウデンギレで的中', {test:c => W(c) && c.ev.horse === 'ジュウデンギレ'}),
    A('gacha', '馬・騎手', 'b', '天井到達', 'ガチャテンジョウで的中', {test:c => W(c) && c.ev.horse === 'ガチャテンジョウ'}),
    A('hima', '馬・騎手', 'b', 'ゆっくりでいい', 'ヒマツブシオーで的中', {test:c => W(c) && c.ev.horse === 'ヒマツブシオー'}),
    A('zero', '馬・騎手', 'b', '信じる心', 'シュウチュウゼロに全ツッパする', {test:c => S_(c) && c.ev.all && c.ev.horse === 'シュウチュウゼロ'}),
    A('ashita', '馬・騎手', 'b', '今日やった', '明日 弥留の騎乗で的中', {test:c => W(c) && c.ev.jockey === '明日 弥留'}),
    A('mikka', '馬・騎手', 's', '4日目の壁', '三日 坊の騎乗で4回的中', {test:c => n(c.st.byJockey, '三日 坊') >= 4, prog:c => [Math.min(4, n(c.st.byJockey, '三日 坊')), 4]}),
    A('kakin', '馬・騎手', 's', '確率は収束する', '課金 重の騎乗で10回的中', {test:c => n(c.st.byJockey, '課金 重') >= 10, prog:c => [Math.min(10, n(c.st.byJockey, '課金 重')), 10]}),
    A('closer', '馬・騎手', 'b', '追込一気', '追込の馬で的中', {test:c => W(c) && c.ev.style === '追込'}),
    A('skill1', '馬・騎手', 'b', '特殊能力', '自分の馬の騎手の特殊能力が発動する', cnt('mySkills', 1)),
    A('skill30', '馬・騎手', 's', '能力マニア', '自分の馬の騎手の特殊能力を30回見る', cnt('mySkills', 30)),
    A('skillWin', '馬・騎手', 's', '能力で勝つ', '自分の馬の騎手の特殊能力が発動したレースで的中', {test:c => W(c) && c.ev.skill}),
    A('gradeGold', '馬・騎手', 's', '超激アツ', '自分の馬で金のカットインを見る', cnt('myGold', 1)),
    A('rushIn', '馬・騎手', 's', 'RUSH突入', '自分の馬の「伝説」で勝ってドパミンRUSHに入る', cnt('rushes', 1)),
    A('rush5', '馬・騎手', 'g', '止まらない', 'ドパミンRUSHで5連チャン', {test:c => (c.st.bestRush || 0) >= 5, prog:c => [Math.min(5, c.st.bestRush || 0), 5]}),
    A('sashi', '展開', 'b', '差し切り', 'ゴール前で差し切って的中', cnt('sashiN', 1)),
    A('nosed', '展開', 'b', 'あと数センチ', 'ずっと先頭だったのにゴール前で差される', cnt('nosedN', 1)),
    A('nosed10', '展開', 's', '差され慣れ', 'ゴール前で差される 10回', cnt('nosedN', 10)),
    A('gradeRainbow', '馬・騎手', 'g', '伝説の目撃者', '自分の馬で「伝説」(虹)を見る', cnt('myRainbow', 1)),
    A('tenjo', '馬・騎手', 'g', '天井到達', '課金 重の「天井到達」が発動したレースで的中', {test:c => W(c) && c.ev.skillName === '天井到達'}),
    A('buzzWin', '馬・騎手', 'b', 'バズった', 'バズリタイシが爆発したレースで的中', {test:c => W(c) && c.ev.horse === 'バズリタイシ' && c.ev.traitHit}),

    // ---- 展開 ----
    A('fromLast', '展開', 's', 'ごぼう抜き', '道中最後方だった馬が差し切って的中', {test:c => W(c) && c.ev.fromLast}),
    A('nose', '展開', 'b', 'ハナ差で的中', '写真判定になったレースで的中', {test:c => W(c) && c.ev.photo}),
    A('photo3', '展開', 's', '写真うつりがいい', '写真判定のレースで3回的中', cnt('photoWins', 3)),
    A('second10', '展開', 's', '惜しい', '賭けた馬が2着 10回', cnt('seconds', 10)),
    A('gold', '展開', 'b', 'ゴールデンレース的中', 'ゴールデンレースで的中', {test:c => (c.st.goldWins || 0) >= 1}),
    A('gold3', '展開', 's', '金の亡者', 'ゴールデンレースで3回的中', cnt('goldWins', 3)),
    A('omen', '展開', 's', '激アツ', '確定演出を見る', cnt('omens', 1), true),
    A('jackpot', '展開', 'g', 'ジャックポット', 'ジャックポットを当てる', cnt('jackpots', 1)),
    A('lucky', '展開', 's', '救われた', '救済くじで「777」を出す', cnt('luckyBig', 1), true),

    // ---- マルチ ----
    A('roomSolo', 'マルチ', 's', 'ひとり勝ち', '3人以上の部屋で、自分だけ的中', {test:c => W(c) && c.ev.roomN >= 3 && c.ev.roomWinners === 1}),
    A('roomSame', 'マルチ', 'b', '心はひとつ', '2人以上の部屋で全員が同じ馬に賭けて的中', {test:c => W(c) && c.ev.roomSame}),
    A('roomTop', 'マルチ', 'b', '場内トップ', '2人以上の部屋で所持コイン1位になる', {test:c => c.ev.type === 'room' && c.ev.top}),
    A('roomFour', 'マルチ', 'b', 'にぎやか', '4人以上の部屋で遊ぶ', {test:c => c.ev.type === 'room' && c.ev.n >= 4}),
    A('stamp100', 'マルチ', 'b', 'ヤジ将軍', 'ヤジを100回飛ばす', cnt('stamps', 100)),

    // ---- 日課 ----
    A('daily1', '日課', 'b', '日課はじめ', 'デイリーミッションをはじめて達成', cnt('dailyDone', 1)),
    A('daily30', '日課', 's', '日課の鬼', 'デイリーミッションを30個達成', cnt('dailyDone', 30)),
    A('login7', '日課', 'b', '1週間', '7日連続で遊ぶ', {test:c => (c.st.loginBest || 0) >= 7, prog:c => [Math.min(7, c.st.loginBest || 0), 7]}),
    A('login30', '日課', 'g', '皆勤', '30日連続で遊ぶ', {test:c => (c.st.loginBest || 0) >= 30, prog:c => [Math.min(30, c.st.loginBest || 0), 30]}),
    A('level10', '日課', 'b', 'Lv.10', 'レベル10に到達', {test:c => c.lv >= 10, prog:c => [Math.min(10, c.lv), 10]}),
    A('level30', '日課', 's', 'Lv.30', 'レベル30に到達', {test:c => c.lv >= 30, prog:c => [Math.min(30, c.lv), 30]}),
    A('level60', '日課', 'g', 'Lv.60', 'レベル60に到達', {test:c => c.lv >= 60, prog:c => [Math.min(60, c.lv), 60]}),

    // ---- 隠し ----
    A('night', '隠し', 'h', '深夜2時の帝王', '午前2時〜4時に的中', {test:c => W(c) && c.ev.night}, true),
    A('marathon', '隠し', 'h', 'あと1本だけ', 'ページを開いたまま100レース続けて賭ける', {test:c => (c.st.playRun || 0) >= 100}, true),
    A('calmBig', '隠し', 'h', '静かなる大穴', '「演出ひかえめ」のまま30倍以上を的中', {test:c => W(c) && c.ev.calm && c.ev.odds >= 30}, true),
    A('nameless', '隠し', 'h', '名もなき富豪', '名前が「ななし」のまま所持コイン1万', {test:c => c.S.nick === 'ななし' && c.S.coins >= 10000}, true),
    A('readDb', '隠し', 'h', '研究熱心', 'データページを読む', {test:c => !!c.ev.dbSeen}, true),
    A('photoLose', '隠し', 'h', '写真うつりが悪い', '写真判定のレースで2着', {test:c => S_(c) && !c.ev.win && c.ev.photo && c.ev.rank === 2}, true),
    A('allSix', '隠し', 'h', '全部負けた', '6着の馬に全ツッパ', {test:c => S_(c) && c.ev.all && c.ev.rank === 6}, true),
    A('rainbowWin', '隠し', 'h', '伝説になった', '「伝説」で払戻30倍以上', {test:c => W(c) && c.ev.skillGrade >= 4 && c.ev.tier >= 4}, true),
    A('allinLegend', '隠し', 'h', '全ツッパの神に愛された', '全ツッパで「伝説」を引いて勝つ', {test:c => W(c) && c.ev.all && c.ev.skillGrade >= 4}, true),
    A('rush10', '隠し', 'h', 'ドパミン無限機関', 'ドパミンRUSHで10連チャン', {test:c => (c.st.bestRush || 0) >= 10}, true),
    A('doom10', '隠し', 'h', '終了のお知らせ常連', 'ほかの馬の「伝説」で負けが決まる 10回', {test:c => (c.st.dooms || 0) >= 10}, true),
    A('demoted', '隠し', 'h', '審議の犠牲者', '1着でゴールしたのに降着になる', {test:c => (c.st.demotedN || 0) >= 1}, true),
    A('promoted', '隠し', 'h', '棚ぼた', '繰り上がりの1着で的中', {test:c => (c.st.promotedN || 0) >= 1}, true),
    A('dnf', '隠し', 'h', '紙くずコレクター', '賭けた馬が競走中止になる', {test:c => (c.st.dnfN || 0) >= 1}, true),
    A('pushFail3', '隠し', 'h', 'あと1回でやめるつもりだった', '倍プッシュ3連以上のあとに外して全部失う', {test:c => (c.st.pushFail3 || 0) >= 1}, true),
    A('bigBust', '隠し', 'h', 'BIGに散る', 'BIG BET で破産', {test:c => (c.st.bigBusts || 0) >= 1}, true),
    A('ex500', '隠し', 'h', '馬単の神', '馬単500倍以上を的中', {test:c => W(c) && c.ev.ex && c.ev.exOdds >= 500}, true),
    A('melt3', '隠し', 'h', '10億を溶かした人', '1レースで10億コイン以上を溶かす', {test:c => (c.st.maxMelt || 0) >= 1e9}, true),
    A('rescue', '隠し', 'h', 'へこたれない', '破産したところを馬主に助けてもらう', {test:c => S_(c) && c.ev.rescue}, true),
    A('kyouyaru', '隠し', 'h', '本当に今日やった', '明日 弥留の「今日やる」が発動したレースで的中', {test:c => W(c) && c.ev.skillName === '今日やる'}, true),
    A('deshou', '隠し', 'h', 'でしょうね', 'シュウチュウゼロが気を散らしたレースで、シュウチュウゼロに賭けていた', {test:c => S_(c) && c.ev.horse === 'シュウチュウゼロ' && c.ev.traitHit}, true)
  ];

  // デイリーミッション(1日3つ、日付から選ぶ)
  const missions = [
    {id:'w3', text:'3回的中する', goal:3, on:e => e.type === 'settle' && e.win ? 1 : 0},
    {id:'r5', text:'5レースに賭ける', goal:5, on:e => e.type === 'settle' ? 1 : 0},
    {id:'r12', text:'12レースに賭ける', goal:12, on:e => e.type === 'settle' ? 1 : 0},
    {id:'oi', text:'追込の馬で的中', goal:1, on:e => e.type === 'settle' && e.win && e.style === '追込' ? 1 : 0},
    {id:'ni', text:'逃げの馬で的中', goal:1, on:e => e.type === 'settle' && e.win && e.style === '逃げ' ? 1 : 0},
    {id:'sa', text:'差しの馬で的中', goal:1, on:e => e.type === 'settle' && e.win && e.style === '差し' ? 1 : 0},
    {id:'b10', text:'単勝10倍以上を的中', goal:1, on:e => e.type === 'settle' && e.win && e.odds >= 10 ? 1 : 0},
    {id:'st2', text:'2連勝する', goal:1, on:e => e.type === 'settle' && e.win && e.streak >= 2 ? 1 : 0},
    {id:'all', text:'全ツッパで賭ける', goal:1, on:e => e.type === 'settle' && e.all ? 1 : 0},
    {id:'q3', text:'「秒で決断」で3回賭ける', goal:3, on:e => e.type === 'settle' && e.quick ? 1 : 0},
    {id:'gd', text:'ゴールデンレースに賭ける', goal:1, on:e => e.type === 'settle' && e.gold ? 1 : 0},
    {id:'ya', text:'ヤジを3回飛ばす', goal:3, on:e => e.type === 'stamp' ? 1 : 0},
    {id:'p500', text:'1回で500コイン以上の払戻', goal:1, on:e => e.type === 'settle' && e.win && e.pay >= 500 ? 1 : 0},
    {id:'nf', text:'1番人気以外で2回的中', goal:2, on:e => e.type === 'settle' && e.win && e.pop > 1 ? 1 : 0},
    {id:'sec', text:'賭けた馬が2着(惜しい)', goal:1, on:e => e.type === 'settle' && !e.win && e.rank === 2 ? 1 : 0},
    {id:'sk', text:'自分の馬の騎手の特殊能力を見る', goal:1, on:e => e.type === 'skill' ? 1 : 0},
    {id:'sk2', text:'特殊能力が発動したレースで的中', goal:1, on:e => e.type === 'settle' && e.win && e.skill ? 1 : 0}
  ];

  // レベルで解放される見た目
  const unlocks = [
    {lv:3, name:'自分の馬の光の尾が虹色になる'},
    {lv:5, name:'名札が金ぴかになる'},
    {lv:7, name:'「的中!!」の文字が虹色になる'},
    {lv:10, name:'的中時の花火が倍になる'},
    {lv:15, name:'自分の馬の目印が虹色に光る'},
    {lv:20, name:'どんな的中でもコインの雨が降る'},
    {lv:30, name:'ゴール前スローの空がオーロラになる'}
  ];
  return {list, missions, unlocks, tiers:{b:'銅', s:'銀', g:'金', h:'隠し'}, cats:['的中', '連勝', '賭け方', '馬・騎手', '展開', 'マルチ', '日課', '隠し']};
})();
