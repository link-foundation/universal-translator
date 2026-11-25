# FizzBuzz in Perl, the way a Perl programmer would write it

use strict;
use warnings;

for my $number (1 .. 100) {
    if ($number % 15 == 0) {
        print "FizzBuzz\n";
    } elsif ($number % 3 == 0) {
        print "Fizz\n";
    } elsif ($number % 5 == 0) {
        print "Buzz\n";
    } else {
        print "$number\n";
    }
}
