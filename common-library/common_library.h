/* Standard-output operations of the common library for C. */
#ifndef COMMON_LIBRARY_H
#define COMMON_LIBRARY_H

#include <stdio.h>

static inline void print_line(const char *text) { printf("%s\n", text); }

static inline void write_text(const char *text) { printf("%s", text); }

static inline void write_integer(long long integer) { printf("%lld", integer); }

static inline void end_line(void) { printf("\n"); }

#endif
