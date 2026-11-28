# Greatest common divisor in Perl, using the Euclidean algorithm

use strict;
use warnings;

sub ut_integer_remainder {
    my ($first, $second) = @_;
    my $quotient = int($first / $second);
    return $first - $quotient * $second;
}

sub greatest_common_divisor {
    my ($first, $second) = @_;
    while ($second != 0) {
        my $remainder = ut_integer_remainder($first, $second);
        $first = $second;
        $second = $remainder;
    }
    return $first;
}

print("The greatest common divisor of 1071 and 462 is " . greatest_common_divisor(1071, 462) . "\n");
