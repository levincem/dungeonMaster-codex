# Images manquantes - DungeonMaster

============================================================
SECTION 1 - Images deja creees, a mapper dans itemImages.ts
Ces fichiers sont dans public/items/ mais pas encore references.
============================================================

## Armes
  bolt_blade_empty.png
  bolt_blade_full.png
  boulder.png
  calista.png
  club.png
  diamond_edge.png
  flamebain.png
  flamitt_empty.png
  flamitt_full.png
  hardcleave.png
  mace.png
  mace_of_order.png
  morningstar.png
  powertowers.png
  samurai_sword.png
  snake_staff.png
  speedbow.png
  staff_of_manar.png
  stick.png
  stone_club.png
  the_conduit.png
  the_firestaff.png
  the_firestaff_complete.png
  the_inquisitor.png

## Armures / Boucliers
  bezerker_helm.png
  boots_of_speed.png
  dexhelm.png
  elven_huke.png
  fine_robe_body.png
  mithral_aketon.png
  mithral_mail.png
  small_shield.png
  wooden_shield.png

## Misc / Cles / Gemmes
  blue_gem.png
  champion_bones.png
  chest_opened.png
  dragon_spit.png
  emerald_key.png
  eye_of_time_empty.png
  eye_of_time_full.png
  green_gem.png
  horn_of_fear.png
  illumulet_lit.png
  jewel_symal_equipped.png
  onyx_key.png
  orange_gem.png
  ra_key.png
  ruby_key.png
  sapphire_key.png
  sceptre_of_lyf.png
  skeleton_key.png
  solid_key.png
  square_key.png
  stormring_empty.png
  stormring_full.png
  tourquoise_key.png
  water.png

## Potions
  dane_potion.png
  ros_potion.png
  ven_potion.png

============================================================
SECTION 2 - Etat apres raccord des overrides
Les anciens noms inconnus de cette section ont ete reconcilies
et les images identifiables ont ete branchees dans itemImages.ts.
Le seul cas encore special est `typeId 45`.
============================================================

## Note sur `typeId 45`

- Placement observe : niveau 13, mur nord de la salle finale, global `(49,35)`.
- Le contexte original/runtime l'associe a l'Amalgam et a la sequence `Zo Kath Ra` -> insertion du `The Firestaff` -> obtention du `The Firestaff (Complete)`.
- Ce placeholder ne doit pas etre interprete comme un item de sol generique manquant du meme type que les autres armes.
- La cible visuelle utile pour le jeu fini est surtout `the_firestaff_complete.png` une fois la transformation terminee.
