// Towers of Hanoi in Pascal, solved recursively

program Main;

procedure MoveDisks(Count: Int64; Source: Int64; Target: Int64; Spare: Int64);
begin
    if Count = 0 then
    begin
        Exit;
    end;
    MoveDisks(Count - 1, Source, Spare, Target);
    WriteLn('Move disk ', Count, ' from ', Source, ' to ', Target);
    MoveDisks(Count - 1, Spare, Target, Source);
end;

begin
    MoveDisks(4, 1, 3, 2);
end.
