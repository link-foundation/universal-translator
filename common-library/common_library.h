/* Standard-output operations of the common library for C. */
#ifndef COMMON_LIBRARY_H
#define COMMON_LIBRARY_H

#include <stdio.h>

static void print_line(const char *text) { printf("%s\n", text); }

static void write_text(const char *text) { printf("%s", text); }

static void write_integer(long long integer) { printf("%lld", integer); }

static void end_line(void) { printf("\n"); }

#endif
