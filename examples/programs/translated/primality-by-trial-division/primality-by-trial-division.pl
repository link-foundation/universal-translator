# Primality by trial division in Perl

use strict;
use warnings;

sub ut_integer_remainder {
    my ($first, $second) = @_;
    my $quotient = int($first / $second);
    return $first - $quotient * $second;
}

sub is_prime {
    my ($number) = @_;
    if ($number < 2) {
        return 0;
    }
    my $divisor = 2;
    while ($divisor * $divisor <= $number) {
        if (ut_integer_remainder($number, $divisor) == 0) {
            return 0;
        }
        $divisor += 1;
    }
    return 1;
}

for my $number (1 .. 50) {
    if (is_prime($number)) {
        print($number . "\n");
    }
}
