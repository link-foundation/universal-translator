// Sum digits of an integer in Pascal

program Main;

function SumOfDigits(Number: Int64): Int64;
var
    Total: Int64;
begin
    Total := 0;
    while Number > 0 do
    begin
        Total := Total + Number mod 10;
        Number := Number div 10;
    end;
    Exit(Total);
end;

begin
    WriteLn('The digits of 1234567890 sum to ', SumOfDigits(1234567890));
end.
