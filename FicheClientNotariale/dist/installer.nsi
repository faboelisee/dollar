; FicheClientNotariale — Script installeur NSIS
; Génère : FicheClientNotariale-Setup-13.0.0.exe

Unicode true

;---- Constantes ----
!define APPNAME    "FicheClientNotariale"
!define VERSION    "13.0.0"
!define PUBLISHER  "Cabinet Notarial"
!define DESCRIPTION "Gestion de dossiers notariaux"
!define INSTALLDIR "$PROGRAMFILES64\${APPNAME}"
!define REGKEY     "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"

Name "${APPNAME} v${VERSION}"
OutFile "../FicheClientNotariale-Setup-${VERSION}.exe"
InstallDir "${INSTALLDIR}"
InstallDirRegKey HKLM "${REGKEY}" "InstallLocation"
RequestExecutionLevel admin
SetCompressor /SOLID lzma

;---- Pages ----
Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

;---- Section principale ----
Section "Application" SEC_MAIN
  SectionIn RO
  SetOutPath "$INSTDIR"
  File /r "win-unpacked\*.*"

  ; Raccourci bureau
  CreateShortCut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\fiche-client-notariale.exe" "" "$INSTDIR\fiche-client-notariale.exe" 0

  ; Raccourci menu Démarrer
  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortCut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\fiche-client-notariale.exe" "" "$INSTDIR\fiche-client-notariale.exe" 0
  CreateShortCut "$SMPROGRAMS\${APPNAME}\Désinstaller.lnk" "$INSTDIR\Uninstall.exe"

  ; Registre Windows (ajout/suppression de programmes)
  WriteRegStr   HKLM "${REGKEY}" "DisplayName"      "${APPNAME} v${VERSION}"
  WriteRegStr   HKLM "${REGKEY}" "DisplayVersion"   "${VERSION}"
  WriteRegStr   HKLM "${REGKEY}" "Publisher"        "${PUBLISHER}"
  WriteRegStr   HKLM "${REGKEY}" "InstallLocation"  "$INSTDIR"
  WriteRegStr   HKLM "${REGKEY}" "UninstallString"  '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKLM "${REGKEY}" "NoModify" 1
  WriteRegDWORD HKLM "${REGKEY}" "NoRepair" 1

  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

;---- Désinstalleur ----
Section "Uninstall"
  Delete "$DESKTOP\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
  Delete "$SMPROGRAMS\${APPNAME}\Désinstaller.lnk"
  RMDir  "$SMPROGRAMS\${APPNAME}"

  RMDir /r "$INSTDIR"
  DeleteRegKey HKLM "${REGKEY}"
SectionEnd
