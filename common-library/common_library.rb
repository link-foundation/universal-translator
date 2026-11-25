# Standard-output operations of the common library for Ruby.

def print_line(text)
  $stdout.write("#{text}\n")
end

def write_text(text)
  $stdout.write(text)
end

def write_integer(integer)
  $stdout.write(integer.to_s)
end

def end_line
  $stdout.write("\n")
end
