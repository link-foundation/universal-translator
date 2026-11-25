% Sieve of Eratosthenes in MATLAB/Octave: the primes up to 100

1;

limit = 100;
is_prime = repmat(1, 1, limit + 1);
is_prime(1) = 0;
is_prime(2) = 0;
for number = 2:limit
    if is_prime(number + 1) == 1
        fprintf('%d\n', number);
        multiple = number * number;
        while multiple <= limit
            is_prime(multiple + 1) = 0;
            multiple = multiple + number;
        end
    end
end
