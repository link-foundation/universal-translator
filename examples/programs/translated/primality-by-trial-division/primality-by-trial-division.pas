// Primality by trial division in Pascal

program Main;

function IsPrime(Number: Int64): Boolean;
var
    Divisor: Int64;
begin
    if Number < 2 then
    begin
        Exit(False);
    end;
    Divisor := 2;
    while Divisor * Divisor <= Number do
    begin
        if Number mod Divisor = 0 then
        begin
            Exit(False);
        end;
        Divisor := Divisor + 1;
    end;
    Exit(True);
end;

var
    Number: Int64;

begin
    for Number := 1 to 50 do
    begin
        if IsPrime(Number) then
        begin
            WriteLn(Number);
        end;
    end;
end.
