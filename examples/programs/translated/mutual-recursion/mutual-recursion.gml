// Mutual recursion in GameMaker Language: the Hofstadter Female and Male sequences

function female(index) {
    if (index == 0) {
        return 1;
    }
    return index - male(female(index - 1));
}

function male(index) {
    if (index == 0) {
        return 0;
    }
    return index - female(male(index - 1));
}

for (var index = 0; index < 20; index++) {
    show_debug_message($"{index}: {female(index)} {male(index)}");
}
