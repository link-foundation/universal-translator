// Ackermann function in GameMaker Language, defined recursively

function ackermann(first, second) {
    if (first == 0) {
        return second + 1;
    }
    if (second == 0) {
        return ackermann(first - 1, 1);
    }
    return ackermann(first - 1, ackermann(first, second - 1));
}

for (var first = 0; first < 4; first++) {
    for (var second = 0; second < 5; second++) {
        show_debug_message($"ackermann({first}, {second}) = {ackermann(first, second)}");
    }
}
