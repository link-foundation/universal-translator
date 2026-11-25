% Leap year in MATLAB/Octave

1;

function result = is_leap_year(year)
    result = (rem(year, 4) == 0 && rem(year, 100) ~= 0) || rem(year, 400) == 0;
    return;
end

for year = 1896:1912
    if is_leap_year(year)
        fprintf('%d is a leap year\n', year);
    else
        fprintf('%d is not a leap year\n', year);
    end
end
