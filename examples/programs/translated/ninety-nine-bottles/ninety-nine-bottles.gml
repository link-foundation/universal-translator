// 99 bottles of beer in GameMaker Language

var bottles = 99;
while (bottles > 0) {
    show_debug_message($"{bottles} bottles of beer on the wall, {bottles} bottles of beer.");
    show_debug_message($"Take one down and pass it around, {bottles - 1} bottles of beer on the wall.");
    bottles -= 1;
}
