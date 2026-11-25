-- Fibonacci sequence in Ada, computed iteratively

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    function Fibonacci (Count : Long_Long_Integer) return Long_Long_Integer is
        Previous : Long_Long_Integer;
        Current : Long_Long_Integer;
        Next : Long_Long_Integer;
    begin
        Previous := 0;
        Current := 1;
        for Step in Long_Long_Integer range 0 .. Count - 1 loop
            Next := Previous + Current;
            Previous := Current;
            Current := Next;
        end loop;
        return Previous;
    end Fibonacci;

begin
    for Index in Long_Long_Integer range 0 .. 20 loop
        Put ("fibonacci("); Put (Index, 0); Put (") = "); Put (Fibonacci (Index), 0); New_Line;
    end loop;
end Main;
