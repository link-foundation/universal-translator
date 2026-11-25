% Sum of squares in MATLAB/Octave

1;

function result = sum_of_squares(limit)
    total = 0;
    number = 1;
    while number <= limit
        total = total + number * number;
        number = number + 1;
    end
    result = total;
    return;
end

limit = 10;
fprintf('Sum of squares from 1 to %d:\n', limit);
fprintf('%d\n', sum_of_squares(limit));
