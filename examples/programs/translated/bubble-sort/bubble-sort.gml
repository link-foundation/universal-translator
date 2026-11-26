// Bubble sort in GameMaker Language: sort a list of numbers

var numbers = [5, 3, 8, 1, 9, 2, 7];
var count = array_length(numbers);
for (var pass = 0; pass < count - 1; pass++) {
    for (var index = 0; index < count - 1 - pass; index++) {
        if (numbers[index] > numbers[index + 1]) {
            var swap = numbers[index];
            numbers[index] = numbers[index + 1];
            numbers[index + 1] = swap;
        }
    }
}
for (var position = 0; position < count; position++) {
    show_debug_message(numbers[position]);
}
