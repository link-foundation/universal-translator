# Standard-output operations of the common library for Julia.

print_line(text) = print(text, "\n")

write_text(text) = print(text)

write_integer(integer) = print(integer)

end_line() = print("\n")
