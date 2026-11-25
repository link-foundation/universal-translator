% Sum digits of an integer in MATLAB/Octave

1;

function result = sum_of_digits(number)
    total = 0;
    while number > 0
        total = total + rem(number, 10);
        number = fix(number / 10);
    end
    result = total;
    return;
end

fprintf('The digits of 1234567890 sum to %d\n', sum_of_digits(1234567890));
