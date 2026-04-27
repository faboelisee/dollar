'use strict';

const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');

// Must be set before app.ready — pins localStorage/cookies to our directory
app.setPath('userData', path.join(app.getPath('appData'), 'FicheClientNotariale'));

const { registerIpcHandlers } = require('./ipc-handlers');
const { loadAndValidateLicense } = require('./license');

let mainWindow = null;
let activationWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    title: 'FicheClientNotariale v13',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: !app.isPackaged,
      webSecurity: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'app.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    const licenseResult = loadAndValidateLicense();
    if (licenseResult && licenseResult.valid) {
      mainWindow.webContents.send('license:status', buildStatusPayload(licenseResult));
    }
  });

  if (!app.isPackaged) {
    // DevTools only in development
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  mainWindow.webContents.on('devtools-opened', () => {
    if (app.isPackaged) mainWindow.webContents.closeDevTools();
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => { mainWindow = null; });
}

function createActivationWindow() {
  activationWindow = new BrowserWindow({
    width: 520,
    height: 560,
    resizable: false,
    title: 'Activation — FicheClientNotariale',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    center: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: !app.isPackaged,
    },
  });

  activationWindow.setMenu(null);
  activationWindow.loadFile(path.join(__dirname, '..', 'renderer', 'activation.html'));
  activationWindow.once('ready-to-show', () => activationWindow.show());
  activationWindow.on('closed', () => { activationWindow = null; });
}

function buildStatusPayload(licenseResult) {
  const fmt = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : null;
  const isAnnual = licenseResult.type === 0x02;
  let daysRemaining = null;

  if (isAnnual && licenseResult.expiryDate) {
    daysRemaining = Math.ceil((new Date(licenseResult.expiryDate).getTime() - Date.now()) / 86400000);
  }

  return {
    type: isAnnual ? 'annual' : 'perpetual',
    issueDate: licenseResult.issueDate,
    issueDateFR: fmt(licenseResult.issueDate),
    expiryDate: licenseResult.expiryDate || null,
    expiryDateFR: fmt(licenseResult.expiryDate),
    daysRemaining,
    customerId: licenseResult.customerId,
    customerLabel: `Client #${licenseResult.customerId}`,
  };
}

// Called by IPC handler after successful activation
function onActivationSuccess(licenseResult) {
  if (activationWindow) activationWindow.close();
  createMainWindow();
  // Send status once the main window is ready
  if (mainWindow) {
    mainWindow.once('ready-to-show', () => {
      mainWindow.webContents.send('license:status', buildStatusPayload(licenseResult));
    });
  }
}

app.whenReady().then(() => {
  // Apply Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'none';"
        ],
      },
    });
  });

  registerIpcHandlers({ onActivationSuccess, buildStatusPayload });

  const licenseResult = loadAndValidateLicense();
  if (licenseResult && licenseResult.valid) {
    createMainWindow();
  } else {
    createActivationWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const lr = loadAndValidateLicense();
      if (lr && lr.valid) createMainWindow();
      else createActivationWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
