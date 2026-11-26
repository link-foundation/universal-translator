% Sum multiples of 3 and 5 in MATLAB/Octave: the sum of the multiples below 1000

1;

total = 0;
for number = 1:999
    if rem(number, 3) == 0 || rem(number, 5) == 0
        total = total + number;
    end
end
fprintf('%d\n', total);
