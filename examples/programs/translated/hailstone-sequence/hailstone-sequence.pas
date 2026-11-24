// Hailstone sequence in Pascal: count the steps to reach 1

program Main;

function HailstoneSteps(Number: Int64): Int64;
var
    Steps: Int64;
begin
    Steps := 0;
    while Number <> 1 do
    begin
        if Number mod 2 = 0 then
        begin
            Number := Number div 2;
        end
        else
        begin
            Number := 3 * Number + 1;
        end;
        Steps := Steps + 1;
    end;
    Exit(Steps);
end;

var
    Number: Int64;

begin
    for Number := 1 to 10 do
    begin
        WriteLn(Number, ' takes ', HailstoneSteps(Number), ' steps');
    end;
end.
