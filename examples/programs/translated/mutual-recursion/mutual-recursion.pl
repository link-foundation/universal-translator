# Mutual recursion in Perl: the Hofstadter Female and Male sequences

use strict;
use warnings;

sub female {
    my ($index) = @_;
    if ($index == 0) {
        return 1;
    }
    return $index - male(female($index - 1));
}

sub male {
    my ($index) = @_;
    if ($index == 0) {
        return 0;
    }
    return $index - female(male($index - 1));
}

for my $index (0 .. 19) {
    print($index . ": " . female($index) . " " . male($index) . "\n");
}
