# Ackermann method in Ruby, defined recursively

def ackermann(first, second)
    if first == 0
        return second + 1
    end
    if second == 0
        return ackermann(first - 1, 1)
    end
    return ackermann(first - 1, ackermann(first, second - 1))
end

for first in 0...4
    for second in 0...5
        puts "ackermann(#{first}, #{second}) = #{ackermann(first, second)}"
    end
end
