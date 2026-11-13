'use strict'

const { contextBridge } = require('electron')

// The remote page reads this to treat the window as a native shell.
// distribution stays owner: there is no public Mac download.
contextBridge.exposeInMainWorld('__GOSSOKO_SHELL__', {
  platform: 'mac',
  distribution: 'owner',
  appId: 'com.sinsera.gossoko',
})
