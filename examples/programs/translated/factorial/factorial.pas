// Factorial in Pascal, defined recursively

program Main;

function Factorial(Number: Int64): Int64;
begin
    if Number <= 1 then
    begin
        Exit(1);
    end;
    Exit(Number * Factorial(Number - 1));
end;

var
    Number: Int64;

begin
    for Number := 0 to 10 do
    begin
        WriteLn(Number, '! = ', Factorial(Number));
    end;
end.
