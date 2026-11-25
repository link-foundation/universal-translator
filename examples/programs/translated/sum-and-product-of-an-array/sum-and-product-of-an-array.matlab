% Sum and product of an array in MATLAB/Octave

1;

numbers = [1, 2, 3, 4, 5];
total = 0;
product = 1;
for index = 0:numel(numbers) - 1
    total = total + numbers(index + 1);
    product = product * numbers(index + 1);
end
fprintf('Sum: %d\n', total);
fprintf('Product: %d\n', product);
