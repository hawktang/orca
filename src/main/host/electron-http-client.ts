import { net, session } from 'electron'
import type { MainHttpClient } from '../network/http-client'
import { awaitProxySessionApplication } from '../network/proxy-settings'
import { getProxySessionTlsSettings } from '../network/proxy-tls-settings'
import { fetchWithProxyTls } from '../network/proxy-tls-fetch'

/**
 * The desktop HTTP client: Chromium's network stack, which follows session and proxy
 * state and sends a Chrome user agent.
 *
 * `session.defaultSession` throws before the app is ready, so it is read per call
 * rather than captured at install time.
 */
export const electronHttpClient: MainHttpClient = {
  fetch: async (url, init) => {
    const proxySession = session.defaultSession
    if (!(await awaitProxySessionApplication(proxySession))) {
      throw new Error('Proxy settings are not ready')
    }
    const tls = getProxySessionTlsSettings(proxySession)
    if (!tls || (!tls.certificate && !tls.ignoreErrors)) {
      return net.fetch(url, init)
    }
    const headers = new Headers(init?.headers)
    if (!headers.has('user-agent')) {
      headers.set('user-agent', proxySession.getUserAgent())
    }
    return fetchWithProxyTls(proxySession, tls, url, { ...init, headers })
  },
  proxySession: () => session.defaultSession
}
