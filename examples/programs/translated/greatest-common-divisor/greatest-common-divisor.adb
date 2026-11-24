-- Greatest common divisor in Ada, using the Euclidean algorithm

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    function Greatest_Common_Divisor (Initial_First : Long_Long_Integer; Initial_Second : Long_Long_Integer) return Long_Long_Integer is
        First : Long_Long_Integer;
        Second : Long_Long_Integer;
        Remainder : Long_Long_Integer;
    begin
        First := Initial_First;
        Second := Initial_Second;
        while Second /= 0 loop
            Remainder := First rem Second;
            First := Second;
            Second := Remainder;
        end loop;
        return First;
    end Greatest_Common_Divisor;

begin
    Put ("The greatest common divisor of 1071 and 462 is "); Put (Greatest_Common_Divisor (1071, 462), 0); New_Line;
end Main;
