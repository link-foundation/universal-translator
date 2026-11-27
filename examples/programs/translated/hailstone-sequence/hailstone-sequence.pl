# Hailstone sequence in Perl: count the steps to reach 1

use strict;
use warnings;

sub ut_integer_remainder {
    my ($first, $second) = @_;
    my $quotient = int($first / $second);
    return $first - $quotient * $second;
}

sub hailstone_steps {
    my ($number) = @_;
    my $steps = 0;
    while ($number != 1) {
        if (ut_integer_remainder($number, 2) == 0) {
            $number = int($number / 2);
        } else {
            $number = 3 * $number + 1;
        }
        $steps += 1;
    }
    return $steps;
}

for my $number (1 .. 10) {
    print($number . " takes " . hailstone_steps($number) . " steps\n");
}
