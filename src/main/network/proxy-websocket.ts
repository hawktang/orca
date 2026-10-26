import { ProxyAgent } from 'proxy-agent'
import WebSocket, { type ClientOptions } from 'ws'
import { defaultProxySession } from './electron-default-proxy-session'
import { resolveSessionProxy } from './proxy-route'
import { awaitProxySessionApplication } from './proxy-settings'
import { getProxySessionTlsSettings } from './proxy-tls-settings'
import { trackProxySessionConnection } from './proxy-session-connections'

export function createProxyWebSocket(url: string, options: ClientOptions): WebSocket {
  const session = defaultProxySession()
  if (!session) {
    return new WebSocket(url, options)
  }
  const tls = getProxySessionTlsSettings(session)
  let untrack: (() => void) | undefined
  const agent = new ProxyAgent({
    ...tls?.options,
    getProxyForUrl: async (target, request) => {
      if (!(await awaitProxySessionApplication(session))) {
        throw new Error('Proxy settings are not ready')
      }
      if (getProxySessionTlsSettings(session) !== tls) {
        throw new Error('TLS settings changed; reconnect using the new settings')
      }
      if (request.destroyed) {
        throw new Error('WebSocket connection cancelled')
      }
      untrack ??= trackProxySessionConnection(session, () => socket.terminate())
      const proxy = await resolveSessionProxy(session, target)
      if (request.destroyed) {
        throw new Error('WebSocket connection cancelled')
      }
      return proxy
    }
  })
  const socket = new WebSocket(url, { ...options, ...tls?.options, agent })
  socket.once('close', () => {
    untrack?.()
    agent.destroy()
  })
  return socket
}
