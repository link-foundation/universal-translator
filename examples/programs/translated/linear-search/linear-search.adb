-- Linear search in Ada: find the position of a value in a list

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    type Integer_Array is array (Long_Long_Integer range <>) of Long_Long_Integer;

    Wanted : Long_Long_Integer;
    Position : Long_Long_Integer;
    Current : Long_Long_Integer;
    Number : Long_Long_Integer;

begin
    declare
        Numbers : constant Integer_Array (0 .. 7) := [31, 41, 59, 26, 53, 58, 97, 93];
    begin
        Wanted := 53;
        Position := -1;
        Current := 0;
        for Index in Long_Long_Integer range 0 .. Numbers'Length - 1 loop
            Number := Numbers (Index);
            if Number = Wanted and then Position < 0 then
                Position := Current;
            end if;
            Current := Current + 1;
        end loop;
        Put ("Found "); Put (Wanted, 0); Put (" at position "); Put (Position, 0); New_Line;
    end;
end Main;
