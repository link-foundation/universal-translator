#include <iostream>
#include <string_view>

std::string_view factory(int size = 3);
const std::string_view message("ready)");

int main() {
    using std::string_view;
    string_view suffix(message.substr(1));
    std::string_view escaped("\x61");
    int count(2);
    std::cout << suffix << escaped << ' ' << count << '\n';
    return 0;
}
