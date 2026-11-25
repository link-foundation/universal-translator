% Fibonacci sequence in MATLAB/Octave, computed iteratively

1;

function result = fibonacci(count)
    previous = 0;
    current = 1;
    for step = 0:count - 1
        next = previous + current;
        previous = current;
        current = next;
    end
    result = previous;
    return;
end

for index = 0:20
    fprintf('fibonacci(%d) = %d\n', index, fibonacci(index));
end
