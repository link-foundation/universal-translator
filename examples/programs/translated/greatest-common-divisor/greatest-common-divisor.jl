# Greatest common divisor in Julia, using the Euclidean algorithm

function greatest_common_divisor(first, second)
    while second != 0
        remainder = first % second
        first = second
        second = remainder
    end
    return first
end

function main()
    println("The greatest common divisor of 1071 and 462 is $(greatest_common_divisor(1071, 462))")
end

main()
