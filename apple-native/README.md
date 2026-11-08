# HILAL sur Apple TV et Vision Pro

Deux applications SwiftUI natives, chacune surveillant **son propre appareil**.
Elles affichent la version du système, le stockage local, la mémoire physique
totale et le nombre de cœurs logiques quand Foundation les fournit. Une jauge
montre la part utilisée du stockage lorsque la mesure est valide. Les valeurs
indisponibles restent explicites. Aucune connexion à l’iPhone, au Mac ou à un
serveur ; aucun accès réseau ajouté.

Sous 10 % d'espace libre, un avertissement local s'affiche. Dans le simulateur,
il désigne explicitement le stockage de l'ordinateur hôte. Le bouton Actualiser
relit les mesures et affiche l'heure de cette lecture ; aucune surveillance en
arrière-plan n'est promise.

Les libellés FR/EN/AR suivent la langue de l’appareil. Le simulateur est identifié
comme tel : ses chiffres de stockage, mémoire et cœurs reflètent l'hôte de
simulation et ne prouvent pas les valeurs du matériel réel.

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

## Préparation avant publication

Les deux cibles sont des applications indépendantes : elles ont donc chacune
leur identifiant, leur fiche App Store Connect, leurs métadonnées et leur cycle
de version. Avant de créer une archive distribuable, vérifier cette liste :

| Cible | Identifiant | À confirmer avant archive |
| --- | --- | --- |
| Apple TV | `com.sadikihicham.hilal.tv` | Fiche tvOS, icônes TV, profil et essai sur Apple TV réelle |
| Vision Pro | `com.sadikihicham.hilal.vision` | Fiche visionOS, icônes visionOS, profil et essai dans le casque |

Pour chaque cible, le propriétaire doit confirmer dans Apple Developer et App
Store Connect que l'identifiant est enregistré, que les accords sont actifs,
que le certificat Distribution et le profil correspondent à la cible, puis
choisir un numéro de build supérieur au dernier build accepté. La recette
physique doit notamment vérifier les mesures affichées, Actualiser, la langue
française et arabe, et l'alerte de stockage sous 10 %. Une archive, un envoi
TestFlight ou une soumission App Store restent des actions séparées : elles ne
sont pas réalisées par cette PR.
