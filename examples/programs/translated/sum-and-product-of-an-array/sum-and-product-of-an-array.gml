// Sum and product of an array in GameMaker Language

var numbers = [1, 2, 3, 4, 5];
var total = 0;
var product = 1;
for (var index = 0; index < array_length(numbers); index++) {
    total += numbers[index];
    product *= numbers[index];
}
show_debug_message($"Sum: {total}");
show_debug_message($"Product: {product}");
