# Greatest element of a list in Perl

use strict;
use warnings;

my @numbers = (17, 4, 93, 28, 65, 3, 80);
my $greatest = $numbers[0];
for my $number (@numbers) {
    if ($number > $greatest) {
        $greatest = $number;
    }
}
print "The greatest element is " . $greatest . "\n";
