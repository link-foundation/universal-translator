// Greatest element of a list in Dart

void main() {
    final numbers = [17, 4, 93, 28, 65, 3, 80];
    var greatest = numbers[0];
    for (final number in numbers) {
        if (number > greatest) {
            greatest = number;
        }
    }
    print("The greatest element is ${greatest}");
}
