-- Standard-output operations of the common library for Lua.
local common_library = {}

function common_library.print_line(text)
  io.write(text, "\n")
end

function common_library.write_text(text)
  io.write(text)
end

function common_library.write_integer(integer)
  io.write(string.format("%d", integer))
end

function common_library.end_line()
  io.write("\n")
end

return common_library
