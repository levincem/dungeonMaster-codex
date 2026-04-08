

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>

#include "lzw.h"
#include "main.h"

/*
 * This file is made to decompile and recompile graphics.dat files
 *
 * Extracted files will be BMP's
 */
FILE			*infile;
FILE			*outfile;
FILE			*mapfile;
BITMAP_HEADER	bmpheader;

char	inputfile[256];
char	outputfile[256];
char	mapinputfile[256];
char	workdir[256];
char	curfilename[256];
dmmap	*maps;
int		numitems;
int		*gfxsizes;
int		*gfxsizesexp;
short	*gfxwidtharray;
short	*gfxheightarray;
bool	endian;
byte	filetype;

// for debugging

// buffer for DM/CSB format graphics (8bit)
byte	gfxbuf[1024*128]; // too big for local functions
// buffer for DM/CSB format graphics (4bit)
byte	gfxbuf4bit[1024*128*4]; // too big for local functions
// buffer for BMP style graphics (8bit)
byte	gfxbufbmp[1024*128]; // 128k should be enough...
// colors for DM/CSB format graphics
byte	gfxcolors[6];

byte	gfxtype;
int		gfxnum;

int		gfxbuf4bitloc;
int		gfxwidth;
int		gfxheight;
int		gfxpixeldepth;
int		gfxcolorcount;
int		gfxprimaryencoding;
int		gfxlen;
int		gfxfilesize;

byte	action;

FILE	*datafile;
gfxcolor *gfxpalette;


int main(int argc, char **argv)
{
	strcpy(inputfile, "graphics.dat");
	strcpy(outputfile, "graphics.dat");
	strcpy(mapinputfile, "");
	strcpy(workdir, "graphics/");
	endian = E_LITTLE;
	gfxprimaryencoding = 1; // IMG1 is primary;

	action = 0;

	// read the cmdline variables
	for (int i = 1; i < argc; i++ )
	{
		if ( i+1 >= argc )
			goto syntaxerr;
		if ( argv[i+1][0] == '\0' )
			goto syntaxerr;

		if ( !strcmp(argv[i], "-x" ))
		{
			strcpy(inputfile, argv[++i]);
			if ( action )
				goto syntaxerr;
			action = A_EXPAND;
		}
		if ( !strcmp(argv[i], "-c" ))
		{
			strcpy(outputfile, argv[++i]);
			if ( action )
				goto syntaxerr;
			action = A_CREATE;
		}
		if ( !strcmp(argv[i], "-d" ))
			strcpy(workdir, argv[++i]);
		if ( !strcmp(argv[i], "-m" ))
			strcpy(mapinputfile, argv[++i]);
		if ( !strcmp(argv[i], "-e" ))
		{
			if ( !strcmp(argv[++i], "LITTLE") )
				endian = E_LITTLE;
			else if ( !strcmp(argv[i], "BIG") )
				endian = E_BIG;
			else
				goto syntaxerr;
		}
		if ( !strcmp(argv[i], "-i" ))
		{
			gfxprimaryencoding = atoi(argv[++i]);
			if ( gfxprimaryencoding < 1 || gfxprimaryencoding > 4 )
				goto syntaxerr;
		}
	}
	// if no action is specified, then expand a graphics.dat file
	if ( !action)
		action = A_EXPAND;

	// check if a map input was specified
	if ( mapinputfile[0] != '\0' ) // map specified
	{
		mapfile = fopen(mapinputfile, "r");
		if ( !mapfile )
		{
			printf("Specified MAP file, \"%s\", not found...\n",
				mapinputfile);
			return 0;
		}
		char *str;
		char *val;

		str = read_string(mapfile);
		if ( str == NULL )
		{
			printf("Invalid MAP file format.\n");
			return 0;
		}
		val = get_attribute(str, 1 );
		if ( !val )
		{
			printf("Error: %s, line #1, syntax error: not enough arguments\n",
				mapinputfile );
			return 0;
		}
		
		if ( !strcmp(val, "ENDIAN=BIG" ) )
			endian = E_BIG;
		else if ( !strcmp(val, "ENDIAN=LITTLE" ) )
			endian = E_LITTLE;
		else
		{
			printf("Error: %s, line #1, syntax error: invalid endian\n",
				mapinputfile );
			printf("        Specified endian: %s\n", val );
			return 0;
		}

		val = get_attribute(str, 2 );
		if ( !val )
		{
			printf("Error: %s, line #1, syntax error: not enough arguments\n",
				mapinputfile );
			return 0;
		}
		
		if ( !strcmp(val, "FORMAT=DMCSB1" ) )
			filetype = FT_DMCSB1;
		else if ( !strcmp(val, "FORMAT=DMCSB2" ) )
			filetype = FT_DMCSB2;
		else if ( !strcmp(val, "FORMAT=DMII" ) )
			filetype = FT_DM2;
		else
		{
			printf("Error: %s, line #1, syntax error: invalid format\n",
				mapinputfile );
			printf("        Specified format: %s\n", val );
			return 0;
		}
	}
	char endchr;
	endchr = workdir[strlen(workdir)-1];
	if ( endchr != '/' && endchr != '\\' )
		strcpy(workdir + strlen(workdir), "/");

	char workdirname[1024];

	sprintf(workdirname, "%s", workdir);
	strcpy(workdirname, workdir);

	while ( true )
	{
		endchr = workdirname[strlen(workdirname)-1];
		if ( endchr == '\\' || endchr == '/' )
		{
			workdirname[strlen(workdirname)-1] = 0;
			continue;
		}
		else
			break;
	};
	
	CreateDirectory(workdirname, NULL);

	char buf[256];
	printf("workdir: %s\n", workdir);
	sprintf(buf, "%sdmout.gil", workdir );

	if ( action == A_EXPAND )
	{
		datafile = fopen(buf, "wb");
		if ( !datafile )
		{
			printf("Error opening \"%s\"\n", buf);
			return 0;
		}
		readfile();
	}
	else if ( action == A_CREATE )
	{
		datafile = fopen(buf, "rb");
		if ( !datafile )
		{
			printf("Error opening \"%s\"\n", buf);
			return 0;
		}
		writefile();
	}
	fclose(datafile);


	
	return 0;

syntaxerr:
	printf("dmextract.exe [-idsifc <string>]\n");
	printf("    -x <path>.... expand a graphics.dat\n");
	printf("    -c <path>.... construct a graphics.dat file\n");
	printf("    -d <path>.... specify output/input directory\n");
	printf("    -e <endian>.. specify BIG or LITTLE endian\n");
	printf("    -i 1/2/3/4... Alter primary IMG encoding\n");
	printf("    ............... default: IMG1/2\n");
	printf("    -m <path>.... use .MAP file when extracting\n");

	return 0;
}

// return # of graphics read
int readfile()
{
	int i = 0;

	infile = fopen( inputfile, "rb" );
	if (!infile)
		return 0;

	if ( !filetype ) // didnt use a map
	{
		printf("Autodetecting file type... ");
			
		filetype = FT_DMCSB1;

		if ( !fread(&numitems, 2, 1, infile) )
			return -1;

		numitems = swap16(numitems);

		// this doesnt seem to be it, maybe its a version # or CRC?
		if ( (unsigned short)numitems == 0x8001 ) 
		{
			filetype = FT_DMCSB2;
			if ( !fread(&numitems, 2, 1, infile) )
				return -1;
			numitems = swap16(numitems);
		}

		else if ( (unsigned short)numitems == 0x8005 ) 
		{
			filetype = FT_DM2;
			if ( !fread(&numitems, 2, 1, infile) )
				return -1;
			numitems = swap16(numitems);
		}

		else if ( numitems < 0 || numitems > 1000 || numitems == 384 )
		{
			printf("\nCould not detect type...\n");
			printf("Switching endian and attempting again... ");
			filetype = FT_DMCSB1;
			endian = !endian;

			fseek(infile, 0, SEEK_SET );
			if ( !fread(&numitems, 2, 1, infile) )
				return -1;

			numitems = swap16(numitems);

			// this doesnt seem to be it, maybe its a version # or CRC?
			if ( (unsigned short)numitems == 0x8001 ) 
			{
				filetype = FT_DMCSB2;
				if ( !fread(&numitems, 2, 1, infile) )
					return -1;
				numitems = swap16(numitems);
			}

			else if ( (unsigned short)numitems == 0x8005 ) 
			{
				filetype = FT_DM2;
				if ( !fread(&numitems, 2, 1, infile) )
					return -1;
				numitems = swap16(numitems);
			}
			else if ( numitems < 0 || numitems > 1000 )
				filetype = 0;
		}
		if (filetype == FT_DMCSB1 )
			printf("Found: DMCSB1\n");
		else if ( filetype == FT_DMCSB2 )
			printf("Found: DMCSB2\n");
		else if ( filetype == FT_DM2 )
			printf("Found: DMII\n");
		else
		{
			printf("\nNot found: Invalid graphics.dat file\n");
			printf("Check endianness of file\n");
			return 0;
		}
	}
	else if ( filetype == FT_DMCSB1 )
	{
		printf("Reading DMCSB1 header... ");
			
		if ( !fread(&numitems, 2, 1, infile) )
			return -1;

		numitems = swap16(numitems);

		if ( numitems < 0 || numitems > 1000 )
			filetype = 0;
	}
	else if ( filetype == FT_DMCSB2 )
	{
		printf("Reading DMCSB2 header... ");

		if ( !fread(&numitems, 2, 1, infile) )
			return -1;

		numitems = swap16(numitems);

		// this doesnt seem to be it, maybe its a version # or CRC?
		if ( (unsigned short)numitems == 0x8001 ) 
		{
			if ( !fread(&numitems, 2, 1, infile) )
				return -1;
			numitems = swap16(numitems);
			if ( numitems > 1000 || numitems < 0 )
				filetype = 0;
		}
		else
			filetype = 0;

	}
	else if ( filetype == FT_DM2 )
	{
		printf("Reading DMCSB2 header... ");
			
		if ( !fread(&numitems, 2, 1, infile) )
			return -1;

		numitems = swap16(numitems);

		if ( (unsigned short)numitems == 0x8005 ) 
		{
			if ( !fread(&numitems, 2, 1, infile) )
				return -1;
			numitems = swap16(numitems);
			if ( numitems > 7000 || numitems < 0 )
				filetype = 0;

		}
		else
			filetype = 0;

	}

	if ( !filetype )
	{
		printf("Invalid header format, aborting\n");
		return 0;
	}

	fwrite(&endian, sizeof(byte), 1, datafile );
	fwrite(&filetype, sizeof(byte), 1, datafile );
	printf("Number of items to be extracted: %u\n", numitems );
	
	gfxsizes = (int *)malloc(sizeof(int) * numitems);
	gfxsizesexp = (int *)malloc(sizeof(int) * numitems);
	gfxwidtharray = (short *)malloc(sizeof(short) * numitems);
	gfxheightarray = (short *)malloc(sizeof(short) * numitems);

	if ( mapfile )
	{
		maps = (dmmap *)malloc(sizeof(dmmap) * numitems);
		printf("Reading map file... ");

		char *str;
		char *val;
		for ( i = 0; i < numitems; i++ )
		{
			str = read_string(mapfile);
			if ( !str )
			{
				printf("\nError: .MAP file, missing line #%d\n", i+2);
				return 0;
			}
			val = get_attribute(str, 1 ); // number
			if ( !val )
			{
				printf("\nError .MAP file, line #%d; invalid attribute #%d\n", i+2, 1);
				return 0;
			}
			strncpy(maps[i].num, val, 4 );
			val = get_attribute(str, 2 ); // type
			if ( !val )
			{
				printf("\nError .MAP file, line #%d; invalid attribute #%d\n", i+2, 2);
				return 0;
			}
			strncpy(maps[i].type, val, 4 );
			val = get_attribute(str, 3 ); // info
			if ( !val )
			{
				printf("\nError .MAP file, line #%d; invalid attribute #%d\n", i+2, 3);
				return 0;
			}
			strncpy(maps[i].info, val, 4 );
			val = get_attribute(str, 4 ); // name1
			if ( !val )
			{
				printf("\nError .MAP file, line #%d; invalid attribute #%d\n", i+2, 4);
				return 0;
			}
			maps[i].name1 = (char *)malloc(sizeof(char)*strlen(val)+1);
			strcpy(maps[i].name1, val );
			val = get_attribute(str, 5 ); // name2
			if ( !val )
			{
				printf("\nError .MAP file, line #%d; invalid attribute #%d\n", i+2, 5);
				return 0;
			}
			maps[i].name2 = (char *)malloc(sizeof(char)*strlen(val)+1);
			strcpy(maps[i].name2, val );
			val = get_attribute(str, 6 ); // comments
			if ( !val )
			{
				printf("\nError .MAP file, line #%d; invalid attribute #%d\n", i+2, 6);
				return 0;
			}
			maps[i].comments = (char *)malloc(sizeof(char)*strlen(val)+1);
			strcpy(maps[i].comments, val );
			maps[i].num[4] = 0;
			maps[i].type[4] = 0;
			maps[i].info[4] = 0;
		}
		printf(".. Complete!\n");
	}

	i = 0;
	if ( filetype == FT_DM2 )
	{
		if ( !fread(&(gfxsizes[0]), 4, 1, infile) )
			return -1 * i;	
		
		gfxsizes[0] = swap32(gfxsizes[0]) & 0xFFFFFFFF;
		i++;
	}
	for ( ; i < numitems; i++ )
	{
		if ( !fread(&(gfxsizes[i]), 2, 1, infile) )
			return -1 * i;

		gfxsizes[i] = gfxsizes[i] & 0xffff;
		gfxsizes[i] = swap16(gfxsizes[i]) & 0xffff;
	}
	
	if ( filetype == FT_DM2 )
	{
		for ( i = 0; i < numitems; i++ )
			gfxsizesexp[i] = gfxsizes[i];
	}
	else
	{
		for ( i = 0; i < numitems; i++ )
		{
			if ( !fread(&(gfxsizesexp[i]), 2, 1, infile) )
				return -1 * i;

			gfxsizesexp[i] = gfxsizesexp[i] & 0xffff;
			gfxsizesexp[i] = swap16(gfxsizesexp[i]);
		}
	}

	fwrite(&numitems, sizeof(short), 1, datafile);

	if ( filetype == FT_DMCSB2 )
	{
		for ( i = 0; i < numitems; i++ )
		{
			if ( !fread(&(gfxwidtharray[i]), 2, 1, infile) )
				return -1 * i;
			if ( !fread(&(gfxheightarray[i]), 2, 1, infile) )
				return -1 * i;

			if ( !fwrite(&(gfxwidtharray[i]), 2, 1, datafile) )
				return -1 * i;
			if ( !fwrite(&(gfxheightarray[i]), 2, 1, datafile) )
				return -1 * i;
		}
	}

	int filesize = 2;
	if ( filetype == FT_DMCSB2 )
		filesize += 2;
	filesize += 2 * numitems * ( filetype == FT_DMCSB2 ? 2 : 1);
	filesize += 2 * numitems * ( filetype == FT_DMCSB2 ? 2 : 1);

	printf("                 Compr | Uncmp  (diff)\n" );
	for ( i = 0; i < numitems; i++ )
	{
		filesize += gfxsizes[i];
		printf("Item[%3d] size: %6u | %-6u (%d)\n", i,
			gfxsizes[i],  gfxsizesexp[i],
			gfxsizesexp[i] - gfxsizes[i]);
	}

	//for ( i = 0; i < numitems; i++ )
	//	filesize += gfxsizesexp[i];

	
	//numitems = 10; // hack
	int zero = 0;
	for ( gfxnum = 0; gfxnum < numitems; gfxnum++ )
	{
		if ( !readgraphic() )
		{
			printf("\nAborting!\n");
			break;
		}
		
		if ( gfxtype == GT_IMAGE1
			|| gfxtype == GT_IMAGE2 
			|| gfxtype == GT_IMAGE3 
			|| gfxtype == GT_IMAGE4
			|| gfxtype == GT_FONT )
		{
			writegraphic();
		}
		else if ( gfxtype == GT_TEXT1 
			|| gfxtype == GT_TEXT2 )
		{
			writetext();
		}
		else if ( gfxtype != GT_FREESLOT )
		{
			// even sounds
			writeunknown();
		}

		fwrite(&gfxtype, sizeof(byte), 1, datafile);
		if ( gfxtype != GT_FREESLOT )
		{
			zero = 0;
			fwrite(curfilename, sizeof(char), strlen(curfilename), datafile);
			fwrite(&zero, sizeof(char), 1, datafile);
		}

	}

	fclose(infile);
	return numitems;
}

int writefile()
{
	outfile = fopen( outputfile, "wb" );
	if (!outfile)
		return 0;

	unsigned short ushort;
	unsigned int ulong;
	int i;

	fread(&endian, sizeof(byte), 1, datafile );
	fread(&filetype, sizeof(byte), 1, datafile );
	fread(&numitems, sizeof(short), 1, datafile );

	if ( filetype == FT_DMCSB2 )
	{
		ushort = 0x8001;
		ushort = swap16(ushort);
		fwrite(&ushort, sizeof(short), 1, outfile );
	}
	else if ( filetype == FT_DM2 )
	{
		ushort = 0x8005;
		ushort = swap16(ushort);
		fwrite(&ushort, sizeof(short), 1, outfile );
	}
	ushort = swap16(numitems);
	fwrite(&ushort, sizeof(short), 1, outfile );

	gfxsizes = (int *)malloc(sizeof(int) * numitems);
	gfxsizesexp = (int *)malloc(sizeof(int) * numitems);
	gfxwidtharray = (short *)malloc(sizeof(short) * numitems);
	gfxheightarray = (short *)malloc(sizeof(short) * numitems);

	if ( filetype == FT_DMCSB2 )
	{
		for ( i  = 0; i < numitems; i++ )
		{
			if ( !fread(&(gfxwidtharray[i]), 2, 1, datafile) )
				return -1 * i;
			if ( !fread(&(gfxheightarray[i]), 2, 1, datafile) )
				return -1 * i;
		}
	}
	// for now, write 0's as their length, we'll fill that in
	// after we're done writing the file
	ushort = ulong = 0;
	for ( i = 0; i < numitems; i++ )
	{
		gfxsizes[i] = 0;
		if ( filetype == FT_DM2 && i == 0 )
			fwrite(&ulong, sizeof(int), 1, outfile);
		else
			fwrite(&ushort, sizeof(short), 1, outfile);
	}

	if ( filetype == FT_DMCSB1 || filetype == FT_DMCSB2 )
	{
		for ( i = 0; i < numitems; i++ )
		{
			fwrite(&ushort, sizeof(short), 1, outfile);
		}
	}
	

	if ( filetype == FT_DMCSB2 ) // item attributes?
	{
		for ( i = 0; i < numitems; i++ )
		{
			fwrite(&ushort, sizeof(short), 1, outfile);
			fwrite(&ushort, sizeof(short), 1, outfile);
		}
	}

	for ( gfxnum = 0; gfxnum < numitems; gfxnum++ )
	{
		fread(&gfxtype, sizeof(byte), 1, datafile);

		if ( gfxtype == GT_FREESLOT )
			continue;

		read_nextfile();
		// gfxbufbmp holds the data
		// gfxfilesize is the length;
		//printf("Write to file #%d of type %d\n",
		//	gfxnum, gfxtype );

		gfxlen = 0;
		if ( gfxtype == GT_FONT
			|| gfxtype == GT_IMAGE1
			|| gfxtype == GT_IMAGE2
			|| gfxtype == GT_IMAGE3
			|| gfxtype == GT_IMAGE4 )
		{
			// read the BMP header
			decode_bmpheader();
		}
		switch ( gfxtype )
		{
			case GT_FONT:
				encode_font();
				break;
			case GT_IMAGE1:
			case GT_IMAGE2:
				reverse_depad_pixels();
				encode_graphic1();
				break;
			case GT_IMAGE3:
			case GT_IMAGE4:
				reverse_depad_pixels();
				encode_graphic2();
				break;
			case GT_TEXT1:
			case GT_TEXT2:
				encode_text();
				break;
			default:
				memcpy(gfxbuf, gfxbufbmp, gfxfilesize);
				gfxlen = gfxfilesize;
				break;
		}
		gfxsizes[gfxnum] = gfxlen;
		gfxsizesexp[gfxnum] = gfxlen;
		fwrite(&gfxbuf, sizeof(char), gfxlen, outfile );

	}

	// now go back and set the sizes
	int start;
	start = 2;
	if ( filetype == FT_DMCSB2 || filetype == FT_DM2 )
		start += 2; // 800x checksum?

	fseek(outfile, start, SEEK_SET);
	for ( i = 0; i < numitems; i++ )
	{
		if ( filetype == FT_DM2 && i == 0 )
		{
			ulong = swap32(gfxsizes[i]);
			fwrite(&ulong, sizeof(int), 1, outfile);
		}
		else
		{
			ushort = swap16(gfxsizes[i]);
			fwrite(&ushort, sizeof(short), 1, outfile);
		}
	}

	if ( filetype == FT_DMCSB1 || filetype == FT_DMCSB2 )
	{
		for ( i = 0; i < numitems; i++ )
		{
			ushort = swap16(gfxsizesexp[i]);
			fwrite(&ushort, sizeof(short), 1, outfile);
		}
	}
	
	if ( filetype == FT_DMCSB2 )
	{
		for ( i = 0; i < numitems; i++ )
		{
			ushort = swap16(gfxwidtharray[i]);
			fwrite(&ushort, sizeof(short), 1, outfile);
			ushort = swap16(gfxheightarray[i]);
			fwrite(&ushort, sizeof(short), 1, outfile);
		}
	}

	//printf("All done!\n");

/*	int filesize = 2;
	if ( filetype == FT_DMCSB2 )
		filesize += 2;
	filesize += 2 * numitems * ( filetype == FT_DMCSB2 ? 2 : 1);
	filesize += 2 * numitems * ( filetype == FT_DMCSB2 ? 2 : 1);

	printf("                 Compr | Uncmp  (diff)\n" );
	for ( i = 0; i < numitems; i++ )
	{
		filesize += gfxsizes[i];
		printf("Item[%3d] size: %6u | %-6u (%u)\n", i,
			gfxsizes[i],  gfxsizesexp[i],
			gfxsizesexp[i] - gfxsizes[i]);
	}

	//for ( i = 0; i < numitems; i++ )
	//	filesize += gfxsizesexp[i];

	
	//numitems = 10; // hack
	for ( gfxnum = 0; gfxnum < numitems; gfxnum++ )
	{
		readgraphic();
		if ( gfxtype == GT_IMAGE1
			|| gfxtype == GT_IMAGE2 
			|| gfxtype == GT_FONT )
		{
			//decode_graphic12();
			writegraphic();
		}
		else if ( gfxtype == GT_TEXT1 
			|| gfxtype == GT_TEXT2 )
		{
			writetext();
		}
		else if ( gfxtype != GT_FREESLOT )
		{
			// even sounds
			writeunknown();
		}

		fwrite(&gfxtype, 1, sizeof(gfxtype), datafile);
	}

	fclose(infile);
	return numitems;*/
	return numitems;
}

void read_nextfile()
{
	FILE *f;
	char buf[256], buf2[256];
	int i=0;

	while (!feof(datafile))
	{
		fread(&(buf2[i]), sizeof(char), 1, datafile);
		if ( buf2[i] == 0 )
			break;
		i++;
	}

	sprintf(buf, "%s%s", workdir, buf2 );
	printf("Reading file: %s...", buf );
	f = fopen( buf, "rb" );
	if ( !f )
	{
		printf("File Not found...\n");
		return;
	}
	fseek(f, 0, SEEK_END);
	gfxfilesize = ftell(f);
	fseek(f, 0, SEEK_SET);

	fread(gfxbufbmp, sizeof(char), gfxfilesize, f);
	fclose(f);
	printf("Complete! (%u bytes)\n", gfxfilesize);
}

int getrepeatcount()
{
	int	ch1, ch2;
	int pixelcount = 0;

	pixelcount = gfxbuf4bit[gfxbuf4bitloc++];
	if ( pixelcount == 0xf ) 
	{
		pixelcount = gfxbuf4bit[gfxbuf4bitloc++] << 4;
		pixelcount += gfxbuf4bit[gfxbuf4bitloc++];

		if ( pixelcount == 0xff )
		{
			ch1 = (gfxbuf4bit[gfxbuf4bitloc++]<<4);
			ch1 |= gfxbuf4bit[gfxbuf4bitloc++];
			ch2 = (gfxbuf4bit[gfxbuf4bitloc++]<<4);
			ch2 |= gfxbuf4bit[gfxbuf4bitloc++];
			
			pixelcount = ( ch1 << 8 ) | ch2;
		}
		else
			pixelcount += 17; // why? i dunno
	}
	else		//f
	{	//not f or ff
		pixelcount += 2;
	}

	return pixelcount;
}
int decode_font()
{
	gfxwidth = 1024;
	gfxheight = 6;
	gfxpixeldepth = 1;

	int i;
	for ( i = 0; i < 768; i++ )
	{
		gfxbufbmp[i] = gfxbuf[i];
	}

	return 768;
}
void encode_font()
{
	int i;

	for ( i = 0; i < 6; i++ )
		memcpy(gfxbuf+(128*i), gfxbufbmp+(128*(5-i)), 128 );
	gfxlen = 768;

}
void reverse_depad_pixels()
{
	int pad;

	pad = gfxwidth & 0x3;
	if ( pad )
		pad = 4 - pad;

	int pixel;
	char opchar;

	int gbb = 0;
	int gb = 0;
	int i;
	int size = gfxwidth*gfxheight;
	int lastnum=0;

	//printf ("Padding: %d Len: %d\n", pad, gfxlen );
	size = gfxwidth * gfxheight;
	for( int line = 0; line < gfxheight; line++ )
	{	
		for( pixel = gfxwidth; pixel > 0; pixel-- )
		{
			opchar = gfxbufbmp[gbb++];
		
			if ( ((line*gfxwidth)+pixel) > lastnum )
				lastnum = ((line*gfxwidth)+pixel);

			gfxbuf[size-((line*gfxwidth)+pixel)] = opchar;
			//fwrite(&opchar,sizeof(char),1,bmpfile);
		}
		for ( i = 0; i < pad; i++ )
		{
			gbb++;
			gb++;
		}
	}
	//printf("Lastnumber: %d\n", lastnum );
	//gfxlen = gbb;
	//if ( gfxlen != gfxwidth*gfxheight)
	//	printf("ERR GFXLEN != W*H  %d != %d (%d*%d)!\n",
	//	gfxlen, gfxwidth*gfxheight, gfxwidth, gfxheight);

	gfxlen = gfxwidth*gfxheight;
	gfxwidtharray[gfxnum] = gfxwidth;
	gfxheightarray[gfxnum] = gfxheight;
	//printf("Gfxlen: %d\n",gfxlen);
	memcpy(gfxbufbmp, gfxbuf, gfxlen );
	//writegraphic();
}
int decode_graphic12()
{
	gfxwidth	= swap16(*((int *)(gfxbuf)));
	gfxheight	= swap16(*((int *)(gfxbuf+2)));
	gfxpixeldepth = 8; // gotta be 8;

	//printf("Width:          %u\n", gfxwidth );
	//printf("Height:         %u\n", gfxheight );

	/*
	 * construct a "4bit" buffer instead of an 8 bit buffer
	 * for the graphics
	 */
	int count = 0;
	int i;
	for ( i = 0; i < gfxsizesexp[gfxnum]; i++ )
	{
		gfxbuf4bit[count++] = (gfxbuf[i] & 0xF0) >> 4;
		gfxbuf4bit[count++] = (gfxbuf[i] & 0xF);
	}
	//hex4bit_display(gfxbuf4bit, gfxsizes[gfxnum]*2);

	gfxbuf4bitloc = 8;

	byte	cur4bit = 0;
	int		save = 0;
	int		pixelcount = 0;
	int		pixelcolor = 0; // 0-15
	int		strcount = 0; // whats this for?
	int		bmppixel = 0;

	while ( bmppixel < gfxwidth*gfxheight )
	{
		cur4bit = gfxbuf4bit[gfxbuf4bitloc++];

		/*if ( gfxnum == 523 )
		{
			printf("cur4bit:          %d\n", cur4bit );
			printf("RowCol:           %d:%d\n",
				bmppixel / gfxwidth, bmppixel % gfxwidth );
			printf("Nibbles:          %d of %d\n",
				gfxbuf4bitloc, 2*gfxsizesexp[gfxnum]);
			printf("BMPPixels:        %d of %d\n\n",
				bmppixel, gfxwidth*gfxheight );
		}*/
		// Ok:
		// 12 0-8
		if ( cur4bit <= 7 )
		{
			pixelcount = cur4bit+1;
			pixelcolor = gfxbuf4bit[gfxbuf4bitloc++];

			for( i = 0; i < pixelcount; i++ )
				gfxbufbmp[bmppixel++] = pixelcolor;
		}
		else if ( cur4bit == 8 )
		{
			pixelcolor = gfxbuf4bit[gfxbuf4bitloc++];

			pixelcount = gfxbuf4bit[gfxbuf4bitloc++] * 0x10;
			pixelcount += gfxbuf4bit[gfxbuf4bitloc++];
			pixelcount += 1;

			for( i = 0; i < pixelcount; i++ )
				gfxbufbmp[bmppixel++] = pixelcolor;
		}
		else if ( cur4bit == 9 )
		{
			pixelcolor = gfxbuf4bit[gfxbuf4bitloc++];

			pixelcount = gfxbuf4bit[gfxbuf4bitloc++] * 0x10;
			pixelcount += gfxbuf4bit[gfxbuf4bitloc++];
			pixelcount += 1;

			if ( pixelcount % 2 != 0 ) // odd
			{
				gfxbufbmp[bmppixel++] = pixelcolor;
				pixelcount -= 1;
			}

			for ( i = 0; i < pixelcount; i++ )
				gfxbufbmp[bmppixel++] = gfxbuf4bit[gfxbuf4bitloc++];
		}
		else if ( cur4bit == 10 )
		{			
			pixelcount = gfxbuf4bit[gfxbuf4bitloc++] + 1;
			for ( i = 0; i < pixelcount; i++ )
				gfxbufbmp[bmppixel++] = 16; // transparent pixel?
		}
		else if ( cur4bit == 11 )
		{
			pixelcolor = gfxbuf4bit[gfxbuf4bitloc++];

			pixelcount = gfxbuf4bit[gfxbuf4bitloc++] * 0x10;
			pixelcount += gfxbuf4bit[gfxbuf4bitloc++];
			pixelcount += 1;

			strcount = bmppixel - gfxwidth;

			for( i = 0 ; i < pixelcount; i++ )
				gfxbufbmp[bmppixel++] = gfxbufbmp[strcount++];
			
			gfxbufbmp[bmppixel++] = pixelcolor;
   
		}
		else if ( cur4bit == 12 )
		{
			
			pixelcolor = gfxbuf4bit[gfxbuf4bitloc++];
			
			pixelcount = gfxbuf4bit[gfxbuf4bitloc++] * 0x1000;
			pixelcount += gfxbuf4bit[gfxbuf4bitloc++] * 0x100;
			pixelcount += gfxbuf4bit[gfxbuf4bitloc++] * 0x10;
			pixelcount += gfxbuf4bit[gfxbuf4bitloc++];
			pixelcount += 1;

			//pixelcount = swap16(pixelcount);
			for( i = 0 ; i < pixelcount; i++ )
				gfxbufbmp[bmppixel++] = pixelcolor;
		}
		else if ( cur4bit == 13 )
		{
			// unused... something tells me its bad if this comes up though
			//printf( "Warning: Unused 4bit integer (0xD) in data #%d\n",
			//	gfxnum );
			//printf( "Happened @ approx: %d\n", 
			//	4+gfxbuf4bitloc/2);
			gfxbuf4bitloc++;
		}
		else if ( cur4bit == 14 )
		{
			pixelcount = gfxbuf4bit[gfxbuf4bitloc++];

			if ( pixelcount <= 12 )
				pixelcount += 17;
			else if ( pixelcount == 13 )
			{
				pixelcount = gfxbuf4bit[gfxbuf4bitloc++] * 0x10;
				pixelcount += gfxbuf4bit[gfxbuf4bitloc++];
				pixelcount += 1;
			}
			else if ( pixelcount == 14 )
			{
				pixelcount = gfxbuf4bit[gfxbuf4bitloc++] * 0x10;
				pixelcount += gfxbuf4bit[gfxbuf4bitloc++];
				pixelcount += 257;
			}
			else if ( pixelcount == 15 )
			{
				pixelcount = gfxbuf4bit[gfxbuf4bitloc++] * 0x1000;
				pixelcount += gfxbuf4bit[gfxbuf4bitloc++] * 0x100;
				pixelcount += gfxbuf4bit[gfxbuf4bitloc++] * 0x10;
				pixelcount += gfxbuf4bit[gfxbuf4bitloc++];
				pixelcount += 1;
				//pixelcount = swap16(pixelcount);
			}
			for ( i = 0; i < pixelcount; i++ )
				gfxbufbmp[bmppixel++] = 16; // transparent pixel?
		}
		else if ( cur4bit == 15 )
		{
			pixelcolor = gfxbuf4bit[gfxbuf4bitloc++];

			pixelcount = gfxbuf4bit[gfxbuf4bitloc++] * 0x1000;
			pixelcount += gfxbuf4bit[gfxbuf4bitloc++] * 0x100;
			pixelcount += gfxbuf4bit[gfxbuf4bitloc++] * 0x10;
			pixelcount += gfxbuf4bit[gfxbuf4bitloc++];
			pixelcount += 1;

			//pixelcount = swap16(pixelcount);
			strcount = bmppixel - gfxwidth;

			for( i = 0 ; i < pixelcount; i++ )
				gfxbufbmp[bmppixel++] = gfxbufbmp[strcount++];
			
			gfxbufbmp[bmppixel++] = pixelcolor;
		}
	}

	/*if ( gfxbuf4bitloc != 2 * gfxsizesexp[gfxnum] )
		printf( "Invalid graphic #%d, gfxbuf4bitloc %d != %d\n",
			gfxnum, gfxbuf4bitloc, 2 * gfxsizesexp[gfxnum] );

	if ( bmppixel != gfxwidth*gfxheight )
	{
		printf( "Invalid graphic #%d, pixelcount %d != %d\n",
			gfxnum, bmppixel, gfxwidth*gfxheight );
		printf( "width/height: %d:%d\n", gfxwidth, gfxheight );
	}*/

	return bmppixel;

}
//#define IMDEBUGGING

void encode_graphic1()
{
	int i,j;
	int	pixelcount;
	int pixelcount_uprow;
	byte pixelcolor;
	byte nextpixelcolor;


	//printf("Encoding graphic #%d\n", gfxnum );

	gfxbuf4bitloc = 0;
	for ( i = 0; i < gfxlen; i++ )
	{
		// 0-7 - add n1 + 1 pixels of color n2
		// 8 - add b8+1 pixels of color n2
		// 9 - gay <--
		// 10 - add n2+1 pixels of transparency
		// 11 - add b8+1 pixels of the row above then 1 of n2
		// 12 - add b16+1 pixels of n2
		// 13 - unused
		// 14 - more transparency (more then 16)
		// 15 - add b16+1 pixels of the row above then 1 of n2

		/*
		So in a sense, theres only 3 options.
		1) There are a group of pixels coming up that are all the same
			0-7, 8, 12
		2) There are a group of pixels coming up similar to the line above
			11, 15
		3) There are transparent pixels coming up
			10, 14

		Find out which one produces the most sense (theres only 2 options at most)
		*/

		if ( gfxbufbmp[i] == 16 ) // transparent pixels
		{
			//printf("                                     IM TRANSPARENT\n");
			for ( j = i; j < gfxlen; j++ )
				if ( gfxbufbmp[j] != 16 )
					break;

			pixelcount = j - i;

			if ( pixelcount <= 16 )
			{
				gfxbuf4bit[gfxbuf4bitloc++] = 0xA;
				gfxbuf4bit[gfxbuf4bitloc++] = (pixelcount-1) & 0xF;
			}
			else if ( pixelcount <= 29 )
			{
				gfxbuf4bit[gfxbuf4bitloc++] = 0xE;
				gfxbuf4bit[gfxbuf4bitloc++] = (pixelcount-17) & 0xF;
			}
			else if ( pixelcount <= 256 )
			{
				gfxbuf4bit[gfxbuf4bitloc++] = 0xE;
				gfxbuf4bit[gfxbuf4bitloc++] = 0xD;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0xF0) >> 4;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0x0F);
			}
			else if ( pixelcount <= 512 )
			{
				gfxbuf4bit[gfxbuf4bitloc++] = 0xE;
				gfxbuf4bit[gfxbuf4bitloc++] = 0xE;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-257) & 0xF0) >> 4;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-257) & 0x0F);
			}
			else
			{
				gfxbuf4bit[gfxbuf4bitloc++] = 0xE;
				gfxbuf4bit[gfxbuf4bitloc++] = 0xF;

				if ( pixelcount > 65536 )
					pixelcount = 65536;

				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0xF000) >> 12;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0x0F00) >> 8;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0x00F0) >> 4;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0x000F);

			}
			i += pixelcount - 1;
			continue;
		}

		pixelcolor = gfxbufbmp[i] & 0xF;

		pixelcount_uprow = 0;
		if ( i >= gfxwidth ) // if we are on the 2nd line
		{
			for ( j = i; j < gfxlen-1; j++ )
				if ( gfxbufbmp[j] != gfxbufbmp[j-gfxwidth] )
					break;

			pixelcount_uprow = j - i;
		}

		for ( j = i; j < gfxlen; j++ )
			if ( gfxbufbmp[j] != gfxbufbmp[i] )
				break;

		pixelcount = j - i;
		
		if ( pixelcount_uprow > pixelcount ) {

			pixelcount = pixelcount_uprow;
			nextpixelcolor = gfxbufbmp[i+pixelcount] & 0xF;

			if ( pixelcount <= 256 )
			{
				gfxbuf4bit[gfxbuf4bitloc++] = 0xB;
				gfxbuf4bit[gfxbuf4bitloc++] = nextpixelcolor;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0xF0) >> 4;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0x0F);
			}
			else
			{
				if ( pixelcount > 65536 )
					pixelcount = 65536;

				gfxbuf4bit[gfxbuf4bitloc++] = 0xF;
				gfxbuf4bit[gfxbuf4bitloc++] = nextpixelcolor;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0xF000) >> 12;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0x0F00) >> 8;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0x00F0) >> 4;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0x000F);

			}
			i += pixelcount ; // not -1 because of the extra 1 pixel
			continue;
		}
		else
		{
			if ( pixelcount <= 8 )
			{
				gfxbuf4bit[gfxbuf4bitloc++] = pixelcount-1;
				gfxbuf4bit[gfxbuf4bitloc++] = pixelcolor;
			}
			else if ( pixelcount <= 256 )
			{
				gfxbuf4bit[gfxbuf4bitloc++] = 0x8;
				gfxbuf4bit[gfxbuf4bitloc++] = pixelcolor;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0xF0) >> 4;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0x0F);
			}
			else
			{
				if ( pixelcount > 65536 )
					pixelcount = 65536;

				gfxbuf4bit[gfxbuf4bitloc++] = 0xC;
				gfxbuf4bit[gfxbuf4bitloc++] = pixelcolor;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0xF000) >> 12;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0x0F00) >> 8;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0x00F0) >> 4;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-1) & 0x000F);
			}
			i += pixelcount - 1;
			continue;

		}
	}

	//printf("I should = gfxlen.. does it? %d == %d\n", i, gfxlen );

//change endianness, it must match correctly
	if ( gfxtype == GT_IMAGE1 || gfxtype == GT_IMAGE4 ) // big endian
	{
		gfxbuf[0] = (gfxwidth & 0xFF00) >> 8;
		gfxbuf[1] = gfxwidth & 0xFF;
		gfxbuf[2] = (gfxheight & 0xFF00) >> 8;
		gfxbuf[3] = gfxheight & 0xFF;
	}
	else
	{
		gfxbuf[0] = gfxwidth & 0xFF;
		gfxbuf[1] = (gfxwidth & 0xFF00) >> 8;
		gfxbuf[2] = gfxheight & 0xFF;
		gfxbuf[3] = (gfxheight & 0xFF00) >> 8;
	}

	for ( i = 0; i < gfxbuf4bitloc; i += 2 )
	{
		gfxbuf[4+i/2] =  (gfxbuf4bit[i]   & 0x0F) << 4;
		gfxbuf[4+i/2] += (gfxbuf4bit[i+1] & 0x0F);
	}
	gfxlen = gfxbuf4bitloc/2 + 4;
}
int decode_graphic34()
{
	gfxwidth	= swap16(*((int *)(gfxbuf)));
	gfxheight	= swap16(*((int *)(gfxbuf+2)));
	gfxpixeldepth = 8; // gotta be 8;
	//bytesperline = (short)(((width+15)>>1)&0x7ff8);

	//printf("Width:          %u\n", gfxwidth );
	//printf("Height:         %u\n", gfxheight );
	//printf("Bytes per line: %u\n", bytesperline );

	/*
	 * construct a "4bit" buffer instead of an 8 bit buffer
	 * for the graphics
	 */
	int count = 0;
	int i;
	for ( i = 0; i < gfxsizes[gfxnum]; i++ )
	{
		gfxbuf4bit[count++] = (gfxbuf[i] & 0xF0) >> 4;
		gfxbuf4bit[count++] = (gfxbuf[i] & 0xF);
	}
	//hex4bit_display(gfxbuf4bit, gfxsizes[gfxnum]*2);

	gfxcolors[0] = gfxbuf4bit[8];
	gfxcolors[1] = gfxbuf4bit[9];
	gfxcolors[2] = gfxbuf4bit[10];
	gfxcolors[3] = gfxbuf4bit[11];
	gfxcolors[4] = gfxbuf4bit[12];
	gfxcolors[5] = gfxbuf4bit[13];

	gfxbuf4bitloc = 14;

	byte	cur4bit = 0;
	int		save = 0;
	int		pixelcount = 0;
	int		pixelcolor = 0; // 0-15
	int		strcount = 0; // whats this for?
	int		ch1 = 0, ch2 = 0;
	int		bmppixel = 0;

	while ( bmppixel < gfxwidth*gfxheight )
	{
		cur4bit = gfxbuf4bit[gfxbuf4bitloc++];
	
		save = cur4bit&8;
		cur4bit &= 7;
		
		if ( cur4bit == 6 )
		{
			pixelcount = 1;

			if( save == 8 )
				pixelcount = getrepeatcount();
			
			strcount = bmppixel - gfxwidth;

			for( i = 0 ; i < pixelcount; i++ )
				gfxbufbmp[bmppixel++] = gfxbufbmp[strcount++];
		}
		else
		{
			if ( cur4bit < 6 )
			{
				pixelcolor = gfxcolors[cur4bit];
				pixelcount = 1;
			}
			if ( cur4bit == 7 )		
			{
				pixelcolor = gfxbuf4bit[gfxbuf4bitloc++];
				pixelcount = 1;
			}
			if( save == 8 )
			{
				pixelcount = getrepeatcount();
			}

			for( i = 0; i < pixelcount; i++ )
			{
				gfxbufbmp[bmppixel++] = pixelcolor;
			}
		}
	}
	return bmppixel;
}
void encode_graphic2()
{
	int pixelcounts[16];
	int highest;
	int i, j;
	int	pixelcount;
	int pixelcount_uprow;
	byte pixelcolor;
	int pixelcolornum[16];

	gfxbuf4bitloc = 0;
	for (i = 0; i < 16; i++ )
	{
		pixelcounts[i] = 0;
		pixelcolornum[i] = -1;
	}
	for ( i = 0; i < gfxlen; i++ )
	{
		//if ( gfxbufbmp[i] >= 16 )
		//	printf("JOLLY <G> SOMEONES A RETARD ------------------------ %d:%d\n",
		//		i, gfxbufbmp[i]);
		pixelcounts[ gfxbufbmp[i]%16 ]++;
	}
	// find the top 6 colors
	
	for ( i = 0; i < 6; i++ )
	{
		highest = 0;
		for ( j = 1; j < 16; j++ )
		{
			if ( pixelcounts[j] < 0 )
				continue;

			if ( pixelcounts[highest] > pixelcounts[j] )
				highest = j;
		}

		gfxcolors[i] = highest;
		pixelcolornum[highest] = i;
		pixelcounts[highest] = -1;
	}

	for ( i = 0; i < gfxlen; i++ )
	{
		//printf("gfxbuf4bitloc=%d\n", gfxbuf4bitloc );
		pixelcolor = gfxbufbmp[i] & 0xF;

		pixelcount_uprow = 0;
		if ( i >= gfxwidth ) // if we are on the 2nd line
		{
			for ( j = i; j < gfxlen; j++ )
				if ( gfxbufbmp[j] != gfxbufbmp[j-gfxwidth] )
					break;

			pixelcount_uprow = j - i;
		}

		for ( j = i; j < gfxlen; j++ )
			if ( gfxbufbmp[j] != gfxbufbmp[i] )
				break;

		pixelcount = j - i;

		if ( pixelcount_uprow > pixelcount )
		{
			pixelcount = pixelcount_uprow;
			gfxbuf4bit[gfxbuf4bitloc] = 6;
			if ( pixelcount > 1 )
				gfxbuf4bit[gfxbuf4bitloc] |= 0x8;

			gfxbuf4bitloc++;

		}
		else
		{
			// do it by rows
			if ( pixelcolornum[pixelcolor] >= 0 )
			{
				gfxbuf4bit[gfxbuf4bitloc] = pixelcolornum[pixelcolor];
				if ( pixelcount > 1 )
					gfxbuf4bit[gfxbuf4bitloc] |= 0x8;
				gfxbuf4bitloc++;

			}
			else
			{
				gfxbuf4bit[gfxbuf4bitloc] = 7;
				if ( pixelcount > 1 )
					gfxbuf4bit[gfxbuf4bitloc] |= 0x8;
				gfxbuf4bitloc++;

				gfxbuf4bit[gfxbuf4bitloc++] = pixelcolor;
			}
		}
		if ( pixelcount > 1 )
		{
			if ( pixelcount <= 16 )
			{
				gfxbuf4bit[gfxbuf4bitloc++] = pixelcount-2;
			}
			else if ( pixelcount <= 261 )
			{
				gfxbuf4bit[gfxbuf4bitloc++] = 0xF;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-17)&0xF0) >> 4;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount-17)&0x0F);
			}
			else 
			{
				if ( pixelcount > 65535 )
					pixelcount = 65535;
				//printf("Mass graphics2: %-6d loc(%d:%d) (%d,%d)\n", pixelcount,
				//	i, gfxlen, i / gfxwidth, i%gfxwidth);

				gfxbuf4bit[gfxbuf4bitloc++] = 0xF;
				gfxbuf4bit[gfxbuf4bitloc++] = 0xF;
				gfxbuf4bit[gfxbuf4bitloc++] = 0xF;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount)&0xF000) >> 12;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount)&0x0F00) >> 8;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount)&0x00F0) >> 4;
				gfxbuf4bit[gfxbuf4bitloc++] = ((pixelcount)&0x000F);
			}
		}
		i += pixelcount-1;
	}

	gfxbuf4bit[gfxbuf4bitloc] = 0; // just inc ase
	gfxbuf4bit[gfxbuf4bitloc+1] = 0; // just inc ase

	if ( gfxtype == GT_IMAGE1 || gfxtype == GT_IMAGE4 ) // big endian
	{
		gfxbuf[0] = (gfxwidth & 0xFF00) >> 8;
		gfxbuf[1] = gfxwidth & 0xFF;
		gfxbuf[2] = (gfxheight & 0xFF00) >> 8;
		gfxbuf[3] = gfxheight & 0xFF;
	}
	else
	{
		gfxbuf[0] = gfxwidth & 0xFF;
		gfxbuf[1] = (gfxwidth & 0xFF00) >> 8;
		gfxbuf[2] = gfxheight & 0xFF;
		gfxbuf[3] = (gfxheight & 0xFF00) >> 8;
	}

	gfxbuf[4] = gfxcolors[0] << 4;
	gfxbuf[4] += gfxcolors[1];
	gfxbuf[5] = gfxcolors[2] << 4;
	gfxbuf[5] += gfxcolors[3];
	gfxbuf[6] = gfxcolors[4] << 4;
	gfxbuf[6] += gfxcolors[5];

	gfxlen = 7;
	for ( i = 0; i < gfxbuf4bitloc; i += 2 )
	{
		gfxbuf[7+(i/2)] = 0;
		gfxbuf[7+(i/2)] += (gfxbuf4bit[i] & 0x0F) << 4;
		gfxbuf[7+(i/2)] += (gfxbuf4bit[i+1] & 0x0F);
		gfxlen += 1;
	}
	//gfxlen = gfxbuf4bitloc/2 + 7;

}
void writesound()
{
	FILE *f;
	char buf[256];

	if ( mapfile )
	{
		sprintf(buf, "%s%-4s.%-4s.%-4s [%s]",
			workdir, maps[gfxnum].num, maps[gfxnum].type,
			maps[gfxnum].info, ( maps[gfxnum].name1[0] ? 
			maps[gfxnum].name1 : "Unknown" ));

		if ( maps[gfxnum].name2[0] )
		{
			strcat(buf, " ");
			strcat(buf, maps[gfxnum].name2);
		}

		strcat(buf, ".snd");
	}
	else
		sprintf(buf, "%sdmout%03d.snd", workdir, gfxnum );
	f = fopen( buf, "wb" );
	if ( !f )
		return;

	fwrite(gfxbuf, sizeof(unsigned char), gfxsizesexp[gfxnum], f);
	fclose(f);
}
void writetext()
{
	FILE *f;
	char buf[2048];

	if ( mapfile )
	{
		sprintf(curfilename, "%-4s.%-4s.%-4s [%s]",
			maps[gfxnum].num, maps[gfxnum].type,
			maps[gfxnum].info, ( maps[gfxnum].name1[0] ? 
			maps[gfxnum].name1 : "Unknown" ));

		if ( maps[gfxnum].name2[0] )
		{
			strcat(curfilename, " ");
			strcat(curfilename, maps[gfxnum].name2);
		}

		strcat(curfilename, ".txt");
	}
	else
		sprintf(curfilename, "dmout%03d.txt", gfxnum );

	sprintf(buf, "%s%s", workdir, curfilename);

	printf("Writing file: %s ...", buf );
	f = fopen( buf, "w" );
	if ( !f )
	{
		printf("\nCould not open file: %s\n", buf );
		return;
	}
	int i;
	int bufnum;
	char chr;

	for ( i = 0, bufnum = 0; i < gfxsizesexp[gfxnum]; i++ )
	{
		if ( gfxtype == GT_TEXT2 )	
		{
			chr = buf[bufnum++] = gfxbuf[i];
			if ( chr == 0 ) // end
			{
				buf[--bufnum] = '\n';
				buf[++bufnum] = '\0';
				fprintf(f, buf);
				buf[0] = '\0';
				bufnum = 0;
			}
		}
		else
		{
			buf[bufnum++] = gfxbuf[i] & 0x7F;
			if ( gfxbuf[i] & 0x80 )
			{
				buf[bufnum++] = '\n';
				buf[bufnum] = '\0';
				fprintf(f, buf);
				buf[0] = '\0';
				bufnum = 0;
			}
		}
	}
	printf("Complete!\n");
	fclose(f);	
}
void encode_text()
{
	int i;
	int bufnum;

	bufnum = 0;
	for ( i = 0; i < gfxfilesize; i++ )
	{
		if ( gfxtype == GT_TEXT1 )
		{
			if ( gfxbufbmp[i] == '\n' || gfxbufbmp[i] == '\r' )
				gfxbuf[bufnum-1] |= 0x80; 
			else
				gfxbuf[bufnum++] = gfxbufbmp[i];
		}
		else
		{
			if ( gfxbufbmp[i] == '\n' )
				gfxbuf[bufnum++] = 0x00; 
			else
				gfxbuf[bufnum++] = gfxbufbmp[i];
		}
	}
	gfxlen = bufnum;
}
void writeunknown()
{
	FILE *f;
	char buf[256];

	if ( mapfile )
	{
		sprintf(curfilename, "%-4s.%-4s.%-4s [%s]",
			maps[gfxnum].num, maps[gfxnum].type,
			maps[gfxnum].info, ( maps[gfxnum].name1[0] ? 
			maps[gfxnum].name1 : "Unknown" ));

		if ( maps[gfxnum].name2[0] )
		{
			strcat(curfilename, " ");
			strcat(curfilename, maps[gfxnum].name2);
		}

		strcat(curfilename, ".dat");
	}
	else
		sprintf(curfilename, "dmout%03d.dat", gfxnum );
	
	sprintf(buf, "%s%s", workdir, curfilename);

	printf("Writing file: %s ...", buf );
	f = fopen( buf, "wb" );
	if ( !f )
	{
		printf("\nCould not open file: %s\n", buf );
		return;
	}

	fwrite(gfxbuf, sizeof(unsigned char), gfxsizesexp[gfxnum], f);
	printf("Complete!\n");
	fclose(f);

}
/*void decode_pixels()
{
	int pad;

	pad = gfxwidth & 0x3;
	if ( pad )
		pad = 4 - pad;

	if ( gfxtype == GT_FONT )
	{
		int i;

		for ( i = 5; i >= 0; i-- )
			fwrite(gfxbufbmp+(128*i),sizeof(char),128,bmpfile);
	}
	else
	{
		int pixel;
		char opchar;
		for( int line = 0; line < gfxheight; line++ )
		{	
			for( pixel = gfxwidth; pixel > 0; pixel-- )
			{
				opchar = gfxbufbmp[size-((line*gfxwidth)+pixel)];
				fwrite(&opchar,sizeof(char),1,bmpfile);
			}
			if(pad>0)	fwrite(&opchar,sizeof(char),pad,bmpfile);

		}
	}
}*/
void writegraphic()
{
	//unsigned char *ptr;
	int size;// = i;

	size = gfxwidth*gfxheight;
	//hex_display(gfxbufbmp, size+16);
	//printf( "Total size: %d\n", size );

	FILE *bmpfile;
	char buf[256];
	
	if ( mapfile )
	{
		sprintf(curfilename, "%-4s.%-4s.%-4s [%s]",
			maps[gfxnum].num, maps[gfxnum].type,
			maps[gfxnum].info, ( maps[gfxnum].name1[0] ? 
			maps[gfxnum].name1 : "Unknown" ));

		if ( maps[gfxnum].name2[0] )
		{
			strcat(curfilename, " ");
			strcat(curfilename, maps[gfxnum].name2);
		}

		strcat(curfilename, ".bmp");
	}
	else
		sprintf(curfilename, "dmout%03d.bmp", gfxnum );

	sprintf(buf, "%s%s", workdir, curfilename);

	printf("Writing file: %s ...", buf );
	bmpfile = fopen( buf, "wb" );
	if ( !bmpfile )
	{
		printf("\nCould not open file: %s\n", buf );
		return;
	}

	build_bitmap_header(gfxpixeldepth, gfxwidth, gfxheight);

	//write bmp header
	fwrite(&bmpheader.bitmapfileheader,sizeof(BITMAPFILEHEADER),1,bmpfile);
	fwrite(&bmpheader.bitmapinfoheader,sizeof(BITMAPINFOHEADER),1,bmpfile);
	fwrite(gfxpalette,sizeof(gfxcolor),gfxcolorcount,bmpfile);
	//printf("%-3d Writing %d colors\n", gfxnum, gfxcolorcount );

	int pad;
		int i;


	pad = gfxwidth & 0x3;
	if ( pad )
		pad = 4 - pad;

	if ( gfxtype == GT_FONT )
	{
		for ( i = 5; i >= 0; i-- )
			fwrite(gfxbufbmp+(128*i),sizeof(char),128,bmpfile);
	}
	else
	{
		int pixel;
		char opchar;
		for( int line = 0; line < gfxheight; line++ )
		{	
			for( pixel = gfxwidth; pixel > 0; pixel-- )
			{
				opchar = gfxbufbmp[size-((line*gfxwidth)+pixel)];
				fwrite(&opchar,sizeof(char),1,bmpfile);
			}
			opchar = 0;
			for ( i = 0; i < pad; i++ )
				fwrite(&opchar,sizeof(char),1,bmpfile);

		}
	}
//	fwrite(gfxbufbmp, sizeof(char), size, bmpfile);

	printf("Complete!\n");
	fclose(bmpfile);
}
bool readgraphic()
{
	int start, i;
	int bytes;

	if ( gfxsizes[gfxnum] == 0 )
	{
		gfxtype = GT_FREESLOT;
		return true;
	}

	start = 2;
	if ( filetype == FT_DMCSB2 || filetype == FT_DM2 )
		start += 2; // 800x checksum?
	if ( filetype == FT_DM2 )
		start += 2; // additional 2 bytes for first itemsize
	start += numitems * 2;
	if ( filetype == FT_DMCSB1 || filetype == FT_DMCSB2 )
		start += numitems * 2;
	if ( filetype == FT_DMCSB2 )
		start += numitems * 4;


	for ( i = 0; i < gfxnum; i++ )
		start += gfxsizes[i];

	printf("Reading item #%-4d size %-5d type: %s\n", gfxnum,
		gfxsizes[gfxnum], ( mapfile ? maps[gfxnum].type : "????" ) );
	fseek(infile, start, SEEK_SET );
	fread(gfxbuf, sizeof(unsigned char), gfxsizes[gfxnum], infile );
	//hex_display(gfxbuf, 64);
	if ( gfxsizes[gfxnum] != gfxsizesexp[gfxnum] )
	{
		memcpy(LZWInput, gfxbuf, gfxsizes[gfxnum] );
		LZWInputLen = gfxsizes[gfxnum];
		int bytes;

		bytes = LZWDecompress();
		memcpy(gfxbuf, LZWOutput, gfxsizesexp[gfxnum] );
	}

	gfxwidth = swap16(*((int *)(gfxbuf)));
	gfxheight = swap16(*((int *)(gfxbuf+2)));

	//printf("Width:          %u\n", gfxwidth );
	//printf("Height:         %u\n", gfxheight );

	/*if ( gfxnum < 500 )
	{
		// force it for now
		gfxtype = GT_IMAGE2;
		bytes = decode_graphic34();
		//printf("Bytes = w*h? %d == %d (%d*%d)\n",
		//	bytes, gfxwidth*gfxheight, gfxwidth, gfxheight );
		return;
	}*/
	if ( mapfile )
	{
		if ( !strcmp(maps[gfxnum].type, "IMG1") )
			gfxtype = GT_IMAGE1;
		else if ( !strcmp(maps[gfxnum].type, "IMG2") )
			gfxtype = GT_IMAGE2;
		else if ( !strcmp(maps[gfxnum].type, "IMG3") )
			gfxtype = GT_IMAGE3;
		else if ( !strcmp(maps[gfxnum].type, "IMG4") )
			gfxtype = GT_IMAGE4;
		else if ( !strcmp(maps[gfxnum].type, "FNT1") )
			gfxtype = GT_FONT;
		else if ( !strcmp(maps[gfxnum].type, "SND1") )
			gfxtype = GT_SOUND1;
		else if ( !strcmp(maps[gfxnum].type, "SND2") )
			gfxtype = GT_SOUND2;
		else if ( !strcmp(maps[gfxnum].type, "SND3") )
			gfxtype = GT_SOUND3;
		else if ( !strcmp(maps[gfxnum].type, "SND4") )
			gfxtype = GT_SOUND4;
		else if ( !strcmp(maps[gfxnum].type, "SND5") )
			gfxtype = GT_SOUND5;
		else if ( !strcmp(maps[gfxnum].type, "SND6") )
			gfxtype = GT_SOUND6;
		else if ( !strcmp(maps[gfxnum].type, "SND7") )
			gfxtype = GT_SOUND7;
		else if ( !strcmp(maps[gfxnum].type, "TXT1") )
			gfxtype = GT_TEXT1;
		else if ( !strcmp(maps[gfxnum].type, "TXT2") )
			gfxtype = GT_TEXT2;
		else if ( !strcmp(maps[gfxnum].type, "P4B1") )
			gfxtype = GT_PALETTE;
		else if ( !strcmp(maps[gfxnum].type, "SEQ1") )
			gfxtype = GT_SEQUENCE1;
		else if ( !strcmp(maps[gfxnum].type, "SEQ2") )
			gfxtype = GT_SEQUENCE2;
		else if ( !strcmp(maps[gfxnum].type, "RAW1") )
			gfxtype = GT_RAW1;
		else if ( !strcmp(maps[gfxnum].type, "RAW2") )
			gfxtype = GT_RAW2;
		else if ( !strcmp(maps[gfxnum].type, "NULL") )
			gfxtype = GT_FREESLOT;
		else
			gfxtype = GT_UNKNOWN;
			
		if ( gfxtype >= GT_IMAGE1 && gfxtype <= GT_IMAGE4 )
		{
			bool old_endian = endian;

			if ( gfxtype == GT_IMAGE1 || gfxtype == GT_IMAGE4 )
				endian = E_BIG;
			else
				endian = E_LITTLE;
			
			if ( gfxtype == GT_IMAGE1 || gfxtype == GT_IMAGE2 )
				bytes = decode_graphic12();
			else
				bytes = decode_graphic34();

			if ( bytes != gfxwidth*gfxheight )
			{
				printf("Error: item #%d is corrupt!\n", gfxnum);
				printf("More information...\n\n");
				printf("Item number:               %d\n", gfxnum);
				printf("Item type:                 %s\n", maps[gfxnum].type );
				printf("Mapfile line:              %d\n", gfxnum+2);
				printf("Width:                     %d\n", gfxwidth );
				printf("Height:                    %d\n", gfxheight);
				printf("Number of pixels decoded:  %d (should be %d)\n",
					bytes, gfxwidth*gfxheight);

				endian = old_endian;
				if ( bytes - (gfxwidth*gfxheight) > 0 && bytes - (gfxwidth*gfxheight) < 10 )
				{
					printf("\nSmall amount of excess pixels, ignoring error\n");
					return true;
				}
				return false;
			}
		}
		else if ( gfxtype == GT_TEXT1 )
		{
			// all characters should be printable
			for ( i = 0; i < gfxsizesexp[gfxnum]; i++ )
			{
				if ( gfxbuf[i] & 0x7f < 32 )
				{
					printf("Error: item #%d is corrupt!\n", gfxnum);
					printf("More information...\n\n");
					printf("Item number:               %d\n", gfxnum);
					printf("Item type:                 %s\n", maps[gfxnum].type );
					printf("Mapfile line:              %d\n", gfxnum+2);
					return false;
				}
			}
		}
		else if ( gfxtype == GT_TEXT2 )
		{
			// all characters should be printable or 0
			for ( i = 0; i < gfxsizesexp[gfxnum]; i++ )
			{
				if ( gfxbuf[i] > 128 || (gfxbuf[i] > 0 && gfxbuf[i] < 32) )
				{
					printf("Error: item #%d is corrupt!\n", gfxnum);
					printf("More information...\n\n");
					printf("Item number:               %d\n", gfxnum);
					printf("Item type:                 %s\n", maps[gfxnum].type );
					printf("Mapfile line:              %d\n", gfxnum+2);
					return false;
				}
			}
		}
		else if ( gfxtype == GT_FONT )
		{
			// all characters should be printable or 0
			if ( gfxsizesexp[gfxnum] != 768 )
			{
				printf("Error: item #%d is corrupt!\n", gfxnum);
				printf("More information...\n\n");
				printf("Item number:               %d\n", gfxnum);
				printf("Item type:                 %s\n", maps[gfxnum].type );
				printf("Mapfile line:              %d\n", gfxnum+2);
				printf("Item size:                 %d (should be 768)\n",
					gfxsizesexp[gfxnum] );
				return false;
			}
			decode_font();
		}
		return true;
	}

	bool old_endian = endian;
	endian = E_LITTLE;

	gfxtype = GT_UNKNOWN;
	gfxwidth = swap16(*((int *)(gfxbuf)));
	gfxheight = swap16(*((int *)(gfxbuf+2)));
	// attempt to autodetect
	if ( gfxwidth > 0 && gfxwidth <= 800 
		&& gfxheight > 0 && gfxheight <= 600 )
	{
		if ( gfxprimaryencoding == 1 || gfxprimaryencoding == 2 )
		{
			bytes = decode_graphic12();
			if ( bytes == gfxwidth*gfxheight )
				gfxtype = GT_IMAGE2;
			bytes = decode_graphic34();
			if ( bytes == gfxwidth*gfxheight )
				gfxtype = GT_IMAGE3;
		}
		else
		{
			bytes = decode_graphic34();
			if ( bytes == gfxwidth*gfxheight )
				gfxtype = GT_IMAGE3;
			bytes = decode_graphic12();
			if ( bytes == gfxwidth*gfxheight )
				gfxtype = GT_IMAGE2;
		}
	}
	endian = old_endian;
	if ( gfxtype != GT_UNKNOWN )
		return true;
	
	endian = E_BIG;

	gfxtype = GT_UNKNOWN;
	gfxwidth = swap16(*((int *)(gfxbuf)));
	gfxheight = swap16(*((int *)(gfxbuf+2)));
	// attempt to autodetect
	if ( gfxwidth > 0 && gfxwidth <= 800 
		&& gfxheight > 0 && gfxheight <= 600 )
	{
		if ( gfxprimaryencoding == 1 || gfxprimaryencoding == 2 )
		{
			bytes = decode_graphic12();
			if ( bytes == gfxwidth*gfxheight )
				gfxtype = GT_IMAGE1;
			bytes = decode_graphic34();
			if ( bytes == gfxwidth*gfxheight )
				gfxtype = GT_IMAGE4;
		}
		else
		{
			bytes = decode_graphic34();
			if ( bytes == gfxwidth*gfxheight )
				gfxtype = GT_IMAGE4;
			bytes = decode_graphic12();
			if ( bytes == gfxwidth*gfxheight )
				gfxtype = GT_IMAGE1;
		}
	}
	
	endian = old_endian;
	if ( gfxtype != GT_UNKNOWN )
		return true;

	int returncount;
	int charactercount;

	returncount = charactercount = 0;
	// we can assume if all the bytes are letters.. its a text
	// all characters should be printable
	gfxtype = GT_TEXT1;
	for ( i = 0; i < gfxsizesexp[gfxnum]; i++ )
	{
		if ( !isprint(gfxbuf[i] & 0x7f) )
		{
			gfxtype = GT_UNKNOWN;
			break;
		}
		if ( gfxbuf[i] & 0x80 ) // return
			returncount++;
		else
			charactercount++;
	}
	// If the amount of returns is MORE then the characters, its 
	// most likely that it is not a TEXT1.  This is not extremely
	// pricise, but then again, MAP files are.
	if ( returncount >= charactercount )
		gfxtype = GT_UNKNOWN;

	if ( gfxtype != GT_UNKNOWN )
		return true;

	returncount = charactercount = 0;
	gfxtype = GT_TEXT2;
	for ( i = 0; i < gfxsizesexp[gfxnum]; i++ )
	{
		if ( !isprint(gfxbuf[i]) && gfxbuf[i] != 0)
		{
			gfxtype = GT_UNKNOWN;
			break;
		}
		if ( gfxbuf[i] == 0 ) // return
			returncount++;
		else
			charactercount++;
	}
	if ( returncount >= charactercount )
		gfxtype = GT_UNKNOWN;

	if ( gfxtype != GT_UNKNOWN )
		return true;

	if ( gfxsizesexp[gfxnum] == 768 ) // font
	{
		gfxtype = GT_FONT;
		decode_font();
		return true;
	}

	gfxtype = GT_UNKNOWN;
	return true;
}


void build_color(gfxcolor *c, unsigned char red, unsigned char green, unsigned char blue)
{
	c->red = red;
	c->green = green;
	c->blue = blue;
	c->flags = 0;
}
void build_bitmap_header(int pixeldepth, int width, int height)
{
	// create the palette
	int		padding;

	gfxcolorcount = (1 << pixeldepth);
	if ( gfxpalette )
		free(gfxpalette);
	gfxpalette = (gfxcolor *)malloc(sizeof(gfxcolor)*gfxcolorcount);

	if ( gfxcolorcount == 2 )
	{
		build_color(&gfxpalette[0], 0x00, 0x00, 0x00 );
		build_color(&gfxpalette[1], 0xFF, 0xFF, 0xFF );
	}
	else if ( gfxcolorcount >= 16 )
	{
		build_color(&gfxpalette[0], 0x00, 0x00, 0x00 );
		build_color(&gfxpalette[1], 0x6D, 0x6D, 0x6D );
		build_color(&gfxpalette[2], 0x91, 0x91, 0x91 );
		build_color(&gfxpalette[3], 0x00, 0x24, 0x6D );
		build_color(&gfxpalette[4], 0xDA, 0xDA, 0x00 );
		build_color(&gfxpalette[5], 0x00, 0x48, 0x91 );
		build_color(&gfxpalette[6], 0x00, 0x91, 0x00 );
		build_color(&gfxpalette[7], 0x00, 0xDA, 0x00 );
		build_color(&gfxpalette[8], 0x00, 0x00, 0xFF );
		build_color(&gfxpalette[9], 0x00, 0xB6, 0xFF );
		build_color(&gfxpalette[10], 0x6D, 0x91, 0xDA );
		build_color(&gfxpalette[11], 0x00, 0xFF, 0xFF );
		build_color(&gfxpalette[12], 0x48, 0x48, 0x48 );
		build_color(&gfxpalette[13], 0xB6, 0xB6, 0xB6 );
		build_color(&gfxpalette[14], 0xFF, 0x00, 0x00 );
		build_color(&gfxpalette[15], 0xFF, 0xFF, 0xFF );
	}

	if ( gfxcolorcount > 16 ) // we need a transparent pixel... 
	{
		build_color(&gfxpalette[16], 0xFF, 0x00, 0xFF );
	}
	
	BITMAPFILEHEADER *bmfh;
	BITMAPINFOHEADER *bmih;

	bmfh = &bmpheader.bitmapfileheader;
	bmih = &bmpheader.bitmapinfoheader;


	padding = width&0x3;
	if ( padding )
		padding = 4-padding;

	bmfh->bfType			=	0x4d42;
	bmfh->bfSize			=	54 + gfxcolorcount*4 + 
			(width*pixeldepth+padding) * height / 8;
	bmfh->bfReserved1		=	0;
	bmfh->bfReserved2		=	0;
	bmfh->bfOffBits			=	54 + gfxcolorcount*4;

	bmih->biSize			=	40;
	bmih->biWidth			=	width;
	bmih->biHeight			=	height;
	bmih->biPlanes			=	1;
	bmih->biBitCount		=	pixeldepth;
	bmih->biCompression		=	0;
	bmih->biSizeImage		=	(width*pixeldepth+padding) * height / 8;
	bmih->biXPelsPerMeter	=	2835;
	bmih->biYPelsPerMeter	=	2835;
	bmih->biClrUsed			=	gfxcolorcount;
	bmih->biClrImportant	=	gfxcolorcount;

}

#define ERR_INVALID_BMP_TYPE 450

int decode_bmpheader()
{
	BITMAPFILEHEADER	*bmfh;
	BITMAPINFOHEADER	*bmih;
	char				*palette;
	char				*pixels;

	int bmpheadersize;

	bmfh = (BITMAPFILEHEADER *)gfxbufbmp;
	bmih = (BITMAPINFOHEADER *)(gfxbufbmp + sizeof(BITMAPFILEHEADER));
	palette = (char *)(gfxbufbmp + sizeof(BITMAPFILEHEADER) + sizeof(BITMAPINFOHEADER));

	//hex_display((unsigned char *)bmfh, 54 );
	//hex_display((unsigned char *)bmih, 50 );

	if ( bmfh->bfType != 0x4d42 )
		return ERR_INVALID_BMP_TYPE;

	gfxwidth = bmih->biWidth;
	gfxheight = bmih->biHeight;
	gfxpixeldepth = bmih->biBitCount;
	//gfxcolorcount = bmih->biClrUsed;
	gfxcolorcount = 1 << bmih->biBitCount;
	//printf("Color depth: %d (%d colors)\n", gfxpixeldepth, gfxcolorcount );

	bmpheadersize = sizeof(BITMAPFILEHEADER);
	bmpheadersize += sizeof(BITMAPINFOHEADER);
	bmpheadersize += gfxcolorcount * sizeof(gfxcolor);

	pixels = (char *)gfxbufbmp + bmpheadersize;
	
	memmove(gfxbufbmp, pixels, gfxfilesize - bmpheadersize );
	gfxfilesize -= bmpheadersize;
	//printf("Subtracting %d should be %ul\n", bmpheadersize, bmfh->bfOffBits );

	//printf("Width: %d Height %d\n", gfxwidth, gfxheight );
	
	gfxlen = gfxfilesize;
	//hex_display((unsigned char *)gfxbufbmp, gfxfilesize );
	return 0;
}
