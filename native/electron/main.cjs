'use strict'

/**
 * Owner-only Mac desktop shell for Gossoko.
 * Not a public distribute build: no auto-update, no installer publish.
 * Run from native/ with `npm run open:mac` (see docs/MAC.md).
 */

const { app, BrowserWindow, nativeImage, shell } = require('electron')
const fs = require('fs')
const path = require('path')
const { canNavigate, resolveStartUrl, shellFromConfig } = require('./shellConfig.cjs')

const UA_MARK = 'GossokoMac'
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'capacitor.config.json'), 'utf8'))
const desktop = shellFromConfig(config)
const startUrl = resolveStartUrl(config, process.env)

const ICON_PNG = path.join(__dirname, 'icon.png')
const ICON_ICNS = path.join(__dirname, 'icon.icns')

let win = null

function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 640,
    minWidth: 960,
    minHeight: 640,
    title: desktop.appName,
    icon: process.platform === 'darwin' ? ICON_ICNS : ICON_PNG,
    backgroundColor: desktop.backgroundColor,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  const ua = win.webContents.getUserAgent()
  if (!ua.includes(UA_MARK)) {
    win.webContents.setUserAgent(`${ua} ${UA_MARK}/${desktop.appId}`)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (canNavigate(url, desktop.allowNavigation)) return { action: 'allow' }
    shell.openExternal(url).catch(() => {})
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (canNavigate(url, desktop.allowNavigation)) return
    event.preventDefault()
    shell.openExternal(url).catch(() => {})
  })

  win.webContents.on('did-fail-load', (_event, code, _desc, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return
    if (!win) return
    win.loadFile(path.join(__dirname, '..', 'www', 'offline.html'))
  })

  win.loadURL(startUrl)
  if (process.argv.includes('--dev')) win.webContents.openDevTools({ mode: 'detach' })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.whenReady().then(() => {
    // Unpackaged Electron shows its own icon in the Dock; use the Gossoko mark.
    if (process.platform === 'darwin' && app.dock && fs.existsSync(ICON_PNG)) {
      app.dock.setIcon(nativeImage.createFromPath(ICON_PNG))
    }
    createWindow()
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}
