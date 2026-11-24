% Mutual recursion in MATLAB/Octave: the Hofstadter Female and Male sequences

1;

function result = female(index)
    if index == 0
        result = 1;
        return;
    end
    result = index - male(female(index - 1));
    return;
end

function result = male(index)
    if index == 0
        result = 0;
        return;
    end
    result = index - female(male(index - 1));
    return;
end

for index = 0:19
    fprintf('%d: %d %d\n', index, female(index), male(index));
end
