# Sum multiples of 3 and 5 in Perl: the sum of the multiples below 1000

use strict;
use warnings;

my $total = 0;
for my $number (1 .. 999) {
    if ($number % 3 == 0 || $number % 5 == 0) {
        $total += $number;
    }
}
print $total . "\n";
