% Greatest common divisor in MATLAB/Octave, using the Euclidean algorithm

1;

function result = greatest_common_divisor(first, second)
    while second ~= 0
        remainder = rem(first, second);
        first = second;
        second = remainder;
    end
    result = first;
    return;
end

fprintf('The greatest common divisor of 1071 and 462 is %d\n', greatest_common_divisor(1071, 462));
