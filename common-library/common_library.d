// Standard-output operations of the common library for D.
module common_library;

import std.stdio;

void printLine(string text) { writeln(text); }

void writeText(string text) { write(text); }

void writeInteger(long integer) { write(integer); }

void endLine() { writeln(); }
