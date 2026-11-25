% Primality by trial division in MATLAB/Octave

1;

function result = is_prime(number)
    if number < 2
        result = false;
        return;
    end
    divisor = 2;
    while divisor * divisor <= number
        if rem(number, divisor) == 0
            result = false;
            return;
        end
        divisor = divisor + 1;
    end
    result = true;
    return;
end

for number = 1:50
    if is_prime(number)
        fprintf('%d\n', number);
    end
end
