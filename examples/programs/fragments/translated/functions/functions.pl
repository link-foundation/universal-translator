sub sum_of_squares {
    my ($limit) = @_;
    my $total = 0;
    for my $i (1 .. $limit) {
        $total += square($i);
    }
    return $total;
}

sub square {
    my ($value) = @_;
    return $value * $value;
}
