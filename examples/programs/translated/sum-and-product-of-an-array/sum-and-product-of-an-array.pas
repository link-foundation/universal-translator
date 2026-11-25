// Sum and product of an array in Pascal

program Main;

var
    Numbers: array of Int64;
    Total: Int64;
    Product: Int64;
    Index: Int64;

begin
    Numbers := [1, 2, 3, 4, 5];
    Total := 0;
    Product := 1;
    for Index := 0 to Length(Numbers) - 1 do
    begin
        Total := Total + Numbers[Index];
        Product := Product * Numbers[Index];
    end;
    WriteLn('Sum: ', Total);
    WriteLn('Product: ', Product);
end.
