-- Towers of Hanoi in Ada, solved recursively

with Ada.Text_IO; use Ada.Text_IO;

procedure Main is
    package Long_IO is new Integer_IO (Long_Long_Integer); use Long_IO;

    procedure Move_Disks (Count : Long_Long_Integer; Source : Long_Long_Integer; Target : Long_Long_Integer; Spare : Long_Long_Integer) is
    begin
        if Count = 0 then
            return;
        end if;
        Move_Disks (Count - 1, Source, Spare, Target);
        Put ("Move disk "); Put (Count, 0); Put (" from "); Put (Source, 0); Put (" to "); Put (Target, 0); New_Line;
        Move_Disks (Count - 1, Spare, Target, Source);
    end Move_Disks;

begin
    Move_Disks (4, 1, 3, 2);
end Main;
