/********************************************************************
**
** Uncompress lZW CSB/DM files =[ *pain in the butt*
**
*********************************************************************/
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <windows.h>

#include "main.h"

unsigned char	LZWStringTable[1024*32][24]; // lots
char			LZWStringTableLen[1024*32];
int				LZWStringNum;
unsigned char	LZWInput[1024*32]; // 32k
int				LZWInputLen;
int				LZWInputLoc;
unsigned char	LZWOutput[1024*32]; // 32k
int				LZWOutputLen;
int				LZWOutputLoc;
int				LZWBits; // 9
int				LZWBitsInBuffer;
unsigned int	LZWBitBuffer;
char			LZWChar;

int LZWDecompress();
int	LZWGetCode();
int LZWGetString(const char *str, int len);
void LZWOutputCode(int code);
void LZWOutputString(char *str, int len);
void LZWAddString(const char *str, int len);

/*
 * LZW_GetString(str);
 *
 * Returns the number associated with the String Table for the givin string
 */
int LZWGetString(const char *str, int len)
{
	int i;

	for ( i = 0; i < LZWStringNum; i++ )
	{
		if ( LZWStringTableLen[i] != len )
			continue;

		if ( !memcmp(str, LZWStringTable[i], len) )
			return i;
	}
	return -1;
}
void LZWAddString(const char *str, int len)
{
	memcpy(LZWStringTable[LZWStringNum], str, len);
	LZWStringTableLen[LZWStringNum] = len;
	LZWStringNum += 1;
}
int	LZWGetCode()
{
	unsigned int nextcode;
	unsigned int newbyte;

	while ( LZWBitsInBuffer < LZWBits && LZWInputLoc < LZWInputLen )
	{
		newbyte = LZWInput[LZWInputLoc++];
		LZWBitBuffer += newbyte << LZWBitsInBuffer;
		LZWBitsInBuffer += 8;
	}

	// not enough bits read, no more codes
	if ( LZWBitsInBuffer < LZWBits )
		nextcode = -1;
	else
	{
		nextcode = LZWBitBuffer & ((1<<LZWBits) -1);
		LZWBitBuffer = LZWBitBuffer / (int)pow(2, LZWBits);
		LZWBitsInBuffer -= LZWBits;
	}
	
	return nextcode;
}
int LZWDecompress()
{

	LZWBitBuffer		= 0;
	LZWBitsInBuffer		= 0;
	LZWBits				= 9; // starting
	LZWInputLoc			= 0;
	LZWOutputLoc		= 0;

	int			i,j;
	int			oldcode, newcode;
	char		curstring[256];
	int			curstringlen;
	
	LZWStringNum = 257;
	LZWStringTableLen[256] = 0;

	for ( i = 0; i < 256; i++ )
	{
		memcpy(LZWStringTable[i], &i, sizeof(char));
		LZWStringTableLen[i] = 1;
	}
	
	oldcode = LZWGetCode();
	LZWOutputCode(oldcode);
	LZWChar = (char)oldcode; // its not perfect =[

	newcode = LZWGetCode();
	while ( newcode != -1 )
	{
		if ( newcode == 256 )
		{
			LZWStringNum = 257;
			LZWStringTableLen[256] = 0;
			LZWBits = 9;
		}
		else
		{
			if ( newcode < LZWStringNum )
			{
				memcpy(curstring, LZWStringTable[newcode], LZWStringTableLen[newcode] );
				curstringlen = LZWStringTableLen[newcode];
			}
			else
			{
				memcpy(curstring, LZWStringTable[oldcode], LZWStringTableLen[oldcode] );
				curstringlen = LZWStringTableLen[oldcode];
				curstring[curstringlen] = LZWChar;
				curstringlen += 1;
			}	
			LZWOutputString(curstring, curstringlen);
			LZWChar = curstring[0];
			
			memcpy(curstring, LZWStringTable[oldcode], LZWStringTableLen[oldcode] );
			curstringlen = LZWStringTableLen[oldcode];
			curstring[curstringlen] = LZWChar;
			curstringlen += 1;


			LZWAddString(curstring, curstringlen);
			if ( LZWBits < 12 ) 
			{
				if ( LZWStringNum == (1<<LZWBits) )
				{
					LZWBits++;
				}
			}
			oldcode = newcode;
		}
		newcode = LZWGetCode();
	}

	LZWOutputLen = LZWOutputLoc;
	for ( i = 0; i < LZWOutputLen; i++ )
	{
		if ( LZWOutput[i] == 0x90 ) // special dumbass character...
		{
			newcode = LZWOutput[i+1];
			if ( newcode == 0 )
			{
				for ( j = i+1; j < (LZWOutputLen-1); j++ )
					LZWOutput[j] = LZWOutput[j+1];

				LZWOutputLen -= 1;
				//i++;
				continue;
			}
			else if ( i > 0 ) // accessing a [i-1];
			{
				oldcode = LZWOutput[i-1];
				newcode -= 1;
				for ( j = LZWOutputLen + newcode - 2; j >= i + newcode - 2; j-- )
				{
					LZWOutput[j] = LZWOutput[j-(newcode-2)];
				}
				for ( j = 0; j < newcode; j++ )
				{
					LZWOutput[i + j] = oldcode;
				}
				LZWOutputLen -= 2;
				LZWOutputLen += newcode;
				i += newcode ;
				continue;
			}
		}
	}

	return LZWOutputLen;
}

void LZWOutputCode(int code)
{
	memcpy(LZWOutput+LZWOutputLoc, LZWStringTable[code], LZWStringTableLen[code] );
	LZWOutputLoc += LZWStringTableLen[code];
}

void LZWOutputString(char *str, int len)
{
	memcpy(LZWOutput+LZWOutputLoc, str, len );
	LZWOutputLoc += len;
}