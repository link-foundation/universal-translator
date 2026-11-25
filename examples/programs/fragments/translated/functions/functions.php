function sumOfSquares($limit) {
    $total = 0;
    for ($i = 1; $i < $limit + 1; $i++) {
        $total += square($i);
    }
    return $total;
}

function square($value) {
    return $value * $value;
}
