% Standard-output operations of the common library for MATLAB and Octave.
% A program loads them with source('common_library.m').

1;

function print_line(text)
    fprintf('%s\n', text);
end

function write_text(text)
    fprintf('%s', text);
end

function write_integer(integer)
    fprintf('%d', integer);
end

function end_line()
    fprintf('\n');
end
