# Linear search in Perl: find the position of a value in a list

use strict;
use warnings;

my @numbers = (31, 41, 59, 26, 53, 58, 97, 93);
my $wanted = 53;
my $position = -1;
my $current = 0;
for my $number (@numbers) {
    if ($number == $wanted && $position < 0) {
        $position = $current;
    }
    $current += 1;
}
print "Found " . $wanted . " at position " . $position . "\n";
