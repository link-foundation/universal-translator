// Linear search in GameMaker Language: find the position of a value in a list

var numbers = [31, 41, 59, 26, 53, 58, 97, 93];
var wanted = 53;
var position = -1;
var current = 0;
for (var index = 0; index < array_length(numbers); index++) {
    var number = numbers[index];
    if (number == wanted && position < 0) {
        position = current;
    }
    current += 1;
}
show_debug_message($"Found {wanted} at position {position}");
