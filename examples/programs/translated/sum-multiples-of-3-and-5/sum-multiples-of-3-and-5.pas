// Sum multiples of 3 and 5 in Pascal: the sum of the multiples below 1000

program Main;

var
    Total: Int64;
    Number: Int64;

begin
    Total := 0;
    for Number := 1 to 999 do
    begin
        if (Number mod 3 = 0) or (Number mod 5 = 0) then
        begin
            Total := Total + Number;
        end;
    end;
    WriteLn(Total);
end.
