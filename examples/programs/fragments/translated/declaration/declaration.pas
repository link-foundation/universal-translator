var
    Total: Int64;
    I: Int64;

Total := 0;
for I := 0 to 9 do
begin
    Total := Total + I;
end;
WriteLn(Total);
