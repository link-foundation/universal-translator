/* Standard-output operations of the common library for Objective-C. */
#import <stdio.h>

static inline void printLine(const char *text) { printf("%s\n", text); }

static inline void writeText(const char *text) { printf("%s", text); }

static inline void writeInteger(long long integer) { printf("%lld", integer); }

static inline void endLine(void) { printf("\n"); }
