/*
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
*/

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "fmopl.h"

#define YM3812_RATE 3579545
#define DEF_FREQ 44100

//just a quick hack, but it works...
#pragma pack(2)		//this gave me a headache...
struct waveheader{
	UINT32 rID, rSize;
	UINT32 wID;
	UINT32 fID, fSize;
	UINT16 fFormat, fChannels;
	UINT32 fHertz, fBytesPerSec;
	UINT16 fBlockAlign, fBits, fSpecific;
	UINT32 dID, dSize;
};
#pragma pack()

waveheader head = 
{
	0x46464952,		//rID = "RIFF"
	0,				//rSize (dummy value)
	0x45564157,		//wID = "WAVE"
	0x20746D66,		//fID = "fmt "
	18,				//fSize
	1,				//fFormat
	1,				//fChannels
	DEF_FREQ,		//fHertz
	0,				//fBytesPerSec (dummy value)
	4,				//fBlockAlign
	OPL_SAMPLE_BITS,//fBits
	0,				//fSpecific
	0x61746164,		//dID = "data"
	0				//dSize (dummy value)
};

int IMF_IsChunk(FILE* in)
{
	UINT16 chunksize, buff, i=42;
	UINT32 sum1=0, sum2=0;

	if(!in)
		return 0;

	if (!feof(in))
	{
		fread(&chunksize, sizeof(chunksize), 1, in);
		while(!feof(in) && i)
		{
			fread(&buff, sizeof(buff), 1, in);
			sum1 += buff;
			fread(&buff, sizeof(buff), 1, in);
			sum2 += buff;
			i--;
		}
		fseek(in, 0, SEEK_SET);
		return (sum1 > sum2);
	}
	return 0;
}

UINT32 ReadInt32LE(FILE *in)
{
	UINT32 result;
	fread(&result, sizeof(result), 1, in);
	return result;
}

UINT16 ReadInt16LE(FILE *in)
{
	UINT16 result;
	fread(&result, sizeof(result), 1, in);
	return result;
}

UINT8 ReadByte(FILE *in)
{
	UINT8 result;
	fread(&result, sizeof(result), 1, in);
	return result;
}

int main(int argc, char *argv[])
{
	FILE *in, *out;
	INT16 *buffer;
	char *wavefile;
	unsigned int imf_rate=560, wav_rate=DEF_FREQ, samples_per_tick, isKMF, cmds=0, ticks=0;
	UINT16 channel_mask=0xffff;

	printf("\nK1n9_Duk3's IMF to WAV converter v1.2\n");
	printf("=====================================\n\n");
	if(argc < 2)
	{
		printf("Usage: IMF2WAV <imffile> [wavefile [imfrate [hertz [mask]]]]\n");
		return 0;
	} else {
		if(argc==2)
		{
			wavefile = (char*)malloc(strlen(argv[1])+5);
			strcpy(wavefile, argv[1]);
			strcat(wavefile, ".wav");
		} else {
			wavefile = argv[2];
		}

		if(argc > 3) {
			imf_rate = atoi(argv[3]);
			if (argc > 4) {
				wav_rate = atoi(argv[4]);
				if (argc > 5) {
					channel_mask = atoi(argv[5]);
				}
			}
		}
	}

	if (channel_mask) {

		samples_per_tick=wav_rate/imf_rate;
		if(YM3812Init(1, YM3812_RATE, wav_rate))
		{
			printf("Unable to create virtual OPL!!\n");
			return 1;
		}
		printf("OPL created.\n");
		for(int i=1;i<0xf6;i++)
			YM3812Write(0,i,0);

		YM3812Write(0,1,0x20); // Set WSE=1
		//YM3812Write(0,8,0); // Set CSM=0 & SEL=0           // already set in for statement

		in = fopen(argv[1], "rb");
		if(in)
		{
			UINT32 size, cnt=0, imfsize=0xFFFFFFFF;
			char has_notes=0;

			printf("%s opened for input.\n", argv[1]);

			if (ReadInt32LE(in) == 0x1A464D4B)
			{
				UINT16 rate, size;
				fread(&rate, sizeof(rate), 1, in);
				fread(&size, sizeof(size), 1, in);
				if (size)
					imfsize = size >> 1;
				if (rate != 0 && argc <= 3)
				{
					imf_rate = rate;
					samples_per_tick=wav_rate/imf_rate;
				}
				printf("File is in KMF fomat. %u Hz, %u bytes\n", rate, imfsize);
				isKMF = 1;
			}
			else
			{
				isKMF = 0;
				fseek(in, 0, SEEK_SET);
				if (IMF_IsChunk(in))
				{
					UINT16 size;
					printf("IMF file is a ripped AudioT chunk.\n");
					fread(&size, sizeof(size), 1, in);
					printf("IMF size is %u Bytes.\n", size);
					imfsize = size >> 2;
				} else {
					printf("IMF size is not set.\n");
				}
			}
			printf("IMF rate is %u Hz.\n", imf_rate);
			printf("Channel mask is 0x%X\n", channel_mask);

			buffer = (INT16 *)malloc(samples_per_tick*sizeof(INT16));
			if (buffer)
			{
				printf("buffer allocated.\n");
				out = fopen(wavefile, "wb");
				if(out)
				{
					UINT16 imfdelay, imfcommand;
					printf("%s opened for output.\n", wavefile);

					printf("Converting IMF data to PCM data\n");
					//write dummy wave header:
					fwrite(&head, sizeof(head), 1, out);

					//write converted PCM data:
					while(!feof(in) && imfsize)
					{
						if (isKMF)
						{
							if (!cmds)
							{
								cmds = ReadByte(in);
								ticks = ReadByte(in);
								imfsize--;
							}
							if (cmds)
							{
								cmds--;
								fread(&imfcommand, sizeof(imfcommand), 1, in);
								imfsize--;
							}
							if (!cmds)
								imfdelay = ticks;
							else
								imfdelay = 0;
						}
						else
						{
							imfsize--;
							fread(&imfcommand, sizeof(imfcommand), 1, in);
							fread(&imfdelay, sizeof(imfdelay), 1, in);
						}
						switch (imfcommand & 0xFF)
						{
						case 0xB0:
						case 0xB1:
						case 0xB2:
						case 0xB3:
						case 0xB4:
						case 0xB5:
						case 0xB6:
						case 0xB7:
						case 0xB8:
							if (!(channel_mask & (1 << ((imfcommand & 0xFF)-0xB0)))) {
								imfcommand &= 0xDFFF;	//clear KeyOn bit
							} else {
								has_notes = (has_notes || (imfcommand & 0x2000));
							}
							break;
						case 0xBD:
							imfcommand &= ((channel_mask >> 1) & 0x1F00) | 0xE0FF;
							has_notes = (has_notes || (imfcommand & 0x1F00));
							break;
						}
						YM3812Write(0, imfcommand & 0xFF, (imfcommand >> 8) & 0xFF);
						while(imfdelay--)
						{
							YM3812UpdateOne(0, buffer, samples_per_tick);
							fwrite(buffer, sizeof(INT16), samples_per_tick, out);
							fflush(out);
							if (feof(in)) break;
						}
						if(!(cnt++ & 0xff))
						{
							printf(".");
							fflush(stdout);
						}
					}
					printf(" done!\n");
				} else {
					printf("ERROR: could not write %s\n", wavefile);
				}
				size = ftell(out);

				//fill header with correct values:
				head.dSize = size-sizeof(head);
				head.rSize = size-8;
				head.fHertz = wav_rate;
				head.fBlockAlign = head.fChannels*(head.fBits/8);
				head.fBytesPerSec = head.fBlockAlign*wav_rate;

				//write real wave header:
				fseek(out, 0, SEEK_SET);
				fwrite(&head, sizeof(head), 1, out);	
				fflush(out);
				fclose(out);
				if (!has_notes)
				{
					printf("The song did not play any notes.\n");
					exit(1);
				}
			} else {
				printf("ERROR: out of memory\n");
			}
			fclose(in);
		} else {
			printf("ERROR: could not read %s\n", argv[1]);
		}

		YM3812Shutdown();
	} else {
		printf("ERROR: no channel masked - output would be silence\n");
		exit(1);
	}
	return 0;
}
