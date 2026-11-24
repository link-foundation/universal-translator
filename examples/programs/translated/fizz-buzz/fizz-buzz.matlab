% FizzBuzz in MATLAB/Octave

1;

for number = 1:100
    if rem(number, 15) == 0
        fprintf('FizzBuzz\n');
    elseif rem(number, 3) == 0
        fprintf('Fizz\n');
    elseif rem(number, 5) == 0
        fprintf('Buzz\n');
    else
        fprintf('%d\n', number);
    end
end
