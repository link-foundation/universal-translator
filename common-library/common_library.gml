// Standard-output operations of the common library for GameMaker Language.
// show_debug_message always ends the line, so text waits in a buffer until
// the line ends.
global.common_library_line = "";

function print_line(text) {
  show_debug_message(global.common_library_line + text);
  global.common_library_line = "";
}

function write_text(text) {
  global.common_library_line += text;
}

function write_integer(integer) {
  global.common_library_line += string(integer);
}

function end_line() {
  show_debug_message(global.common_library_line);
  global.common_library_line = "";
}
