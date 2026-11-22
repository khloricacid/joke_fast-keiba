// ファスト競馬の通信層。Trystero (WebRTC) を Nostr と MQTT の2系統で同時に使い、
// どちらかの公開リレーが落ちていても合流できるようにする。
import {joinRoom as joinNostr, getRelaySockets as nostrSockets} from '@trystero-p2p/nostr'
import {joinRoom as joinMqtt, getRelaySockets as mqttSockets} from '@trystero-p2p/mqtt'

const APP_ID = 'khloricacid.joke-fast-keiba.v1'

export function join(code, cb, opts) {
  opts = opts || {}
  const rooms = []
  const stat = {joins: {nostr: 0, mqtt: 0}, links: {nostr: 0, mqtt: 0}, errors: []}
  let last = null
  const strategies = [['nostr', joinNostr, opts.nostrUrls], ['mqtt', joinMqtt, opts.mqttUrls]]
  strategies.forEach(([name, joinRoom, urls]) => {
    if (urls && urls.length === 0) return
    try {
      const relayConfig = {warnOnRelayFailure: false}
      if (urls) relayConfig.urls = urls
      const room = joinRoom({appId: APP_ID, identity: 'none', relayConfig}, 'room-' + code)
      const act = room.makeAction('st')
      act.onMessage((data, ctx) => { try { cb.onState(data, name + ':' + ctx.peerId) } catch (e) {} })
      room.onPeerJoin(ctx => {
        stat.joins[name]++; stat.links[name]++
        try { cb.onJoin(name + ':' + ctx.peerId) } catch (e) {}
        if (last) act.send(last, {target: ctx.peerId}).catch(() => {})
      })
      room.onPeerLeave(ctx => {
        stat.links[name] = Math.max(0, stat.links[name] - 1)
        try { cb.onLeave(name + ':' + ctx.peerId) } catch (e) {}
      })
      room.onError(err => {
        const c = err && err.code
        if (stat.errors.length < 20) stat.errors.push(name + ':' + c)
        try { cb.onError && cb.onError(name, c) } catch (e) {}
      })
      rooms.push({name, room, act})
    } catch (e) {
      stat.errors.push(name + ':' + String(e && e.message || e).slice(0, 80))
    }
  })
  const count = get => { let open = 0, total = 0; try { for (const s of Object.values(get())) { total++; if (s && s.readyState === 1) open++ } } catch (e) {} return {open, total} }
  return {
    send(state) {
      last = state
      for (const r of rooms) { try { r.act.send(state).catch(() => {}) } catch (e) {} }
    },
    diag: () => ({nostr: count(nostrSockets), mqtt: count(mqttSockets), links: stat.links, joins: stat.joins, errors: stat.errors.slice()}),
    leave() { for (const r of rooms) { try { r.room.leave() } catch (e) {} } }
  }
}
