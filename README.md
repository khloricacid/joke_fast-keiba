# ファスト競馬

5秒で決着する3D競馬のジョークゲームです。馬をタップした瞬間に発走します。

- 賭けるのはゲーム内コインだけです。お金は賭けられません。
- 単勝のみ。1着を当てると賭け金×オッズが戻ります。連勝すると払い戻しにボーナスが付きます。
- BGMと効果音はすべてブラウザ内で合成しています(音声ファイルなし)。

## マルチプレイ

ページを開くと「みんなの部屋」に入ります。同じURLを開いた人は、全員が同じレースに賭けます。
身内だけで遊ぶときは「友だちを呼ぶ」→「専用の部屋を作る」で部屋コード付きのURL(`?room=xxxxxx`)を作り、それを送ってください。

通信は WebRTC のP2Pです。相手を見つける最初の合図だけ、公開されている Nostr リレーと MQTT ブローカーを使います([Trystero](https://github.com/dmotz/trystero))。
サーバーは持たないので、回線の種類(厳しいNATや社内ネットワークなど)によってはつながらないことがあります。
各自の所持コインや順位は自己申告で、不正対策はしていません。

## ファイル

| ファイル | 内容 |
|---|---|
| `index.html` / `style.css` | 画面 |
| `game.js` | ゲーム本体(レース生成、進行、3D、音、HUD) |
| `vendor/three.min.js` | three.js r128(MIT) |
| `vendor/net.js` | Trystero 0.27 をまとめた通信層(MIT)。元のコードは `src/net-src.js` |

ビルドは不要で、静的ファイルとしてそのまま配信できます。`vendor/net.js` を作り直すときだけ次を実行します。

```sh
npm i trystero @trystero-p2p/nostr @trystero-p2p/mqtt esbuild
npx esbuild src/net-src.js --bundle --format=iife --global-name=FKNet --minify --target=es2020 --outfile=vendor/net.js
```
