-- Factorial in Ada, defined recursively

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    function Factorial (Number : Long_Long_Integer) return Long_Long_Integer is
    begin
        if Number <= 1 then
            return 1;
        end if;
        return Number * Factorial (Number - 1);
    end Factorial;

begin
    for Number in Long_Long_Integer range 0 .. 10 loop
        Put (Number, 0); Put ("! = "); Put (Factorial (Number), 0); New_Line;
    end loop;
end Main;
