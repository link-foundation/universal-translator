// Primality by trial division in GameMaker Language

function is_prime(number) {
    if (number < 2) {
        return false;
    }
    var divisor = 2;
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            return false;
        }
        divisor += 1;
    }
    return true;
}

for (var number = 1; number < 51; number++) {
    if (is_prime(number)) {
        show_debug_message(number);
    }
}
