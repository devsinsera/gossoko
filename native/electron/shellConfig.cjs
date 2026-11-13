'use strict'

/**
 * Shared by the owner Mac shell and tests.
 * The window reads native/capacitor.config.json so the desktop target
 * stays on the same app id and live URL as the iOS and Android shells.
 * This is an owner-run shell, not a public distribute build.
 */

function hostMatches(hostname, pattern) {
  const host = String(hostname || '').toLowerCase()
  const rule = String(pattern || '').toLowerCase()
  if (!host || !rule) return false
  if (rule.startsWith('*.')) {
    const rest = rule.slice(2)
    return host === rest || host.endsWith('.' + rest)
  }
  return host === rule
}

function navigationAllowed(url, patterns) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  return (patterns || []).some((pattern) => hostMatches(parsed.hostname, pattern))
}

function canNavigate(url, patterns) {
  if (typeof url === 'string' && url.startsWith('file:') && url.includes('offline.html')) return true
  return navigationAllowed(url, patterns)
}

function shellFromConfig(config) {
  if (!config || config.appId !== 'com.sinsera.gossoko') {
    throw new Error('Mac shell requires appId com.sinsera.gossoko')
  }
  if (config.appName !== 'Gossoko') {
    throw new Error('Mac shell requires appName Gossoko')
  }
  const url = config.server && config.server.url
  if (url !== 'https://sinsera.co/gossoko/') {
    throw new Error('Mac shell loads https://sinsera.co/gossoko/')
  }
  return {
    appId: config.appId,
    appName: config.appName,
    url,
    backgroundColor: (config.backgroundColor || '#0a0908'),
    allowNavigation: (config.server && config.server.allowNavigation) || [],
    distribution: 'owner',
    platform: 'mac',
  }
}

function resolveStartUrl(config, env) {
  const shell = shellFromConfig(config)
  const override = env && env.GOSSOKO_SHELL_URL
  if (override) {
    if (!navigationAllowed(override, shell.allowNavigation)) {
      throw new Error('GOSSOKO_SHELL_URL is outside allowNavigation')
    }
    return override
  }
  return shell.url
}

module.exports = {
  canNavigate,
  hostMatches,
  navigationAllowed,
  resolveStartUrl,
  shellFromConfig,
}
