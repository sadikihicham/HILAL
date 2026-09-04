# HILAL Desktop

Moniteur **matériel 100 % local** pour macOS, Linux et Windows : températures et ventilateurs,
processus les plus gourmands (avec arrêt), batterie, mémoire, disques, réseau, et une
icône de barre d'état configurable.

> **Zéro réseau sortant.** L'application ne fait aucun appel réseau, aucune télémétrie,
> aucune analytique. C'est un invariant vérifié à chaque *pull request* par une porte
> d'intégration continue qui échoue si un appel réseau apparaît — côté interface
> (`fetch`, `WebSocket`, `XMLHttpRequest`…) **comme** côté moteur Rust (`reqwest`,
> `TcpStream`…). L'interface est en outre verrouillée par une politique de sécurité de
> contenu en `connect-src 'none'`.

## Téléchargement

| Plateforme | Fichier |
|---|---|
| **macOS** — Intel **et** Apple Silicon | `HILAL Desktop_<version>_universal.dmg` |
| **Windows 10 / 11** — 64 bits | `HILAL Desktop_<version>_x64-setup.exe` |
| **Linux** — Debian / Ubuntu, 64 bits | `HILAL Desktop_<version>_amd64.deb` |
| **Linux** — toute distribution, 64 bits | `HILAL Desktop_<version>_amd64.AppImage` |

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

### Linux

Rien à contourner : Linux n'impose aucune signature d'éditeur. Deux formats au choix.

**Paquet Debian / Ubuntu** — installation propre, dépendances résolues par le gestionnaire :

```bash
sudo apt install ./HILAL\ Desktop_<version>_amd64.deb
```

**AppImage** — fichier unique, aucune installation, fonctionne sur toute distribution :

```bash
chmod +x HILAL\ Desktop_<version>_amd64.AppImage
./HILAL\ Desktop_<version>_amd64.AppImage
```

> Deux points à connaître. **(1)** L'AppImage se monte via **FUSE 2** ; sur une
> distribution récente (Ubuntu 24.04 et suivantes) installez `libfuse2t64`, ou extrayez
> l'application avec `--appimage-extract` pour vous en passer. **(2)** Les binaires sont
> compilés sur une image Ubuntu récente : sur une distribution nettement plus ancienne,
> le lancement peut échouer sur un message `GLIBC_2.xx not found`. L'AppImage n'y change
> rien — elle embarque les bibliothèques de l'application, pas la bibliothèque C du système.

## Ce que l'application fait sur votre machine

- Elle **lit** l'état du matériel : capteurs thermiques, ventilateurs, processus,
  batterie, mémoire, disques, interfaces réseau.
- La **seule** action qui modifie la machine est **l'arrêt d'un processus que vous
  demandez explicitement**, confirmé en deux temps dans l'interface. Le système
  d'exploitation reste seul juge des droits : l'application ne contourne rien.
- Elle n'écrit rien d'autre que ses propres préférences.

## Différences entre plateformes

Certaines mesures dépendent de ce que le système accepte d'exposer :

| Mesure | macOS | Linux | Windows |
|---|---|---|---|
| Températures | ✅ capteurs IOHID | ✅ `hwmon` | ✅ si le pilote les expose |
| Ventilateurs | ✅ SMC | ✅ `/sys/class/hwmon` | ❌ indisponible — aucun pilote noyau n'expose la vitesse |
| Énergie par processus | ✅ mesure noyau réelle | 🟡 estimation, signalée comme telle | 🟡 estimation, signalée comme telle |

Sur le poste d'un administrateur, Linux est donc **mieux servi que Windows** : c'est la
seule des deux plateformes non-Apple où la vitesse des ventilateurs est réellement lue.

Une valeur absente est affichée comme telle — elle n'est jamais inventée ni extrapolée.

---

Le détail des changements de chaque version est dans l'historique du dépôt :
<https://github.com/sadikihicham/HILAL/commits/master/desktop>.
