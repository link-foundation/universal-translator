# Sieve of Eratosthenes in Perl: the primes up to 100

use strict;
use warnings;

my $limit = 100;
my @is_prime = (1) x ($limit + 1);
$is_prime[0] = 0;
$is_prime[1] = 0;
for my $number (2 .. $limit) {
    if ($is_prime[$number] == 1) {
        print($number . "\n");
        my $multiple = $number * $number;
        while ($multiple <= $limit) {
            $is_prime[$multiple] = 0;
            $multiple += $number;
        }
    }
}
