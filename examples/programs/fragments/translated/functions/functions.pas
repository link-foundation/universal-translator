function Square(Value: Int64): Int64; forward;

function SumOfSquares(Limit: Int64): Int64;
var
    Total: Int64;
    I: Int64;
begin
    Total := 0;
    for I := 1 to Limit do
    begin
        Total := Total + Square(I);
    end;
    Exit(Total);
end;

function Square(Value: Int64): Int64;
begin
    Exit(Value * Value);
end;
