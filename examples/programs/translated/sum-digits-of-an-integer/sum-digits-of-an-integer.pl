# Sum digits of an integer in Perl

use strict;
use warnings;

sub sum_of_digits {
    my ($number) = @_;
    my $total = 0;
    while ($number > 0) {
        $total += $number % 10;
        $number = int($number / 10);
    }
    return $total;
}

print "The digits of 1234567890 sum to " . sum_of_digits(1234567890) . "\n";
