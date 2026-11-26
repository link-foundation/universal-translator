% Linear search in MATLAB/Octave: find the position of a value in a list

1;

numbers = [31, 41, 59, 26, 53, 58, 97, 93];
wanted = 53;
position = -1;
current = 0;
for index = 0:numel(numbers) - 1
    number = numbers(index + 1);
    if number == wanted && position < 0
        position = current;
    end
    current = current + 1;
end
fprintf('Found %d at position %d\n', wanted, position);
