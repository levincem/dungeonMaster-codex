# Hall Of Fame VPS Setup

Etat revu le `2026-05-16`.

Ce document decrit le deploiement minimal du `Hall of Fame` partage sur un VPS avec `Apache` deja en place.

Note:

- ce pipeline a maintenant ete valide en vrai sur le VPS du site

## Vue d'ensemble

Pieces cote repo:

- le front lit et ecrit d'abord via `/api/hall-of-fame`
- si l'API n'est pas disponible, le front garde un fallback `localStorage`
- le mini service serveur est `scripts/hall-of-fame-server.mjs`

Pieces cote VPS:

- un service `Node.js` local, lie seulement a `127.0.0.1:3001`
- un reverse proxy `Apache` qui publie uniquement `/api/hall-of-fame`
- un dossier de donnees prive hors web root

## Prerequis

- `Node.js` LTS installe sur le VPS
- `Apache` deja actif
- modules Apache actives:
  - `proxy`
  - `proxy_http`
  - `headers`

## Principe de securite

Le point le plus important:

- aucune requete client ne choisit un chemin de fichier
- le service n'expose qu'une route exacte: `/api/hall-of-fame`
- le nom du fichier est fixe cote serveur: `hall_of_fame.json`
- le dossier de stockage est fourni par la configuration du service, pas par le client
- le JSON ne doit jamais etre servi directement par Apache

En pratique:

- stocker les donnees hors de `DocumentRoot`
- faire ecouter `Node.js` seulement sur `127.0.0.1`
- donner au service un utilisateur dedie
- permissions recommandees:
  - dossier donnees: `700`
  - fichier JSON: `600`

## Exemple d'arborescence

```text
/opt/dungeon-master-hof/
  package.json
  scripts/hall-of-fame-server.mjs

/var/lib/dungeon-master-hof/
  hall_of_fame.json
```

## Preparation systeme

Exemple avec un utilisateur de service dedie:

```bash
sudo useradd --system --home /opt/dungeon-master-hof --shell /usr/sbin/nologin dungeonmasterhof
sudo mkdir -p /opt/dungeon-master-hof
sudo mkdir -p /var/lib/dungeon-master-hof
sudo chown -R dungeonmasterhof:dungeonmasterhof /opt/dungeon-master-hof /var/lib/dungeon-master-hof
sudo chmod 700 /var/lib/dungeon-master-hof
```

Copier ensuite le mini service sur le VPS, au minimum:

- [package.json](/D:/DungeonMaster-codex/package.json)
- [scripts/hall-of-fame-server.mjs](/D:/DungeonMaster-codex/scripts/hall-of-fame-server.mjs)

Si le repo entier est deja deploie ailleurs sur le serveur, il suffit bien sur d'utiliser ce chemin-la.

## Variables d'environnement

Variables utiles:

- `HOF_HOST=127.0.0.1`
- `HOF_PORT=3001`
- `HOF_DATA_DIR=/var/lib/dungeon-master-hof`
- `HOF_TRUST_PROXY=1`

`HOF_TRUST_PROXY=1` n'est a activer que si le trafic passe bien uniquement via `Apache` en local, ce qui est le cas dans la config recommandee ici.

## Service systemd

Exemple d'unite `systemd`:

```ini
[Unit]
Description=Dungeon Master Hall of Fame API
After=network.target

[Service]
Type=simple
User=dungeonmasterhof
Group=dungeonmasterhof
WorkingDirectory=/opt/dungeon-master-hof
Environment=NODE_ENV=production
Environment=HOF_HOST=127.0.0.1
Environment=HOF_PORT=3001
Environment=HOF_DATA_DIR=/var/lib/dungeon-master-hof
Environment=HOF_TRUST_PROXY=1
ExecStart=/usr/bin/node /opt/dungeon-master-hof/scripts/hall-of-fame-server.mjs
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/dungeon-master-hof

[Install]
WantedBy=multi-user.target
```

Puis:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dungeon-master-hof.service
sudo systemctl status dungeon-master-hof.service
```

## Reverse proxy Apache

Exemple de bloc `VirtualHost` ou de fragment de site:

```apache
ProxyPreserveHost On
ProxyAddHeaders On

ProxyPass        /api/hall-of-fame http://127.0.0.1:3001/api/hall-of-fame
ProxyPassReverse /api/hall-of-fame http://127.0.0.1:3001/api/hall-of-fame

<Location "/api/hall-of-fame">
    RequestHeader set X-Forwarded-Proto "https"
    Header always set Cache-Control "no-store"
    Header always set X-Content-Type-Options "nosniff"
</Location>
```

Points utiles:

- ne pas faire de proxy large sur `/api/` si ce n'est pas necessaire
- garder le proxy strictement sur `/api/hall-of-fame`
- ne pas ajouter d'alias ou de `DocumentRoot` vers `/var/lib/dungeon-master-hof`

Si besoin, activer les modules:

```bash
sudo a2enmod proxy proxy_http headers
sudo systemctl reload apache2
```

## Validation rapide

Verifier d'abord le service local:

```bash
curl http://127.0.0.1:3001/api/hall-of-fame
```

Puis via Apache:

```bash
curl https://votre-domaine.example/api/hall-of-fame
```

Test de soumission:

```bash
curl -X POST https://votre-domaine.example/api/hall-of-fame \
  -H "Content-Type: application/json" \
  --data '{"entry":{"id":"victory_test_01","name":"Halk","completedAt":1778932500000,"buildVersion":"0.9.2","stats":{"startedAt":1778932440000}}}'
```

## Comportement attendu cote securite

Le service rejette deja:

- les payloads trop gros
- le mauvais `Content-Type`
- le JSON invalide
- les soumissions trop frequentes
- les valeurs absurdes ou hors bornes

Mais il faut garder en tete:

- ce n'est pas un systeme anti-triche fort
- c'est un petit classement fun avec filtrage de la triche triviale
- le vrai garde-fou securite ici est surtout de ne jamais laisser le client choisir un chemin ou un fichier cote serveur

## Etat de fini

Le chantier sera considere ferme quand:

- le service repond bien sur le VPS via Apache
- le front lit et ecrit le classement partage
- une coupure du service laisse encore le fallback local fonctionner cote front
