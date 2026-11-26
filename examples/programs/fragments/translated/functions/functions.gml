function sum_of_squares(limit) {
    var total = 0;
    for (var i = 1; i < limit + 1; i++) {
        total += square(i);
    }
    return total;
}

function square(value) {
    return value * value;
}
