// Leap year in Pascal

program Main;

function IsLeapYear(Year: Int64): Boolean;
begin
    Exit(((Year mod 4 = 0) and (Year mod 100 <> 0)) or (Year mod 400 = 0));
end;

var
    Year: Int64;

begin
    for Year := 1896 to 1912 do
    begin
        if IsLeapYear(Year) then
        begin
            WriteLn(Year, ' is a leap year');
        end
        else
        begin
            WriteLn(Year, ' is not a leap year');
        end;
    end;
end.
