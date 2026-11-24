% Ackermann function in MATLAB/Octave, defined recursively

1;

function result = ackermann(first, second)
    if first == 0
        result = second + 1;
        return;
    end
    if second == 0
        result = ackermann(first - 1, 1);
        return;
    end
    result = ackermann(first - 1, ackermann(first, second - 1));
    return;
end

for first = 0:3
    for second = 0:4
        fprintf('ackermann(%d, %d) = %d\n', first, second, ackermann(first, second));
    end
end
