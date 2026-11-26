// Greatest element of a list in Pascal

program Main;

var
    Numbers: array of Int64;
    Greatest: Int64;
    Index: Int64;
    Number: Int64;

begin
    Numbers := [17, 4, 93, 28, 65, 3, 80];
    Greatest := Numbers[0];
    for Index := 0 to Length(Numbers) - 1 do
    begin
        Number := Numbers[Index];
        if Number > Greatest then
        begin
            Greatest := Number;
        end;
    end;
    WriteLn('The greatest element is ', Greatest);
end.
