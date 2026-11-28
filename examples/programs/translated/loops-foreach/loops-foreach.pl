# Loops/Foreach in Perl: print every element of a collection

use strict;
use warnings;

my @numbers = (1, 1, 2, 3, 5, 8, 13, 21);
for my $number (@numbers) {
    print($number . "\n");
}
