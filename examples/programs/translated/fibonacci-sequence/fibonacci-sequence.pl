# Fibonacci sequence in Perl, computed iteratively

use strict;
use warnings;

sub fibonacci {
    my ($count) = @_;
    my $previous = 0;
    my $current = 1;
    for my $step (0 .. $count - 1) {
        my $next_ = $previous + $current;
        $previous = $current;
        $current = $next_;
    }
    return $previous;
}

for my $index (0 .. 20) {
    print("fibonacci(" . $index . ") = " . fibonacci($index) . "\n");
}
