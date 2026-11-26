-- Loops/Foreach in Ada: print every element of a collection

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    type Integer_Array is array (Long_Long_Integer range <>) of Long_Long_Integer;

    Number : Long_Long_Integer;

begin
    declare
        Numbers : constant Integer_Array (0 .. 7) := [1, 1, 2, 3, 5, 8, 13, 21];
    begin
        for Index in Long_Long_Integer range 0 .. Numbers'Length - 1 loop
            Number := Numbers (Index);
            Put (Number, 0); New_Line;
        end loop;
    end;
end Main;
