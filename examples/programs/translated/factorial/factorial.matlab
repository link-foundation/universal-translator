% Factorial in MATLAB/Octave, defined recursively

1;

function result = factorial(number)
    if number <= 1
        result = 1;
        return;
    end
    result = number * factorial(number - 1);
    return;
end

for number = 0:10
    fprintf('%d! = %d\n', number, factorial(number));
end
