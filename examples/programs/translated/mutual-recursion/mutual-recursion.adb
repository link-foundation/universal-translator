-- Mutual recursion in Ada: the Hofstadter Female and Male sequences

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    function Male (Index : Long_Long_Integer) return Long_Long_Integer;

    function Female (Index : Long_Long_Integer) return Long_Long_Integer is
    begin
        if Index = 0 then
            return 1;
        end if;
        return Index - Male (Female (Index - 1));
    end Female;

    function Male (Index : Long_Long_Integer) return Long_Long_Integer is
    begin
        if Index = 0 then
            return 0;
        end if;
        return Index - Female (Male (Index - 1));
    end Male;

begin
    for Index in Long_Long_Integer range 0 .. 19 loop
        Put (Index, 0); Put (": "); Put (Female (Index), 0); Put (" "); Put (Male (Index), 0); New_Line;
    end loop;
end Main;
