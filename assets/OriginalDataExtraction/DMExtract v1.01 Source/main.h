
#define		LITTLE_ENDIAN

#define		GT_IMAGE1		11	// IMG1/IMG2 format
#define		GT_IMAGE2		12	// IMG3/IMG4 format
#define		GT_IMAGE3		13	// IMG3/IMG4 format
#define		GT_IMAGE4		14	// IMG3/IMG4 format
#define		GT_SOUND1		21	// NEEDS IMPROVEMENT
#define		GT_SOUND2		22	// NEEDS IMPROVEMENT
#define		GT_SOUND3		23	// NEEDS IMPROVEMENT
#define		GT_SOUND4		24	// NEEDS IMPROVEMENT
#define		GT_SOUND5		25	// NEEDS IMPROVEMENT
#define		GT_SOUND6		26	// NEEDS IMPROVEMENT
#define		GT_SOUND7		27	// NEEDS IMPROVEMENT
#define		GT_TEXT1		31	// 0x80 bit added to char breaks
#define		GT_TEXT2		32	// 0x00 bit after char breaks
#define		GT_FONT			40
#define		GT_PALETTE		50
#define		GT_SEQUENCE1	61
#define		GT_SEQUENCE2	62
#define		GT_RAW1			71
#define		GT_RAW2			72
#define		GT_UNKNOWN		80	
#define		GT_FREESLOT		90	// empty slot in graphics.dat file

#define		FT_DMCSB1		1
#define		FT_DMCSB2		2
#define		FT_DM2			3

#define		A_CREATE		1
#define		A_EXPAND		2

#define		E_LITTLE		0
#define		E_BIG			1

typedef struct BITMAP_HEADER_TAG
{
	BITMAPFILEHEADER bitmapfileheader;  // this contains the bitmapfile header
	BITMAPINFOHEADER bitmapinfoheader;  // this is all the info including the palette

} BITMAP_HEADER;

typedef struct gfxcolor_t {
	unsigned char	red;
	unsigned char	green;
	unsigned char	blue;
	unsigned char	flags;
} gfxcolor;

typedef struct map_t {
	char			num[5];
	char			type[5];
	char			info[5];
	char			*name1;
	char			*name2;
	char			*comments;
} dmmap;

extern	unsigned char	LZWInput[1024*32]; // 32k
extern	int				LZWInputLen;
extern	unsigned char	LZWOutput[1024*32]; // 32k
extern	int				LZWOutputLoc;

extern	FILE			*infile;
extern	BITMAP_HEADER	bmpheader;

extern	char	inputfile[256];
extern	char	outputdir[256];
extern	dmmap	*maps;
extern	int		numitems;
extern	int		*gfxsizes;
extern	int		*gfxsizesexp;
extern	short	*gfxwidtharray;
extern	short	*gfxheightarray;
extern	bool	endian;
extern	byte	action;

extern	byte	gfxbuf[1024*128];
extern	byte	gfxbuf4bit[1024*128*4];
extern	byte	gfxbufbmp[1024*128];
extern	byte	gfxcolors[6];

extern	byte	gfxtype;
extern	int		gfxnum;

extern	int		gfxbuf4bitloc;
extern	int		gfxwidth;
extern	int		gfxheight;


void hex_display(unsigned char *hex, int len);
void hex4bit_display(unsigned char *hex, int len);
short swap16(short i16);
int swap32(int i32);
char *get_attribute(char *str, int num);
char *read_string(FILE *fp);

int readfile();
int writefile();
int getrepeatcount();
int decode_graphic12();
int decode_graphic34();
int decode_font();
void writesound();
void writegraphic();
void writeunknown();
void writetext();
bool readgraphic();
void build_bitmap_header(int pixeldepth, int width, int height);
void build_color(gfxcolor *c, unsigned char red, unsigned char green, unsigned char blue);

void read_nextfile();
int decode_bmpheader();
void encode_text();
void reverse_depad_pixels();
void encode_graphic2();
void encode_graphic1();
void encode_font();

int LZWDecompress();
int	LZWGetCode();
int LZWGetString(const char *str, int len);
void LZWOutputCode(int code);
void LZWOutputString(char *str, int len);
void LZWAddString(const char *str, int len);