-- Leap year in Ada

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    function Is_Leap_Year (Year : Long_Long_Integer) return Boolean is
    begin
        return (Year rem 4 = 0 and then Year rem 100 /= 0) or else Year rem 400 = 0;
    end Is_Leap_Year;

begin
    for Year in Long_Long_Integer range 1896 .. 1912 loop
        if Is_Leap_Year (Year) then
            Put (Year, 0); Put_Line (" is a leap year");
        else
            Put (Year, 0); Put_Line (" is not a leap year");
        end if;
    end loop;
end Main;
