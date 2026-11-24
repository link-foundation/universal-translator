// 99 bottles of beer in D

import std.stdio;

void main() {
    long bottles = 99;
    while (bottles > 0) {
        writeln(bottles, " bottles of beer on the wall, ", bottles, " bottles of beer.");
        writeln("Take one down and pass it around, ", bottles - 1, " bottles of beer on the wall.");
        bottles -= 1;
    }
}
