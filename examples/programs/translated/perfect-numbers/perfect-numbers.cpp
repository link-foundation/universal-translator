// Perfect numbers in C++: numbers equal to the sum of their divisors

#include <iostream>

bool is_perfect(int number) {
    int sum = 1;
    int divisor = 2;
    while (divisor * divisor <= number) {
        if (number % divisor == 0) {
            sum += divisor;
            if (divisor * divisor != number) {
                sum += number / divisor;
            }
        }
        divisor += 1;
    }
    return number > 1 && sum == number;
}

int main() {
    for (int number = 1; number < 10001; number++) {
        if (is_perfect(number)) {
            std::cout << number << std::endl;
        }
    }
}
