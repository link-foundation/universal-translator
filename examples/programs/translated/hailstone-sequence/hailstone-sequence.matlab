% Hailstone sequence in MATLAB/Octave: count the steps to reach 1

1;

function result = hailstone_steps(number)
    steps = 0;
    while number ~= 1
        if rem(number, 2) == 0
            number = fix(number / 2);
        else
            number = 3 * number + 1;
        end
        steps = steps + 1;
    end
    result = steps;
    return;
end

for number = 1:10
    fprintf('%d takes %d steps\n', number, hailstone_steps(number));
end
