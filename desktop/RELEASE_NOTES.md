# HILAL Desktop

Moniteur **matériel 100 % local** pour Windows et macOS : températures et ventilateurs,
processus les plus gourmands (avec arrêt), batterie, mémoire, disques, réseau, et une
icône de barre d'état configurable.

> **Zéro réseau sortant.** L'application ne fait aucun appel réseau, aucune télémétrie,
> aucune analytique. C'est un invariant vérifié à chaque *pull request* par une porte
> d'intégration continue qui échoue si un `fetch(` apparaît dans le code.

## Téléchargement

| Plateforme | Fichier |
|---|---|
| **macOS** — Intel **et** Apple Silicon | `HILAL Desktop_<version>_universal.dmg` |
| **Windows 10 / 11** — 64 bits | `HILAL Desktop_<version>_x64-setup.exe` |

## ⚠️ Première ouverture : les binaires ne sont pas signés

Aucun certificat éditeur n'est acheté pour ce projet. Les deux systèmes considèrent donc
l'application comme venant d'un développeur non identifié et la bloquent au premier
lancement. Le contournement est manuel, et ne se fait **qu'une seule fois**.

### macOS

Un double-clic affiche « *HILAL Desktop ne peut pas être ouvert* » — ou, sur les versions
récentes, « *est endommagé et ne peut pas être ouvert* ». Ce message est trompeur : le
fichier n'est pas corrompu, il est seulement dépourvu de signature.

1. Glissez `HILAL Desktop.app` dans `/Applications`.
2. **Clic droit** sur l'application → **Ouvrir** → **Ouvrir** dans la boîte de dialogue.
   Le double-clic simple ne propose pas cette option, le clic droit si.
3. Si macOS refuse toujours, retirez l'attribut de quarantaine posé au téléchargement :
   ```bash
   xattr -cr "/Applications/HILAL Desktop.app"
   ```

### Windows

SmartScreen affiche « *Windows a protégé votre ordinateur* ».
Cliquez sur **Informations complémentaires**, puis sur **Exécuter quand même**.

## Ce que l'application fait sur votre machine

- Elle **lit** l'état du matériel : capteurs thermiques, ventilateurs, processus,
  batterie, mémoire, disques, interfaces réseau.
- La **seule** action qui modifie la machine est **l'arrêt d'un processus que vous
  demandez explicitement**, confirmé en deux temps dans l'interface. Le système
  d'exploitation reste seul juge des droits : l'application ne contourne rien.
- Elle n'écrit rien d'autre que ses propres préférences.

## Différences entre plateformes

Certaines mesures dépendent de ce que le système accepte d'exposer :

| Mesure | macOS | Windows | Linux |
|---|---|---|---|
| Températures | ✅ capteurs IOHID | ✅ si le pilote les expose | ✅ `hwmon` |
| Ventilateurs | ✅ SMC | ❌ indisponible (aucun pilote noyau) | ✅ `hwmon` |
| Énergie par processus | ✅ mesure noyau réelle | 🟡 estimation | 🟡 estimation |

Une valeur absente est affichée comme telle — elle n'est jamais inventée ni extrapolée.
