// Linear search in Dart: find the position of a value in a list

void main() {
    final numbers = [31, 41, 59, 26, 53, 58, 97, 93];
    final wanted = 53;
    var position = -1;
    var current = 0;
    for (final number in numbers) {
        if (number == wanted && position < 0) {
            position = current;
        }
        current += 1;
    }
    print("Found ${wanted} at position ${position}");
}
