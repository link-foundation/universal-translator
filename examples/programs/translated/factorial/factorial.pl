# Factorial in Perl, defined recursively

use strict;
use warnings;

sub factorial {
    my ($number) = @_;
    if ($number <= 1) {
        return 1;
    }
    return $number * factorial($number - 1);
}

for my $number (0 .. 10) {
    print($number . "! = " . factorial($number) . "\n");
}
