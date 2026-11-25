-- Ackermann subprogram in Ada, defined recursively

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    function Ackermann (First : Long_Long_Integer; Second : Long_Long_Integer) return Long_Long_Integer is
    begin
        if First = 0 then
            return Second + 1;
        end if;
        if Second = 0 then
            return Ackermann (First - 1, 1);
        end if;
        return Ackermann (First - 1, Ackermann (First, Second - 1));
    end Ackermann;

begin
    for First in Long_Long_Integer range 0 .. 3 loop
        for Second in Long_Long_Integer range 0 .. 4 loop
            Put ("ackermann("); Put (First, 0); Put (", "); Put (Second, 0); Put (") = "); Put (Ackermann (First, Second), 0); New_Line;
        end loop;
    end loop;
end Main;
