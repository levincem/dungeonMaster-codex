K1n9_Duk3's IMF to WAV converter - Converts IMF files to WAV.
Copyright (C) 2013-2020 K1n9_Duk3

Based on Wolf4SDL by Moritz "Ripper" Kroll (http://www.chaos-software.de.vu)

The OPL emulator (fmopl.cpp, fmopl.h) is used under the terms of the
MAME license (see license-mame.txt for more details). 

Redistributions of this program may not be sold, nor may they be used 
in a commercial product or activity, unless a different OPL emulator 
is used.

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

===============================================================================

Usage: IMF2WAV <imffile> [wavefile [imfrate [hertz [mask]]]]

The parameters wavefile, imfrate, hertz and mask are optional. The brackets 
indicate that if you want to set imfrate, you have specify wavefile as the 
second argument. Same applies to hertz and mask. wavefile is the name of the 
output file and defaults to <imffile>.wav, imfrate defines how many times per 
second new commands are sent to the OPL emulator and defaults to 560. hertz 
defines the sample rate of the resulting wave file and defaults to 44100.

mask defines which AdLib channels should be played and defaults to -1 (all
channels). Each bit in the mask value indicates the state of an AdLib channel.
The lower 9 bits (1, 2, 4, 8, 16, 32, 64, 128, 256) are for the regular AdLib
channels, the next 5 bits (512, 1024, 2048, 4096, 8192) represent the rhythm
mode channels. To combine these bits, simply add the corresponding values.

Examples:

This converts "apogfnf1.imf" to "apogfnf1.imf.wav":
>imf2wav apogfnf1.imf

This converts "apogfnf1.imf" to "fanfare.wav":
>imf2wav apogfnf1.imf fanfare.wav

This converts Duke Nukem II's "fanfarea.imf" to "fanfare.wav":
>imf2wav apogfnf1.imf fanfare.wav 280

This converts Wolfenstein 3D's "pacman.imf" to "pacman.wav" at 22050 Hz:
>imf2wav pacman.imf pacman.wav 700 22050

This converts all rhythm mode channels from "main.imf":
>imf2wav main.imf main.wav 560 44100 15872


Creating single-channel WAV files from an IMF song:
---------------------------------------------------

I know that using bit values to indicate which channels to play is a bit
complicated. To make things a little easier, I included a batch file that will
convert an IMF song into several single-channel WAV files. This batch file is
called "imf2wavs.cmd" and it basically runs imf2wav.exe 14 times to create 14
WAV files.

This will convert "main.imf" to multiple single-channel WAV files:
>imf2wavs main.imf

The resulting files will be named "main.imf-01.wav" to "main.imf-14.wav".
Please note that any WAV file that contains nothing but silence will auto-
matically be deleted by this batch file.

The imfrate and herz settings are not passed to the batch file. You must edit
the "imf2wavs.cmd" file (right-click and select "edit") and change the settings
in the batch file itself.

You should also know that you cannot drag and drop IMF files onto the batch file
as it is. If you want to be able to do that, you must edit the batch file and
replace the "imf2wav.exe" in the line "set IMFCONV=imf2wav.exe" with the full
path of your imf2wav.exe. So if you copied the files into a folder like
"D:\IMF stuff\converter", you must change that line in the batch file to this:

set IMFCONV="D:\IMF stuff\converter\imf2wav.exe"

Save the batch file and drag your IMF song onto it. It should now create a WAV
file for each channel that is used in the IMF song.


Notes:
------

This program convets IMF music to PCM waveform data using an OPL emulator, and 
saves the converted data as a .WAV file.

In its current implementation, the IMF converter does not suffer from the same 
64K limits as the playback routines in the original DOS games. Any IMF file can
be converted, as long as there is enough free space for the resulting WAV file.

The source code was compiled with Microsoft Visual C++ 2008, building a Win32 
console application with the default options. You shouldn't have much trouble 
getting it to compile. If you find any bugs I've missed or do anything cool 
with the source code, please let me know!


K1n9_Duk3
k1n9duk3@arcor.de

Version 1.0 (2013-02-14)

Version 1.1 (2014-10-30)

- added channel masking and batch file

Version 1.2 (2020-05-09)

- added support for KMF files