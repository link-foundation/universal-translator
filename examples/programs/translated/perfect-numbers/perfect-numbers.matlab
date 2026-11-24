% Perfect numbers in MATLAB/Octave: numbers equal to the sum of their divisors

1;

function result = is_perfect(number)
    sum = 1;
    divisor = 2;
    while divisor * divisor <= number
        if rem(number, divisor) == 0
            sum = sum + divisor;
            if divisor * divisor ~= number
                sum = sum + fix(number / divisor);
            end
        end
        divisor = divisor + 1;
    end
    result = number > 1 && sum == number;
    return;
end

for number = 1:10000
    if is_perfect(number)
        fprintf('%d\n', number);
    end
end
