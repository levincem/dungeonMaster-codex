# Playtest Checklist - Levels 1 to 3

Etat pose le `2026-04-17`.

Checklist de playtest interne courte, orientee debut de partie.

But:

- valider le coeur du jeu sans lancer une run complete de plusieurs dizaines d'heures
- verifier que les systemes generiques sont sains sur les premiers niveaux
- accepter qu'une partie des cas tardifs reste explicitement non couverte

## Ce que cette passe valide bien

Si cette passe est bonne jusqu'a la fin du niveau 2 ou 3, on gagne une bonne confiance sur:

- boot, title, recruitment, entree dans la partie
- exploration grillee, collisions, orientation, portes usuelles
- inventaire, equipement, drag and drop, pickup, drop
- combat melee et projectile simple
- comportements creatures standards
- mecanismes muraux et capteurs de sol les plus frequents
- persistance `save / load / resume`
- boucle de survie de base `fatigue / nourriture / eau / sommeil`
- feedback UI principal et coherence des messages

## Ce que cette passe ne valide pas encore

Cette passe ne suffit pas a fermer:

- sequence `Zokathra -> Amalgam -> Firestaff complete -> Fluxcage -> Fuse`
- IA speciale et cas de fin de jeu de `Lord Chaos`
- countdowns rares et puzzles tardifs
- cas rares de teleporteurs/pits multi-niveaux tardifs
- familles de creatures speciales peu presentes au debut
- saturation fine des generateurs et cas limites de repop tardif

Conclusion pratique:

- oui, si les niveaux 1 a 3 sont normaux, c'est tres rassurant pour la suite
- non, ce n'est pas une preuve finale pour tous les cas speciaux de fin de jeu

## Regle de prise de notes

Pour chaque anomalie, noter au minimum:

- niveau
- coordonnee locale `l:x,y` si visible dans le HUD debug
- action realisee
- resultat observe
- resultat attendu
- si une save juste avant existe

## Blockers a remonter tout de suite

Arreter la passe et noter en priorite `blocker beta` si tu vois:

- progression impossible sur un puzzle ou une porte attendue
- save ou resume qui casse l'etat de partie
- creature, projectile ou porte visiblement desynchronise
- chute, teleporter ou transition qui bloque la partie
- freeze, crash, ecran noir non voulu, soft lock UI

## Checklist

## 1. Boot et entree de partie

- Lancer le jeu depuis le titre.
- Verifier que `Enter The Dungeon` fonctionne sans etat bizarre.
- Verifier que le Hall of Champions est stable visuellement.
- Recruter un groupe normal de 2 a 4 champions.
- Entrer dans le donjon.

Attendu:

- pas de blocage au titre
- pas de UI incoherente au recrutement
- pas de champion manquant ou d'inventaire vide aberrant

## 2. Deplacements et lecture du monde

- Avancer, reculer, strafe, tourner plusieurs fois dans des couloirs simples.
- Verifier murs, portes, alcoves et grilles sur plusieurs cases.
- Confirmer que le groupe ne traverse rien par erreur.
- Verifier qu'une porte ouverte/fermee reste dans le bon etat visuel.

Attendu:

- deplacement regulier
- collisions coherentes
- orientation stable
- pas de desync visible entre logique et rendu

## 3. Objets, inventaire et equipement

- Ramasser plusieurs objets au sol.
- Equiper / desequiper arme, torche, sac, cle, nourriture.
- Deplacer des objets entre champions.
- Jeter un objet au sol puis le reprendre.
- Utiliser au moins une cle ou un objet mural si disponible.

Attendu:

- drag and drop sans disparition d'objet
- poids et emplacements coherents
- image et nom d'objet plausibles
- pas de duplication ni perte silencieuse

## 4. Mecanismes usuels

- Activer plusieurs boutons ou switches muraux.
- Tester au moins une pressure plate simple.
- Tester une alcove ou un receptacle si rencontre.
- Verifier un cas `objet depose -> effet`.
- Verifier une porte actionnee par mecanisme plutot que par simple ouverture manuelle.

Attendu:

- feedback lisible
- effet applique au bon moment
- pas de faux positif du type "j'ai l'objet donc ca s'ouvre tout seul"
- pas de mecanisme muet alors qu'il devrait reagir

## 5. Combat de base

- Faire plusieurs combats melee simples.
- Se faire toucher volontairement au moins une fois.
- Tenter une attaque projectile physique si possible.
- Tuer plusieurs familles de creatures presentes au debut.
- Observer au moins un drop de creature.

Attendu:

- contact melee credible
- cooldowns plausibles
- degats recus et infliges coherents
- mort de creature sans etat visuel casse
- loot recupable normalement

## 6. Comportement des creatures

- Verifier poursuite simple dans couloir.
- Verifier reaction quand tu recules ou changes de colonne.
- Verifier qu'une creature a distance garde une distance plausible si rencontree.
- Observer si une creature se coince, tremble ou boucle de maniere evidente.

Attendu:

- comportement global "normal" meme si pas parfait a 100 pourcent
- pas de teleportation sauvage
- pas de groupe fige dans un mur
- pas de monstre immortel ou passif sans raison

## 7. Survie et repos

- Perdre un peu de stamina via deplacement et combat.
- Boire ou manger si possible.
- Tenter le sommeil une fois en zone relativement calme.
- Verifier que le reveil et la reprise du jeu sont propres.

Attendu:

- fatigue plausible
- sommeil qui accelere sans casser le rythme
- nourriture/eau appliquees au bon champion
- pas de boucle de sommeil bloquee

## 8. Magie et projectiles precoces

- Si possible, lancer au moins un sort simple de debut de partie.
- Verifier un projectile magique ou un effet non projectile.
- Tester un cas d'impact sur mur, porte ou creature.

Attendu:

- cout en mana coherent
- message et feedback lisibles
- impact ou echec comprehensible
- pas de projectile bloque en l'air

## 9. Pits, escaliers, transitions

- Si la zone le permet, verifier au moins un cas de pit ou d'escalier.
- Observer que la transition ne casse ni orientation ni etat de party.
- Verifier qu'aucun membre du groupe ne disparait.

Attendu:

- transport propre
- degats/eventuels effets plausibles
- reprise normale du controle

## 10. Save, load, resume

- Faire une save dans un etat calme.
- Quitter puis reprendre avec `Resume`.
- Verifier position, direction, inventaire, HP/stamina/mana, portes et objets au sol.
- Refaire une save apres quelques actions supplementaires.

Attendu:

- retour exact a l'etat sauvegarde
- pas de rollback bizarre
- pas d'objets dupliques ou perdus
- pas de corruption visible apres plusieurs reprises

## 11. Sortie de passe

- Noter jusqu'ou la progression s'est faite sans aide.
- Noter si la logique des mecanismes et monstres parait "naturelle".
- Classer chaque bug rencontre:
- `blocker beta`
- `important beta`
- `post-beta`

## Decision rapide en fin de session

Passe plutot reussie si:

- aucune progression n'a ete bloquee
- aucun bug de save n'est apparu
- les monstres et mecanismes paraissent normaux jusqu'au niveau 2 ou 3
- les bugs restants ressemblent surtout a du polish ou a de la fidelite fine

Passe insuffisante si:

- un puzzle simple ne repond pas
- un monstre ou une porte se comporte de maniere manifestement fausse
- une transition casse la partie
- `save / resume` desynchronise l'etat du monde

## Suite recommandee apres cette passe

Si cette checklist est bonne:

1. corriger les blockers ou gros ecarts restants
2. faire une petite repasse ciblee sur les memes zones pour confirmer
3. seulement ensuite ouvrir une passe plus profonde sur:
- teleporteurs plus exotiques
- generateurs
- milestones de fin de jeu
