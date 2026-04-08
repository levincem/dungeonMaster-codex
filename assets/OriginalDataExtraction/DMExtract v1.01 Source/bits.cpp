

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>
#include <stdarg.h>

#include "lzw.h"
#include "main.h"


void hex_display(unsigned char *hex, int len)
{
	int i, j;


	for ( i = 0; i < len; i++ )
	{
		if ( i % 16 == 0 )
		{
			printf("%4i %08x ", i,i );
		}
		printf("%02x ", hex[i] );
		if ( i % 16 == 15 )
		{
			for ( j = i - 15; j <= i; j++ )
			{
				printf("%c", isprint(hex[j]) ? hex[j] : '.' );
			}
			printf("\n");
			if ( i == len-1 )
				i++;
		}
	}
	while ( i % 16 != 0 )
	{
		printf("   " );
		i++;
	}
	i -= 16;
	for ( ; i < len; i++ )
	{
		printf("%c", isprint(hex[i]) ? hex[i] : '.' );
	}
	printf("\n");
}

void hex4bit_display(unsigned char *hex, int len)
{
	int i;

	for ( i = 0; i < len; i++ )
	{
		if ( i % 32 == 0 )
		{
			printf("%4i %08x ", i/2, i/2 );
		}
		printf("%01x", hex[i] & 0x0f );

		if ( i % 2 == 1 )
			printf(" " );

		if ( i % 32 == 31 )
			printf("\n");
	}
	printf("\n");
}

short swap16(short i16)
{
    byte    b1,b2;

#ifdef LITTLE_ENDIAN
	if ( endian == E_LITTLE )
		return i16;
#endif
#ifndef LITTLE_ENDIAN
	if ( endian == E_BIG )
		return i16
#endif
    b1 = i16&255;
    b2 = (i16>>8)&255;

    return (b1<<8) + b2;
}
int swap32 (int i32)
{
    byte    b1,b2,b3,b4;

#ifdef LITTLE_ENDIAN
	if ( endian == E_LITTLE )
		return i32;
#endif
#ifndef LITTLE_ENDIAN
	if ( endian == E_BIG )
		return i32
#endif

    b1 = i32&255;
    b2 = (i32>>8)&255;
    b3 = (i32>>16)&255;
    b4 = (i32>>24)&255;

    return ((int)b1<<24) + ((int)b2<<16) + ((int)b3<<8) + b4;
}

bool	filter(char *msg, char *string, ...)
{
	char		array[32][256];
	char		str[256];
	char		*instr;
	int			i, j, num;
	va_list		args;

	va_start(args, string);
	
	for ( i = 0, j=0, num = 0; i < (int)strlen(string); i++ )
	{
		if ( string[i] == '' ) // input code
		{
			str[j] = '\0';
			
			strcpy(array[num], str );
			num++;
			array[num][0] = 1;
			array[num][1] = 0;
			num++;
			
			j = 0;
			str[j] = '\0';
			continue;
		}
			
		str[j] = string[i];
		j++;
		str[j] = '\0';
		
	}
	if ( j > 0 )
		strcpy(array[num++], str );
		
	array[num][0] = 127;
	
	for ( i = 0; i < 32 && array[i][0] != 127; i++ )
	{
		// go thru em all
		if ( array[i][0] == 1 ) // input
		{
			instr = (char *)va_arg(args, char *);
			
			if ( array[i+1][0] == 127 ) // the end
			{
				while ( *msg != '\0' )
				{
					*instr++ = *msg++; 
				}
			}
			else
			{
				while ( *msg != '\0' )
				{
					if ( !strncmp(msg, array[i+1], strlen(array[i+1]) ) )
						break;

					*instr++ = *msg++; 
				}
			}
			*instr = '\0';
		}
		else // search for this string
		{
			if ( strncmp(msg, array[i], strlen(array[i])) )
				return false;

			msg = msg+strlen(array[i]);
		}
	}
/*	for ( i = 0; i < 32 && array[i][0] != 127; i++ )
	{
		if ( array[i][0] == 127 )
		{
			printf("Break\n");
			break;
		}
		else if ( array[i][0] == 1 )
			printf("Input\n");
		else
			printf("Request: %s\n", array[i]);
			
	}
*/
	va_end(args);
	
	return true;
}


char *read_string(FILE *fp)
{
	static	char	buf[4][2096];
	static	int		num=0;

	num = (num+1) % 4;
	buf[num][0] = 0;
	if ( !fscanf(fp, "%[^\n\r]", buf[num] ))
		return NULL;

	fgetc(fp); // get the return

	return buf[num];

}

char *get_attribute(char *str, int num)
{
	static	char	attr[6][256]; // up to 256 characters, 10 of them

	if ( num < 1 )
		num = 1;
	if ( num > 6 )
		num = 6;


	if ( filter(str, ",,,,,", attr[0], attr[1],
			attr[2], attr[3], attr[4], attr[5] ) )
		return attr[num-1];
	
	if ( num > 2 )
		num = 2;

	else if ( filter(str, ",", attr[0], attr[1] ) )
		return attr[num-1];

	return NULL;
}
