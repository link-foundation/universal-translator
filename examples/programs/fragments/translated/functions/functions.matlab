function result = sum_of_squares(limit)
    total = 0;
    for i = 1:limit
        total = total + square(i);
    end
    result = total;
    return;
end

function result = square(value)
    result = value * value;
    return;
end
