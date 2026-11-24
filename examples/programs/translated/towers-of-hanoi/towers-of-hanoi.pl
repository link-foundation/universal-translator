# Towers of Hanoi in Perl, solved recursively

use strict;
use warnings;

sub move_disks {
    my ($count, $source, $target, $spare) = @_;
    if ($count == 0) {
        return;
    }
    move_disks($count - 1, $source, $spare, $target);
    print "Move disk " . $count . " from " . $source . " to " . $target . "\n";
    move_disks($count - 1, $spare, $target, $source);
}

move_disks(4, 1, 3, 2);
