# HILAL Watch

Application watchOS indépendante : elle lit la batterie de **la montre elle-même**
avec WatchKit. Aucun compte, synchronisation, réseau ou accès à l’iPhone n’est requis.
Une mesure absente s’affiche comme indisponible. Interface FR/EN/AR selon la langue
de la montre.
La version de watchOS et le stockage local sont également affichés quand le système
les fournit. Des jauges montrent le niveau de batterie et la part utilisée du
stockage ; elles restent absentes si la mesure manque. Sur simulateur, le stockage
reflète l'hôte et ne valide pas la montre réelle.

## Vérifier localement

```bash
cd watch
xcodegen generate
xcodebuild -project HILALWatch.xcodeproj -scheme HILALWatch \
  -destination 'generic/platform=watchOS Simulator' \
  -derivedDataPath build CODE_SIGNING_ALLOWED=NO build
```

Le simulateur ne prouve pas la batterie réelle. Une recette sur Apple Watch physique
reste nécessaire avant toute publication. Le projet Xcode est généré depuis
`project.yml`; aucun identifiant de signature ou secret n’est stocké ici.
