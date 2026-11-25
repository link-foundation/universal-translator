// Sum and product of an array in Dart

void main() {
    final numbers = [1, 2, 3, 4, 5];
    var total = 0;
    var product = 1;
    for (var index = 0; index < numbers.length; index++) {
        total += numbers[index];
        product *= numbers[index];
    }
    print("Sum: ${total}");
    print("Product: ${product}");
}
