#include <iostream>
#include <string>

int contains(const std::string& text, const char* needle) {
    if (text.find(needle) != std::string::npos) {
        return 1;
    }
    return 0;
}

int main() {
    using namespace std;
    if (true) {
        using std::endl;
        cout << contains("universal", "versal") << endl;
    }
    return 0;
}
