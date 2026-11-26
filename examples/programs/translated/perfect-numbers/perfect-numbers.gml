// Perfect numbers in GameMaker Language: numbers equal to the sum of their divisors

function is_perfect(number) {
    var sum = 1;
    var divisor = 2;
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            sum += divisor;
            if (divisor * divisor != number) {
                sum += number div divisor;
            }
        }
        divisor += 1;
    }
    return number > 1 && sum == number;
}

for (var number = 1; number < 10001; number++) {
    if (is_perfect(number)) {
        show_debug_message(number);
    }
}
