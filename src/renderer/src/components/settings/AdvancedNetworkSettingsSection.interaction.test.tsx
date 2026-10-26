// @vitest-environment happy-dom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import { AdvancedNetworkSettingsSection } from './AdvancedNetworkSettingsSection'
import { useAppStore } from '../../store'

afterEach(() => {
  cleanup()
  useAppStore.setState({ settingsSearchQuery: '' })
})

describe('AdvancedNetworkSettingsSection bypass rules control', () => {
  it.each(['ssl', 'tls', 'certificate', 'pem'])(
    'keeps TLS controls visible when searching for %s',
    (query) => {
      useAppStore.setState({ settingsSearchQuery: query })
      const { getByLabelText } = render(
        <AdvancedNetworkSettingsSection
          settings={getDefaultSettings('/tmp')}
          updateSettings={vi.fn()}
        />
      )
      expect(getByLabelText('Custom CA certificate (PEM)')).toBeTruthy()
    }
  )

  it('saves a CA certificate and keeps SSL bypass off until explicitly enabled', () => {
    const updateSettings = vi.fn()
    const { getByLabelText, getByRole } = render(
      <AdvancedNetworkSettingsSection
        settings={{ ...getDefaultSettings('/tmp'), httpProxyUrl: 'http://proxy.example:8080' }}
        updateSettings={updateSettings}
      />
    )
    const input = getByLabelText('Custom CA certificate (PEM)')
    fireEvent.change(input, { target: { value: '  test certificate  ' } })
    fireEvent.blur(input)
    expect(updateSettings).toHaveBeenCalledWith({ httpProxyCaCertificate: 'test certificate' })
    const toggle = getByRole('switch', { name: 'Ignore SSL certificate errors' })
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(toggle)
    expect(updateSettings).toHaveBeenCalledWith({ httpProxyIgnoreCertificateErrors: true })
  })

  it('reveals TLS-only configuration and reflects external certificate changes', () => {
    const settings = { ...getDefaultSettings('/tmp'), httpProxyCaCertificate: 'first certificate' }
    const { getByLabelText, rerender } = render(
      <AdvancedNetworkSettingsSection settings={settings} updateSettings={vi.fn()} />
    )
    expect(getByLabelText('Custom CA certificate (PEM)')).toHaveProperty(
      'value',
      'first certificate'
    )
    rerender(
      <AdvancedNetworkSettingsSection
        settings={{ ...settings, httpProxyCaCertificate: 'replacement certificate' }}
        updateSettings={vi.fn()}
      />
    )
    expect(getByLabelText('Custom CA certificate (PEM)')).toHaveProperty(
      'value',
      'replacement certificate'
    )
  })

  it('shows a certificate save failure next to the field', async () => {
    const { getByLabelText, findByRole } = render(
      <AdvancedNetworkSettingsSection
        settings={{ ...getDefaultSettings('/tmp'), httpProxyUrl: 'http://proxy.example:8080' }}
        updateSettings={vi.fn().mockRejectedValue(new Error('Enter a valid PEM CA certificate.'))}
      />
    )
    const input = getByLabelText('Custom CA certificate (PEM)')
    fireEvent.change(input, { target: { value: 'invalid' } })
    fireEvent.blur(input)
    expect((await findByRole('alert')).textContent).toContain('valid PEM CA certificate')
  })

  it('explains and saves SOCKS5H in the existing proxy field', () => {
    const updateSettings = vi.fn()
    const { getByLabelText, getByText } = render(
      <AdvancedNetworkSettingsSection
        settings={{ ...getDefaultSettings('/tmp'), httpProxyUrl: 'socks5://127.0.0.1:1080' }}
        updateSettings={updateSettings}
      />
    )
    expect(getByText(/Supports .*socks5h/)).toBeTruthy()
    const input = getByLabelText('HTTP Proxy')
    fireEvent.change(input, { target: { value: 'socks5h://127.0.0.1:1080' } })
    fireEvent.blur(input)
    expect(updateSettings).toHaveBeenCalledWith({ httpProxyUrl: 'socks5h://127.0.0.1:1080' })
  })

  it('keeps newline input and canonicalizes it when focus leaves the textarea', async () => {
    const updateSettings = vi.fn()

    const { container } = render(
      <AdvancedNetworkSettingsSection
        settings={{ ...getDefaultSettings('/tmp'), httpProxyBypassRules: '' }}
        updateSettings={updateSettings}
      />
    )

    const configureButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Configure proxy')
    )
    expect(configureButton).not.toBeUndefined()
    fireEvent.click(configureButton!)

    const textarea = container.querySelector<HTMLTextAreaElement>(
      '#settings-http-proxy-bypass-rules'
    )
    expect(textarea).not.toBeNull()

    fireEvent.change(textarea!, { target: { value: 'localhost\n127.0.0.1\n*.internal.corp' } })
    fireEvent.blur(textarea!)

    expect(updateSettings).toHaveBeenCalledWith({
      httpProxyBypassRules: 'localhost;127.0.0.1;*.internal.corp'
    })
  })

  it('does not commit when Enter is pressed inside the textarea', () => {
    const updateSettings = vi.fn()
    const { container } = render(
      <AdvancedNetworkSettingsSection
        settings={{ ...getDefaultSettings('/tmp'), httpProxyBypassRules: '' }}
        updateSettings={updateSettings}
      />
    )
    fireEvent.click(
      Array.from(container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('Configure proxy')
      )!
    )
    const textarea = container.querySelector<HTMLTextAreaElement>(
      '#settings-http-proxy-bypass-rules'
    )!

    textarea.focus()
    fireEvent.keyDown(textarea, { key: 'Enter', code: 'Enter' })

    expect(document.activeElement).toBe(textarea)
    expect(updateSettings).not.toHaveBeenCalled()
  })
})
