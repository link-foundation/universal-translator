# Ackermann subroutine in Perl, defined recursively

use strict;
use warnings;

sub ackermann {
    my ($first, $second) = @_;
    if ($first == 0) {
        return $second + 1;
    }
    if ($second == 0) {
        return ackermann($first - 1, 1);
    }
    return ackermann($first - 1, ackermann($first, $second - 1));
}

for my $first (0 .. 3) {
    for my $second (0 .. 4) {
        print("ackermann(" . $first . ", " . $second . ") = " . ackermann($first, $second) . "\n");
    }
}
