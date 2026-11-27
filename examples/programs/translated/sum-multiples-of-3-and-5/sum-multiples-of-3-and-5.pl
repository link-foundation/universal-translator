# Sum multiples of 3 and 5 in Perl: the sum of the multiples below 1000

use strict;
use warnings;

sub ut_integer_remainder {
    my ($first, $second) = @_;
    my $result = int($first / $second);
    return $first - $result * $second;
}

my $total = 0;
for my $number (1 .. 999) {
    if (ut_integer_remainder($number, 3) == 0 || ut_integer_remainder($number, 5) == 0) {
        $total += $number;
    }
}
print($total . "\n");
