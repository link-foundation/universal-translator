// Loops/Foreach in GameMaker Language: print every element of a collection

var numbers = [1, 1, 2, 3, 5, 8, 13, 21];
for (var index = 0; index < array_length(numbers); index++) {
    var number = numbers[index];
    show_debug_message(number);
}
