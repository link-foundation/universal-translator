# Greatest common divisor in Ruby, using the Euclidean algorithm

def greatest_common_divisor(first, second)
    while second != 0
        remainder = first % second
        first = second
        second = remainder
    end
    return first
end

puts "The greatest common divisor of 1071 and 462 is #{greatest_common_divisor(1071, 462)}"
