// Loops/Foreach in Pascal: print every element of a collection

program Main;

var
    Numbers: array of Int64;
    Index: Int64;
    Number: Int64;

begin
    Numbers := [1, 1, 2, 3, 5, 8, 13, 21];
    for Index := 0 to Length(Numbers) - 1 do
    begin
        Number := Numbers[Index];
        WriteLn(Number);
    end;
end.
