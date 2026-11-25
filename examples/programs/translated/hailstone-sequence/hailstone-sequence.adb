-- Hailstone sequence in Ada: count the steps to reach 1

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    function Hailstone_Steps (Initial_Number : Long_Long_Integer) return Long_Long_Integer is
        Number : Long_Long_Integer;
        Steps : Long_Long_Integer;
    begin
        Number := Initial_Number;
        Steps := 0;
        while Number /= 1 loop
            if Number rem 2 = 0 then
                Number := Number / 2;
            else
                Number := 3 * Number + 1;
            end if;
            Steps := Steps + 1;
        end loop;
        return Steps;
    end Hailstone_Steps;

begin
    for Number in Long_Long_Integer range 1 .. 10 loop
        Put (Number, 0); Put (" takes "); Put (Hailstone_Steps (Number), 0); Put_Line (" steps");
    end loop;
end Main;
