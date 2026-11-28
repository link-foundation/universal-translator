#include <iostream>
#include <string>

using std::string;
int calls = 0;

int next() {
    calls = calls + 1;
    return calls;
}

int main() {
    string s = "水a";
    string::size_type length = s.length();
    string::size_type size = s.size();
    string::size_type bytes = length * sizeof(string::value_type);
    std::cout << length << " " << size << " " << bytes;
    std::cout << " " << (sizeof(next()) == sizeof(int)) << " " << calls << std::endl;
}
