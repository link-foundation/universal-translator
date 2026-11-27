# 99 bottles of beer in Perl

use strict;
use warnings;

my $bottles = 99;
while ($bottles > 0) {
    print($bottles . " bottles of beer on the wall, " . $bottles . " bottles of beer.\n");
    print("Take one down and pass it around, " . ($bottles - 1) . " bottles of beer on the wall.\n");
    $bottles -= 1;
}
