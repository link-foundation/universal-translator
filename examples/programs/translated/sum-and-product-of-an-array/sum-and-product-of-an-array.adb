-- Sum and product of an array in Ada

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    type Integer_Array is array (Long_Long_Integer range <>) of Long_Long_Integer;

    Total : Long_Long_Integer;
    Product : Long_Long_Integer;

begin
    declare
        Numbers : Integer_Array (0 .. 4) := (1, 2, 3, 4, 5);
    begin
        Total := 0;
        Product := 1;
        for Index in Long_Long_Integer range 0 .. Numbers'Length - 1 loop
            Total := Total + Numbers (Index);
            Product := Product * Numbers (Index);
        end loop;
        Put ("Sum: "); Put (Total, 0); New_Line;
        Put ("Product: "); Put (Product, 0); New_Line;
    end;
end Main;
