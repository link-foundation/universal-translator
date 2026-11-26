% Greatest element of a list in MATLAB/Octave

1;

numbers = [17, 4, 93, 28, 65, 3, 80];
greatest = numbers(1);
for index = 0:numel(numbers) - 1
    number = numbers(index + 1);
    if number > greatest
        greatest = number;
    end
end
fprintf('The greatest element is %d\n', greatest);
