// Greatest common divisor in GameMaker Language, using the Euclidean algorithm

function greatest_common_divisor(first, second) {
    while (second != 0) {
        var remainder = first % second;
        first = second;
        second = remainder;
    }
    return first;
}

show_debug_message($"The greatest common divisor of 1071 and 462 is {greatest_common_divisor(1071, 462)}");
