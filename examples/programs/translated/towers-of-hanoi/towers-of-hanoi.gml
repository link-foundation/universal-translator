// Towers of Hanoi in GameMaker Language, solved recursively

function move_disks(count, source, target, spare) {
    if (count == 0) {
        return;
    }
    move_disks(count - 1, source, spare, target);
    show_debug_message($"Move disk {count} from {source} to {target}");
    move_disks(count - 1, spare, target, source);
}

move_disks(4, 1, 3, 2);
