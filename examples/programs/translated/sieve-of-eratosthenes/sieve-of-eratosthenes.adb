-- Sieve of Eratosthenes in Ada: the primes up to 100

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    type Integer_Array is array (Long_Long_Integer range <>) of Long_Long_Integer;

    Limit : Long_Long_Integer;
    Multiple : Long_Long_Integer;

begin
    Limit := 100;
    declare
        Is_Prime : Integer_Array (0 .. Limit) := [others => 1];
    begin
        Is_Prime (0) := 0;
        Is_Prime (1) := 0;
        for Number in Long_Long_Integer range 2 .. Limit loop
            if Is_Prime (Number) = 1 then
                Put (Number, 0); New_Line;
                Multiple := Number * Number;
                while Multiple <= Limit loop
                    Is_Prime (Multiple) := 0;
                    Multiple := Multiple + Number;
                end loop;
            end if;
        end loop;
    end;
end Main;
