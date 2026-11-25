// Standard-output operations of the common library for Dart.
import 'dart:io';

void printLine(String text) => stdout.write('$text\n');

void writeText(String text) => stdout.write(text);

void writeInteger(int integer) => stdout.write(integer);

void endLine() => stdout.write('\n');
