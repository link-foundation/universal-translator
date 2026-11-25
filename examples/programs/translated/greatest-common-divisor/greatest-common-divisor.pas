// Greatest common divisor in Pascal, using the Euclidean algorithm

program Main;

function GreatestCommonDivisor(First: Int64; Second: Int64): Int64;
var
    Remainder: Int64;
begin
    while Second <> 0 do
    begin
        Remainder := First mod Second;
        First := Second;
        Second := Remainder;
    end;
    Exit(First);
end;

begin
    WriteLn('The greatest common divisor of 1071 and 462 is ', GreatestCommonDivisor(1071, 462));
end.
