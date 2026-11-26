-- Greatest element of a list in Ada

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    type Integer_Array is array (Long_Long_Integer range <>) of Long_Long_Integer;

    Greatest : Long_Long_Integer;
    Number : Long_Long_Integer;

begin
    declare
        Numbers : constant Integer_Array (0 .. 6) := [17, 4, 93, 28, 65, 3, 80];
    begin
        Greatest := Numbers (0);
        for Index in Long_Long_Integer range 0 .. Numbers'Length - 1 loop
            Number := Numbers (Index);
            if Number > Greatest then
                Greatest := Number;
            end if;
        end loop;
        Put ("The greatest element is "); Put (Greatest, 0); New_Line;
    end;
end Main;
