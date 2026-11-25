-- Sum of squares in Ada

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    function Sum_Of_Squares (Limit : Long_Long_Integer) return Long_Long_Integer is
        Total : Long_Long_Integer;
        Number : Long_Long_Integer;
    begin
        Total := 0;
        Number := 1;
        while Number <= Limit loop
            Total := Total + Number * Number;
            Number := Number + 1;
        end loop;
        return Total;
    end Sum_Of_Squares;

    Limit : Long_Long_Integer;

begin
    Limit := 10;
    Put ("Sum of squares from 1 to "); Put (Limit, 0); Put_Line (":");
    Put (Sum_Of_Squares (Limit), 0); New_Line;
end Main;
