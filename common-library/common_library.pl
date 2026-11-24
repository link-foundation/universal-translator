# Standard-output operations of the common library for Perl.
use strict;
use warnings;

sub print_line { my ($text) = @_; print "$text\n"; }

sub write_text { my ($text) = @_; print $text; }

sub write_integer { my ($integer) = @_; print $integer; }

sub end_line { print "\n"; }

1;
