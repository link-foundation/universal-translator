// Bubble sort in Pascal: sort a list of numbers

program Main;

var
    Numbers: array of Int64;
    Count: Int64;
    Pass: Int64;
    Index: Int64;
    Swap: Int64;
    Position: Int64;

begin
    Numbers := [5, 3, 8, 1, 9, 2, 7];
    Count := Length(Numbers);
    for Pass := 0 to Count - 1 - 1 do
    begin
        for Index := 0 to Count - 1 - Pass - 1 do
        begin
            if Numbers[Index] > Numbers[Index + 1] then
            begin
                Swap := Numbers[Index];
                Numbers[Index] := Numbers[Index + 1];
                Numbers[Index + 1] := Swap;
            end;
        end;
    end;
    for Position := 0 to Count - 1 do
    begin
        WriteLn(Numbers[Position]);
    end;
end.
