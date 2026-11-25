Total : Long_Long_Integer;

Total := 0;
for I in Long_Long_Integer range 0 .. 9 loop
    Total := Total + I;
end loop;
Put (Total, 0); New_Line;
