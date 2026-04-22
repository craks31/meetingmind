const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Save the Google Gemini API key (encrypted via safeStorage) */
  saveApiKey: (key) => ipcRenderer.invoke('save-api-key', key),

  /** Retrieve the decrypted Gemini API key; returns '' if not set */
  getApiKey: () => ipcRenderer.invoke('get-api-key'),

  /** Window controls */
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow:    () => ipcRenderer.invoke('close-window'),

  /** Platform string ('win32' | 'darwin' | 'linux') */
  platform: process.platform,
});
