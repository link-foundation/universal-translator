// 99 bottles of beer in Pascal

program Main;

var
    Bottles: Int64;

begin
    Bottles := 99;
    while Bottles > 0 do
    begin
        WriteLn(Bottles, ' bottles of beer on the wall, ', Bottles, ' bottles of beer.');
        WriteLn('Take one down and pass it around, ', Bottles - 1, ' bottles of beer on the wall.');
        Bottles := Bottles - 1;
    end;
end.
