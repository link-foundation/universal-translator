# Bubble sort in Perl: sort a list of numbers

use strict;
use warnings;

my @numbers = (5, 3, 8, 1, 9, 2, 7);
my $count = scalar(@numbers);
for my $pass (0 .. $count - 1 - 1) {
    for my $index (0 .. $count - 1 - $pass - 1) {
        if ($numbers[$index] > $numbers[$index + 1]) {
            my $swap = $numbers[$index];
            $numbers[$index] = $numbers[$index + 1];
            $numbers[$index + 1] = $swap;
        }
    }
}
for my $position (0 .. $count - 1) {
    print($numbers[$position] . "\n");
}
