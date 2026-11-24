// FizzBuzz in Pascal

program Main;

var
    Number: Int64;

begin
    for Number := 1 to 100 do
    begin
        if Number mod 15 = 0 then
        begin
            WriteLn('FizzBuzz');
        end
        else if Number mod 3 = 0 then
        begin
            WriteLn('Fizz');
        end
        else if Number mod 5 = 0 then
        begin
            WriteLn('Buzz');
        end
        else
        begin
            WriteLn(Number);
        end;
    end;
end.
