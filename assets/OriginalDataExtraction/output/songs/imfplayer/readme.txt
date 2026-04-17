K1n9_Duk3's IMF Player - A simple IMF player for DOS
Copyright (C) 2013-2020 K1n9_Duk3

Based on the Apogee Sound System (ASS) and Wolfenstein 3-D (W3D)

ASS is Copyright (C) 1994-1995 Apogee Software, Ltd.
W3D is Copyright (C) 1992 Id Software, Inc.

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.

===========================================================================

Usage: IMFPLAY <filename> [rate]

The rate parameter is optional. It defines how many times per second new 
commands are sent to the AdLib FM chip. The default rate is 560. You can 
use the [+] and [-] keys to change the rate while the song is being played.
(Isn't that awesome!?)


Notes:
------

This is a DOS program that plays IMF music on an actual AdLib FM chip. If 
your computer doesn't have an AdLib chip, use the DOSBox emulator 
(http://www.dosbox.com) to run this program.

WARNING: When this program was tested with Windows 98, emulated through 
Microsoft Virtual PC 2007, it froze after loading the main screen. After
quitting/rebooting to DOS mode, it ran perfectly fine on the same virtual
machine. On a real Pentium-S 200 MHz, the program ran perfectly fine under
Windows 98 and in DOS mode.

In its current implementation, the IMF player does not suffer from the same 
64K limits as the playback routines in the original DOS games. Any raw IMF 
file can be played, as long as there is enough memory available to load the 
file.

The source code was compiled with Open Watcom 1.7, building a 16-bit DOS 
executable with the default options. You shouldn't have much trouble 
getting it to compile. If you find any bugs I've missed or do anything cool
with the source code, please let me know!


K1n9_Duk3
k1n9duk3@arcor.de

Version 1.3 (2020-05-10)
* added support for KMF files

Version 1.2 (2016-10-25)

* fixed bug in IMF_GetTotalTicks, so the final delay is not added
  (the final delay is ignored by the playback routine)


Version 1.1 (2016-03-06)

* added ADLIB_ResetQnD() for basic DRO2IMF compatibility


Version 1.0 (2013-02-14)