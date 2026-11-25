with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    function Square (Value : Long_Long_Integer) return Long_Long_Integer is
    begin
        return Value * Value;
    end Square;

begin
    Put (Square (4), 0); New_Line;
end Main;
