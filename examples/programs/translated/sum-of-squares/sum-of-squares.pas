// Sum of squares in Pascal

program Main;

function SumOfSquares(Limit: Int64): Int64;
var
    Total: Int64;
    Number: Int64;
begin
    Total := 0;
    Number := 1;
    while Number <= Limit do
    begin
        Total := Total + Number * Number;
        Number := Number + 1;
    end;
    Exit(Total);
end;

var
    Limit: Int64;

begin
    Limit := 10;
    WriteLn('Sum of squares from 1 to ', Limit, ':');
    WriteLn(SumOfSquares(Limit));
end.
