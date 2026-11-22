// ファスト競馬の通信層。Trystero (WebRTC) を Nostr と MQTT の2系統で同時に使い、
// どちらかの公開リレーが落ちていても合流できるようにする。
import {joinRoom as joinNostr} from '@trystero-p2p/nostr'
import {joinRoom as joinMqtt} from '@trystero-p2p/mqtt'

const APP_ID = 'khloricacid.joke-fast-keiba.v1'

export function join(code, cb) {
  const rooms = []
  let last = null
  const strategies = [['nostr', joinNostr], ['mqtt', joinMqtt]]
  strategies.forEach(([name, joinRoom]) => {
    try {
      const room = joinRoom({appId: APP_ID, identity: 'none', relayConfig: {warnOnRelayFailure: false}}, 'room-' + code)
      const act = room.makeAction('st')
      act.onMessage((data, ctx) => { try { cb.onState(data, name + ':' + ctx.peerId) } catch (e) {} })
      room.onPeerJoin(ctx => {
        try { cb.onJoin(name + ':' + ctx.peerId) } catch (e) {}
        if (last) act.send(last, {target: ctx.peerId}).catch(() => {})
      })
      room.onPeerLeave(ctx => { try { cb.onLeave(name + ':' + ctx.peerId) } catch (e) {} })
      room.onError(err => { try { cb.onError && cb.onError(name, err && err.code) } catch (e) {} })
      rooms.push({name, room, act})
    } catch (e) {
      try { cb.onError && cb.onError(name, String(e && e.message || e)) } catch (e2) {}
    }
  })
  return {
    send(state) {
      last = state
      for (const r of rooms) { try { r.act.send(state).catch(() => {}) } catch (e) {} }
    },
    strategies: () => rooms.map(r => r.name),
    leave() { for (const r of rooms) { try { r.room.leave() } catch (e) {} } }
  }
}
