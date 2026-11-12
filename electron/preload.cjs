'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hitboxDesktop', {
  version: () => ipcRenderer.invoke('app:version'),
  platform: () => ipcRenderer.invoke('app:platform'),
  listPresets: () => ipcRenderer.invoke('presets:list'),
  savePreset: (preset) => ipcRenderer.invoke('presets:save', preset),
  deletePreset: (id) => ipcRenderer.invoke('presets:delete', id),
  exportPreset: (preset) => ipcRenderer.invoke('presets:export', preset),
  importPreset: () => ipcRenderer.invoke('presets:import'),
  openMapsFolder: () => ipcRenderer.invoke('maps:openFolder'),
  openExternal: (url) => ipcRenderer.invoke('maps:openExternal', url),
  launchGame: () => ipcRenderer.invoke('game:launch'),
  checkForUpdates: () => ipcRenderer.invoke('updates:check'),
  installUpdate: () => ipcRenderer.invoke('updates:install'),
  getUpdateState: () => ipcRenderer.invoke('updates:state'),
  onUpdateState: (callback) => {
    ipcRenderer.removeAllListeners('updates:state');
    ipcRenderer.on('updates:state', (_event, state) => callback(state));
  },
});
