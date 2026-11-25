# Perfect numbers in Perl: numbers equal to the sum of their divisors

use strict;
use warnings;

sub is_perfect {
    my ($number) = @_;
    my $sum = 1;
    my $divisor = 2;
    while ($divisor * $divisor <= $number) {
        if ($number % $divisor == 0) {
            $sum += $divisor;
            if ($divisor * $divisor != $number) {
                $sum += int($number / $divisor);
            }
        }
        $divisor += 1;
    }
    return $number > 1 && $sum == $number;
}

for my $number (1 .. 10000) {
    if (is_perfect($number)) {
        print $number . "\n";
    }
}
