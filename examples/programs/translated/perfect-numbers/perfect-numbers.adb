-- Perfect numbers in Ada: numbers equal to the sum of their divisors

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    function Is_Perfect (Number : Long_Long_Integer) return Boolean is
        Sum : Long_Long_Integer;
        Divisor : Long_Long_Integer;
    begin
        Sum := 1;
        Divisor := 2;
        while Divisor * Divisor <= Number loop
            if Number rem Divisor = 0 then
                Sum := Sum + Divisor;
                if Divisor * Divisor /= Number then
                    Sum := Sum + Number / Divisor;
                end if;
            end if;
            Divisor := Divisor + 1;
        end loop;
        return Number > 1 and then Sum = Number;
    end Is_Perfect;

begin
    for Number in Long_Long_Integer range 1 .. 10000 loop
        if Is_Perfect (Number) then
            Put (Number, 0); New_Line;
        end if;
    end loop;
end Main;
