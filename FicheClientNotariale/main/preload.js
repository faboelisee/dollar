'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Activation window: submit a license key
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),

  // Activation window: get the machine fingerprint to show to the user
  getMachineFingerprint: () => ipcRenderer.invoke('license:fingerprint'),

  // Main app: receive license status pushed by main process
  onLicenseStatus: (callback) => {
    ipcRenderer.on('license:status', (_event, data) => callback(data));
  },
});
