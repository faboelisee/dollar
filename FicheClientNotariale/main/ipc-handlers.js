'use strict';

const { ipcMain } = require('electron');
const { getMachineFingerprint, validateLicenseKey, saveLicense } = require('./license');

function registerIpcHandlers({ onActivationSuccess, buildStatusPayload }) {
  // Return machine fingerprint (shown in activation dialog)
  ipcMain.handle('license:fingerprint', () => {
    return getMachineFingerprint();
  });

  // Validate and save a license key entered by the user
  ipcMain.handle('license:activate', async (_event, keyString) => {
    const fingerprint = getMachineFingerprint();
    const result = validateLicenseKey(keyString, fingerprint);

    if (result.valid) {
      saveLicense(keyString, result);
      // Notify main process to open the main window
      onActivationSuccess(result);
      return { success: true, status: buildStatusPayload(result) };
    }

    const messages = {
      CLE_INVALIDE: 'La clé de licence est incorrecte. Vérifiez la saisie et réessayez.',
      MACHINE_DIFFERENTE: 'Cette clé a été activée sur un autre ordinateur. Contactez votre fournisseur.',
      LICENCE_EXPIREE: `Votre licence annuelle a expiré le ${result.expiryDate
        ? new Date(result.expiryDate).toLocaleDateString('fr-FR')
        : '(date inconnue)'}. Contactez votre fournisseur pour un renouvellement.`,
    };

    return {
      success: false,
      reason: result.reason,
      message: messages[result.reason] || 'Erreur de validation de la licence.',
    };
  });
}

module.exports = { registerIpcHandlers };
