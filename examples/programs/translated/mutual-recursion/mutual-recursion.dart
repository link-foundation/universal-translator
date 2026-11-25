// Mutual recursion in Dart: the Hofstadter Female and Male sequences

int female(int index) {
    if (index == 0) {
        return 1;
    }
    return index - male(female(index - 1));
}

int male(int index) {
    if (index == 0) {
        return 0;
    }
    return index - female(male(index - 1));
}

void main() {
    for (var index = 0; index < 20; index++) {
        print("${index}: ${female(index)} ${male(index)}");
    }
}
