% Towers of Hanoi in MATLAB/Octave, solved recursively

1;

function move_disks(count, source_, target, spare)
    if count == 0
        return;
    end
    move_disks(count - 1, source_, spare, target);
    fprintf('Move disk %d from %d to %d\n', count, source_, target);
    move_disks(count - 1, spare, target, source_);
end

move_disks(4, 1, 3, 2);
