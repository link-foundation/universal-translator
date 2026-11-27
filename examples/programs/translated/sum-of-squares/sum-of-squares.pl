# Sum of squares in Perl

use strict;
use warnings;

sub sum_of_squares {
    my ($limit) = @_;
    my $total = 0;
    my $number = 1;
    while ($number <= $limit) {
        $total += $number * $number;
        $number += 1;
    }
    return $total;
}

my $limit = 10;
print("Sum of squares from 1 to " . $limit . ":\n");
print(sum_of_squares($limit) . "\n");
