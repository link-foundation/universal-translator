-- Bubble sort in Ada: sort a list of numbers

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    type Integer_Array is array (Long_Long_Integer range <>) of Long_Long_Integer;

    Count : Long_Long_Integer;
    Swap : Long_Long_Integer;

begin
    declare
        Numbers : Integer_Array (0 .. 6) := [5, 3, 8, 1, 9, 2, 7];
    begin
        Count := Numbers'Length;
        for Pass in Long_Long_Integer range 0 .. Count - 1 - 1 loop
            for Index in Long_Long_Integer range 0 .. Count - 1 - Pass - 1 loop
                if Numbers (Index) > Numbers (Index + 1) then
                    Swap := Numbers (Index);
                    Numbers (Index) := Numbers (Index + 1);
                    Numbers (Index + 1) := Swap;
                end if;
            end loop;
        end loop;
        for Position in Long_Long_Integer range 0 .. Count - 1 loop
            Put (Numbers (Position), 0); New_Line;
        end loop;
    end;
end Main;
