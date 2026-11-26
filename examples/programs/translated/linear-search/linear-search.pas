// Linear search in Pascal: find the position of a value in a list

program Main;

var
    Numbers: array of Int64;
    Wanted: Int64;
    Position: Int64;
    Current: Int64;
    Index: Int64;
    Number: Int64;

begin
    Numbers := [31, 41, 59, 26, 53, 58, 97, 93];
    Wanted := 53;
    Position := -1;
    Current := 0;
    for Index := 0 to Length(Numbers) - 1 do
    begin
        Number := Numbers[Index];
        if (Number = Wanted) and (Position < 0) then
        begin
            Position := Current;
        end;
        Current := Current + 1;
    end;
    WriteLn('Found ', Wanted, ' at position ', Position);
end.
