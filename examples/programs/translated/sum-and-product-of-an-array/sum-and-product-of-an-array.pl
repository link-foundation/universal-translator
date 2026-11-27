# Sum and product of an array in Perl

use strict;
use warnings;

my @numbers = (1, 2, 3, 4, 5);
my $total = 0;
my $product = 1;
for my $index (0 .. scalar(@numbers) - 1) {
    $total += $numbers[$index];
    $product *= $numbers[$index];
}
print("Sum: " . $total . "\n");
print("Product: " . $product . "\n");
