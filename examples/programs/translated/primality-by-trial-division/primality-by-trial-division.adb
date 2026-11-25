-- Primality by trial division in Ada

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    function Is_Prime (Number : Long_Long_Integer) return Boolean is
        Divisor : Long_Long_Integer;
    begin
        if Number < 2 then
            return False;
        end if;
        Divisor := 2;
        while Divisor * Divisor <= Number loop
            if Number rem Divisor = 0 then
                return False;
            end if;
            Divisor := Divisor + 1;
        end loop;
        return True;
    end Is_Prime;

begin
    for Number in Long_Long_Integer range 1 .. 50 loop
        if Is_Prime (Number) then
            Put (Number, 0); New_Line;
        end if;
    end loop;
end Main;
