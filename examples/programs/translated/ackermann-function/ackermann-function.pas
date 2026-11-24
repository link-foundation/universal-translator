// Ackermann procedure in Pascal, defined recursively

program Main;

function Ackermann(First: Int64; Second: Int64): Int64;
begin
    if First = 0 then
    begin
        Exit(Second + 1);
    end;
    if Second = 0 then
    begin
        Exit(Ackermann(First - 1, 1));
    end;
    Exit(Ackermann(First - 1, Ackermann(First, Second - 1)));
end;

var
    First: Int64;
    Second: Int64;

begin
    for First := 0 to 3 do
    begin
        for Second := 0 to 4 do
        begin
            WriteLn('ackermann(', First, ', ', Second, ') = ', Ackermann(First, Second));
        end;
    end;
end.
