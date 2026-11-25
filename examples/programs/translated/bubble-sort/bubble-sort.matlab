% Bubble sort in MATLAB/Octave: sort a list of numbers

1;

numbers = [5, 3, 8, 1, 9, 2, 7];
count = numel(numbers);
for pass = 0:count - 1 - 1
    for index = 0:count - 1 - pass - 1
        if numbers(index + 1) > numbers(index + 2)
            swap = numbers(index + 1);
            numbers(index + 1) = numbers(index + 2);
            numbers(index + 2) = swap;
        end
    end
end
for position = 0:count - 1
    fprintf('%d\n', numbers(position + 1));
end
