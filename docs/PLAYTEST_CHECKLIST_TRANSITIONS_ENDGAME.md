# Playtest Checklist - Transitions And Endgame

Etat pose le `2026-04-20`.

Checklist courte pour fermer les points runtime encore ouverts sans refaire tout le donjon.

Regle simple:

- chaque scenario doit finir avec `OK`, `BUG` ou `A REJOUER`
- si `BUG`, noter une reproduction courte et le niveau/case si possible
- si un scenario couvre plusieurs sous-cas, ne le marquer `OK` que si tout passe

## 1. Generateurs / transitions de niveau

### 1. Teleporter avec creatures presentes

But:

- verifier qu'un teleporter ouvert sous creatures applique bien le transport
- verifier que rotation / cellule / direction restent coherentes

A observer:

- pas de duplication
- pas de disparition silencieuse
- pas de creature bloquee dans une cellule invalide

### 2. Pit qui s'ouvre sous creatures

But:

- verifier la chute immediate des creatures
- verifier les degats et la case d'arrivee

A observer:

- pas de creature qui flotte sur le pit ouvert
- pas de double application de chute

### 3. Pit ou teleporter sous la party

But:

- verifier l'application immediate de l'effet sur la party
- verifier que les creatures presentes sur la destination restent coherentes

A observer:

- transport immediat
- pas d'etat intermediaire casse

### 4. Changement de niveau puis retour

But:

- verifier la distinction runtime `active / dormant`
- verifier le reveil correct des groupes quand on revient

A observer:

- pas de repop double
- pas de groupes oublies
- pas de saturation artificielle au retour

### 5. Repop tardif d'un generateur

But:

- verifier qu'un spawn differe `move later` finit bien par se materialiser
- verifier qu'il reutilise le blueprint gele au lieu de reroller

A observer:

- composition stable
- pas de reroll visible des HP / taille / formation
- pas de boucle pending infinie

## 2. Endgame / mecanismes rares

### 6. `Zo Kath Ra`

But:

- verifier la creation de l'objet
- verifier le comportement si les mains sont libres ou pleines

A observer:

- equip direct si possible
- drop sol propre sinon

### 7. `Firestaff` incomplet -> complet

But:

- verifier l'echange et la transformation
- verifier qu'aucune recompense cachee n'est reprise plusieurs fois

A observer:

- objet final correct
- pas de duplication

### 8. `Fuse` sur mauvaise cible / sans preconditions

But:

- verifier les refus propres
- verifier qu'on n'entre pas en `endgame` par erreur

A observer:

- message correct
- pas de reset etrange

### 9. `Fuse` sur `Lord Chaos` fluxcage

But:

- verifier l'entree en phase `endgame`
- verifier la sequence de messages et le nettoyage progressif

A observer:

- phase `endgame` active
- messages dans l'ordre
- masquage fluxcages au bon moment

### 10. Fin de sequence et victoire

But:

- verifier le passage `endgame -> victory`
- verifier l'ecran final et l'absence de ticks exploration parasites

A observer:

- pas de retour exploration
- pas de combat parasite pendant la sequence
- ecran `victory` atteint proprement

## Sortie attendue

Quand cette checklist est remplie:

- on sait si le bloc `generateurs / transitions` est reellement ferme en jeu
- on sait si `endgame / victory` est assez solide pour ne plus rester un doute abstrait
- les bugs restants deviennent des tickets courts, pas des zones floues
