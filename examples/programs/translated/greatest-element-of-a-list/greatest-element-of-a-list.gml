// Greatest element of a list in GameMaker Language

var numbers = [17, 4, 93, 28, 65, 3, 80];
var greatest = numbers[0];
for (var index = 0; index < array_length(numbers); index++) {
    var number = numbers[index];
    if (number > greatest) {
        greatest = number;
    }
}
show_debug_message($"The greatest element is {greatest}");
