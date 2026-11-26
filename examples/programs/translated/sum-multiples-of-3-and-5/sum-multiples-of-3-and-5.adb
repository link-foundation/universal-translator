-- Sum multiples of 3 and 5 in Ada: the sum of the multiples below 1000

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    Total : Long_Long_Integer;

begin
    Total := 0;
    for Number in Long_Long_Integer range 1 .. 999 loop
        if Number rem 3 = 0 or else Number rem 5 = 0 then
            Total := Total + Number;
        end if;
    end loop;
    Put (Total, 0); New_Line;
end Main;
