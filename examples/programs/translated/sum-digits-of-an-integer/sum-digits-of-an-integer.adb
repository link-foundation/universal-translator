-- Sum digits of an integer in Ada

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    function Sum_Of_Digits (Initial_Number : Long_Long_Integer) return Long_Long_Integer is
        Number : Long_Long_Integer;
        Total : Long_Long_Integer;
    begin
        Number := Initial_Number;
        Total := 0;
        while Number > 0 loop
            Total := Total + Number rem 10;
            Number := Number / 10;
        end loop;
        return Total;
    end Sum_Of_Digits;

begin
    Put ("The digits of 1234567890 sum to "); Put (Sum_Of_Digits (1234567890), 0); New_Line;
end Main;
