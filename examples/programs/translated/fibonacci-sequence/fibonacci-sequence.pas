// Fibonacci sequence in Pascal, computed iteratively

program Main;

function Fibonacci(Count: Int64): Int64;
var
    Previous: Int64;
    Current: Int64;
    Step: Int64;
    Next: Int64;
begin
    Previous := 0;
    Current := 1;
    for Step := 0 to Count - 1 do
    begin
        Next := Previous + Current;
        Previous := Current;
        Current := Next;
    end;
    Exit(Previous);
end;

var
    Index: Int64;

begin
    for Index := 0 to 20 do
    begin
        WriteLn('fibonacci(', Index, ') = ', Fibonacci(Index));
    end;
end.
