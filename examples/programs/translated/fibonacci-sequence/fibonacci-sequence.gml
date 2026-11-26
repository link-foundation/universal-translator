// Fibonacci sequence in GameMaker Language, computed iteratively

function fibonacci(count) {
    var previous = 0;
    var current = 1;
    for (var step = 0; step < count; step++) {
        var next = previous + current;
        previous = current;
        current = next;
    }
    return previous;
}

for (var index = 0; index < 21; index++) {
    show_debug_message($"fibonacci({index}) = {fibonacci(index)}");
}
