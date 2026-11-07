# HILAL sur Apple TV et Vision Pro

Deux applications SwiftUI natives, chacune surveillant **son propre appareil**.
Elles affichent la version du système et la capacité du volume local quand
Foundation la fournit. Les valeurs indisponibles restent explicites. Aucune
connexion à l’iPhone, au Mac ou à un serveur ; aucun accès réseau ajouté.

Les libellés FR/EN/AR suivent la langue de l’appareil. Le simulateur est identifié
comme tel : ses chiffres de stockage ne prouvent pas ceux du matériel réel.

```bash
cd apple-native
xcodegen generate
xcodebuild -project HILALAppleNative.xcodeproj -scheme HILALTV \
  -destination 'generic/platform=tvOS Simulator' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
xcodebuild -project HILALAppleNative.xcodeproj -scheme HILALVision \
  -destination 'generic/platform=visionOS Simulator' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
```

Une recette sur Apple TV et Vision Pro physiques reste nécessaire avant toute
publication. Aucun identifiant de signature ni secret n’est stocké ici.
