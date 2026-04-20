'use strict';
/**
 * export_mechanisms.js
 * Exporte tous les mécanismes d'ouverture (serrures, leviers, dalles, faux-murs)
 * du donjon, avec noms d'objets résolus depuis GRAPHICS.DAT.
 * Résultat : output/mechanisms.json + output/mechanisms.txt
 */

const fs = require('fs');

// ── Table des noms d'icônes extraits de GRAPHICS.DAT offset 0x47150 ──────────
const ICON_NAMES = [
  'COMPASS','COMPASS','COMPASS','COMPASS',           // 0-3
  'TORCH','TORCH','TORCH','TORCH',                   // 4-7
  'WATERSKIN','WATER',                               // 8-9
  'JEWEL SYMAL','JEWEL SYMAL',                       // 10-11
  'ILLUMULET','ILLUMULET',                           // 12-13
  'FLAMITT','FLAMITT',                               // 14-15
  'EYE OF TIME','EYE OF TIME',                       // 16-17
  'STORMRING','STORMRING',                           // 18-19
  'STAFF OF CLAWS','STAFF OF CLAWS','STAFF OF CLAWS',// 20-22
  'BOLT BLADE','BOLT BLADE',                         // 23-24
  'FURY','FURY',                                     // 25-26
  'THE FIRESTAFF','THE FIRESTAFF','THE FIRESTAFF',   // 27-29
  'OPEN SCROLL','SCROLL',                            // 30-31
  'DAGGER','FALCHION','SWORD','RAPIER','SABRE','SAMURAI SWORD', // 32-37
  'DELTA','DIAMOND EDGE','VORPAL BLADE','THE INQUISITOR',       // 38-41
  'AXE','HARDCLEAVE','MACE','MACE OF ORDER',                    // 42-45
  'MORNINGSTAR','CLUB','STONE CLUB',                            // 46-48
  'BOW','CROSSBOW','ARROW','SLAYER','SLING',                    // 49-53
  'ROCK','POISON DART','THROWING STAR','STICK',                 // 54-57
  'STAFF','WAND','TEOWAND','YEW STAFF',                         // 58-61
  'STAFF OF MANAR','SNAKE STAFF','THE CONDUIT',                 // 62-64
  'DRAGON SPIT','SCEPTRE OF LYF',                               // 65-66
  'ROBE','FINE ROBE','KIRTLE','SILK SHIRT','ELVEN DOUBLET',     // 67-71
  'LEATHER JERKIN','TUNIC','GHI','MAIL AKETON','MITHRAL AKETON',// 72-76
  'TORSO PLATE','PLATE OF LYTE','PLATE OF DARC',                // 77-79
  'CAPE','CLOAK OF NIGHT','BARBARIAN HIDE',                     // 80-82
  'ROBE','FINE ROBE','TABARD','GUNNA','ELVEN HUKE',             // 83-87
  'LEATHER PANTS','BLUE PANTS','GHI TROUSERS',                  // 88-90
  'LEG MAIL','MITHRAL MAIL','LEG PLATE',                        // 91-93
  'POLEYN OF LYTE','POLEYN OF DARC',                            // 94-95
  'BEZERKER HELM','HELMET','BASINET',"CASQUE 'N COIF",          // 96-99
  'ARMET','HELM OF LYTE','HELM OF DARC','CALISTA',              // 100-103
  'CROWN OF NERRA',                                             // 104
  'BUCKLER','HIDE SHIELD','SMALL SHIELD','WOODEN SHIELD',       // 105-108
  'LARGE SHIELD','SHIELD OF LYTE','SHIELD OF DARC',             // 109-111
  'SANDALS','SUEDE BOOTS','LEATHER BOOTS','HOSEN',              // 112-115
  'FOOT PLATE','GREAVE OF LYTE','GREAVE OF DARC','ELVEN BOOTS', // 116-119
  'GEM OF AGES','EKKHARD CROSS','MOONSTONE','THE HELLION',      // 120-123
  'PENDANT FERAL','COPPER COIN','SILVER COIN','GOLD COIN',      // 124-127
  'BOULDER','BLUE GEM','ORANGE GEM','GREEN GEM',                // 128-131
  'MAGICAL BOX','MAGICAL BOX','MIRROR OF DAWN','HORN OF FEAR',  // 132-135
  'ROPE','RABBIT\'S FOOT','CORBAMITE','CHOKER',                  // 136-139
  'DEXHELM','FLAMEBAIN','POWERTOWERS','SPEEDBOW',               // 140-143
  'CHEST','OPEN CHEST','ASHES','BONES',                         // 144-147
  'MON POTION','UM POTION','DES POTION','VEN POTION',           // 148-151
  'SAR POTION','ZO POTION','ROS POTION','KU POTION',            // 152-155
  'DANE POTION','NETA POTION','BRO POTION','MA POTION',         // 156-159
  'YA POTION','EE POTION','VI POTION','WATER FLASK',            // 160-163
  'KATH BOMB','PEW BOMB','RA BOMB','FUL BOMB',                  // 164-167
  'APPLE','CORN','BREAD','CHEESE',                              // 168-171
  'SCREAMER SLICE','WORM ROUND','DRUMSTICK','DRAGON STEAK',     // 172-175
  'IRON KEY','KEY OF B','SOLID KEY','SQUARE KEY',               // 176-179
  'TOURQUOISE KEY','CROSS KEY','ONYX KEY','SKELETON KEY',       // 180-183
  'GOLD KEY','WINGED KEY','TOPAZ KEY','SAPPHIRE KEY',           // 184-187
  'EMERALD KEY','RUBY KEY','RA KEY','MASTER KEY',               // 188-191
  'LOCK PICKS','MAGNIFIER','BOOTS OF SPEED','EMPTY FLASK',      // 192-195
  'HALTER','ZOKATHRA SPELL','BONES','',                         // 196-199
];

function iconName(id) {
  return ICON_NAMES[id] || `Icon_${id}`;
}

// ── Catégories de sensors ─────────────────────────────────────────────────────
const WALL_SENSOR_LABELS = {
  1:  'Levier / bouton mural',
  2:  'Bouton (objet quelconque requis)',
  3:  'Serrure (objet spécifique)',
  4:  'Serrure (objet consommé)',
  5:  'Porte logique AND/OR',
  6:  'Compte à rebours',
  11: 'Serrure (objet consommé + rotation)',
  12: 'Générateur d\'objet mural',
  13: 'Alcôve (dépôt/retrait objet)',
  16: 'Échangeur d\'objet',
  17: 'Serrure (objet consommé + suppression sensor)',
  18: 'Fin de jeu',
};
const FLOOR_SENSOR_LABELS = {
  1: 'Dalle de pression (tout)',
  2: 'Dalle de pression (créature)',
  3: 'Capteur de passage (party / orientation)',
  4: 'Dalle de pression (objet spécifique)',
  5: 'Dalle d\'escalier',
  6: 'Générateur de groupe (sol)',
  7: 'Dalle de pression (créature uniquement)',
  8: 'Dalle de possession (groupe détient objet)',
  9: 'Vérificateur de version',
};

// ── Filtres : mécanismes "intéressants" (pas les pièges/lanceurs/portraits) ───
function describeFloorSensor(obj) {
  if (obj.type !== 3) {
    return FLOOR_SENSOR_LABELS[obj.type] || `Type sol ${obj.type}`;
  }

  return obj.data === 0
    ? 'Capteur de passage (party)'
    : 'Capteur d orientation (party)';
}

function isInteresting(sensor, tileType) {
  const t = sensor.type;
  if (t === 0 || t === 127) return false;           // désactivé / portrait
  if (tileType === 'Wall' && t >= 7 && t <= 10) return false;  // lanceurs de projectiles
  if (tileType === 'Wall' && (t === 14 || t === 15)) return false; // lanceurs (carré)
  if (tileType === 'Floor' && t === 6) return false; // générateurs de groupe (bruit)
  return true;
}

// ── Chargement du donjon ──────────────────────────────────────────────────────
const dungeon = JSON.parse(fs.readFileSync('./output/dungeon.json', 'utf8'));

// ── Construction du rapport ───────────────────────────────────────────────────
const report = { maps: [] };
const lines  = [];

for (const map of dungeon.maps) {
  const mechanisms = [];

  for (const tile of map.tiles) {
    if (!tile.objects || tile.objects.length === 0) continue;

    for (const obj of tile.objects) {
      if (obj.category !== 'Sensor') continue;
      if (!isInteresting(obj, tile.type)) continue;

      const isWall  = tile.type === 'Wall' || tile.type === 'TrickWall';
      const label   = isWall
        ? (WALL_SENSOR_LABELS[obj.type]  || `Type mural ${obj.type}`)
        : describeFloorSensor(obj);

      // Résolution de l'objet requis (pour serrures / dalles objet)
      let requiredObject = null;
      if (isWall && [3, 4, 11, 17].includes(obj.type)) {
        // Serrures murales : data = icon ID de l'objet requis
        requiredObject = iconName(obj.data);
      } else if (!isWall && obj.type === 4) {
        // Dalle objet spécifique : data = icon ID de l'objet à poser
        requiredObject = iconName(obj.data);
      } else if (!isWall && obj.type === 8) {
        // Dalle possession : data = icon ID de l'objet que le groupe doit posséder
        requiredObject = iconName(obj.data);
      }

      // Cible (que ça ouvre/ferme)
      const hasTarget = obj.targetX !== 0 || obj.targetY !== 0;
      const target = hasTarget
        ? { x: obj.targetX, y: obj.targetY }
        : null;

      const entry = {
        x:       tile.x,
        y:       tile.y,
        support: tile.type,
        face:    obj.tilePos,
        kind:    label,
        action:  obj.action,
        onceOnly: obj.onceOnly || false,
        target,
      };
      if (requiredObject) entry.requires = requiredObject;
      if (obj.type === 13 || obj.type === 12 || obj.type === 16) {
        entry.storedObjectIcon = obj.data;
        entry.storedObject = iconName(obj.data);
      }

      mechanisms.push(entry);
    }
  }

  if (mechanisms.length === 0) continue;

  report.maps.push({ name: map.name, index: map.index, mechanisms });

  // ── Formatage texte ─────────────────────────────────────────────────────────
  lines.push('');
  lines.push('═'.repeat(70));
  lines.push(`  ${map.name.toUpperCase()}  (map ${map.index})`);
  lines.push('═'.repeat(70));

  // Regroupement par catégorie
  const locks    = mechanisms.filter(m => [3,4,11,17].some(t => m.kind.startsWith('Serrure')));
  const levers   = mechanisms.filter(m => m.kind.startsWith('Levier') || m.kind.startsWith('Bouton'));
  const plates   = mechanisms.filter(m => m.kind.startsWith('Dalle'));
  const others   = mechanisms.filter(m => !locks.includes(m) && !levers.includes(m) && !plates.includes(m));

  const section = (title, items) => {
    if (items.length === 0) return;
    lines.push('');
    lines.push(`  ── ${title} ──`);
    for (const m of items) {
      let line = `    (${String(m.x).padStart(2)},${String(m.y).padStart(2)})`;
      line += `  ${m.support} face:${m.face.padEnd(5)}`;
      line += `  [${m.action}]`;
      if (m.requires)      line += `  🗝  requis: ${m.requires}`;
      if (m.storedObject)  line += `  📦 objet: ${m.storedObject}`;
      if (m.target)        line += `  → (${m.target.x},${m.target.y})`;
      if (m.onceOnly)      line += '  [USAGE UNIQUE]';
      lines.push(line);
    }
  };

  section('SERRURES', locks);
  section('LEVIERS / BOUTONS', levers);
  section('DALLES DE PRESSION', plates);
  section('AUTRES MÉCANISMES', others);
}

// ── Écriture des fichiers ─────────────────────────────────────────────────────
fs.writeFileSync('./output/mechanisms.json', JSON.stringify(report, null, 2), 'utf8');
fs.writeFileSync('./output/mechanisms.txt',  lines.join('\n'), 'utf8');

// ── Résumé console ───────────────────────────────────────────────────────────
let totalLocks = 0, totalLevers = 0, totalPlates = 0, totalOther = 0;
for (const m of report.maps) {
  totalLocks  += m.mechanisms.filter(x => x.requires).length;
  totalLevers += m.mechanisms.filter(x => x.kind.startsWith('Levier') || x.kind.startsWith('Bouton')).length;
  totalPlates += m.mechanisms.filter(x => x.kind.startsWith('Dalle')).length;
  totalOther  += m.mechanisms.filter(x => !x.requires && !x.kind.startsWith('Levier') && !x.kind.startsWith('Bouton') && !x.kind.startsWith('Dalle')).length;
}
console.log('✓  output/mechanisms.json + output/mechanisms.txt générés');
console.log(`   Serrures    : ${totalLocks}`);
console.log(`   Leviers     : ${totalLevers}`);
console.log(`   Dalles      : ${totalPlates}`);
console.log(`   Autres      : ${totalOther}`);
console.log(`   Total       : ${totalLocks + totalLevers + totalPlates + totalOther} mécanismes`);

