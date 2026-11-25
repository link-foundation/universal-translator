// Perfect numbers in Pascal: numbers equal to the sum of their divisors

program Main;

function IsPerfect(Number: Int64): Boolean;
var
    Sum: Int64;
    Divisor: Int64;
begin
    Sum := 1;
    Divisor := 2;
    while Divisor * Divisor <= Number do
    begin
        if Number mod Divisor = 0 then
        begin
            Sum := Sum + Divisor;
            if Divisor * Divisor <> Number then
            begin
                Sum := Sum + Number div Divisor;
            end;
        end;
        Divisor := Divisor + 1;
    end;
    Exit((Number > 1) and (Sum = Number));
end;

var
    Number: Int64;

begin
    for Number := 1 to 10000 do
    begin
        if IsPerfect(Number) then
        begin
            WriteLn(Number);
        end;
    end;
end.
