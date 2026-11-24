% 99 bottles of beer in MATLAB/Octave

1;

bottles = 99;
while bottles > 0
    fprintf('%d bottles of beer on the wall, %d bottles of beer.\n', bottles, bottles);
    fprintf('Take one down and pass it around, %d bottles of beer on the wall.\n', bottles - 1);
    bottles = bottles - 1;
end
