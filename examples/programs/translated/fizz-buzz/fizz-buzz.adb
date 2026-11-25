-- FizzBuzz in Ada

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

begin
    for Number in Long_Long_Integer range 1 .. 100 loop
        if Number rem 15 = 0 then
            Put_Line ("FizzBuzz");
        elsif Number rem 3 = 0 then
            Put_Line ("Fizz");
        elsif Number rem 5 = 0 then
            Put_Line ("Buzz");
        else
            Put (Number, 0); New_Line;
        end if;
    end loop;
end Main;
