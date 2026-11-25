// Standard-output operations of the common library for C++.
#pragma once

#include <iostream>
#include <string>

inline void print_line(const std::string &text) { std::cout << text << "\n"; }

inline void write_text(const std::string &text) { std::cout << text; }

inline void write_integer(long long integer) { std::cout << integer; }

inline void end_line() { std::cout << "\n"; }
