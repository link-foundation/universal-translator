% Loops/Foreach in MATLAB/Octave: print every element of a collection

1;

numbers = [1, 1, 2, 3, 5, 8, 13, 21];
for index = 0:numel(numbers) - 1
    number = numbers(index + 1);
    fprintf('%d\n', number);
end
