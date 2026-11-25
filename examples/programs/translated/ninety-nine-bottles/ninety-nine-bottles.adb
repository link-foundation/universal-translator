-- 99 bottles of beer in Ada

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    Bottles : Long_Long_Integer;

begin
    Bottles := 99;
    while Bottles > 0 loop
        Put (Bottles, 0); Put (" bottles of beer on the wall, "); Put (Bottles, 0); Put_Line (" bottles of beer.");
        Put ("Take one down and pass it around, "); Put (Bottles - 1, 0); Put_Line (" bottles of beer on the wall.");
        Bottles := Bottles - 1;
    end loop;
end Main;
