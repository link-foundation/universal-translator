// Bubble sort in Dart: sort a list of numbers

void main() {
    final numbers = [5, 3, 8, 1, 9, 2, 7];
    final count = numbers.length;
    for (var pass = 0; pass < count - 1; pass++) {
        for (var index = 0; index < count - 1 - pass; index++) {
            if (numbers[index] > numbers[index + 1]) {
                final swap = numbers[index];
                numbers[index] = numbers[index + 1];
                numbers[index + 1] = swap;
            }
        }
    }
    for (var position = 0; position < count; position++) {
        print(numbers[position]);
    }
}
