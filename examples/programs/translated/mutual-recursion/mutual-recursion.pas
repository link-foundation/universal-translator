// Mutual recursion in Pascal: the Hofstadter Female and Male sequences

program Main;

function Male(Index: Int64): Int64; forward;

function Female(Index: Int64): Int64;
begin
    if Index = 0 then
    begin
        Exit(1);
    end;
    Exit(Index - Male(Female(Index - 1)));
end;

function Male(Index: Int64): Int64;
begin
    if Index = 0 then
    begin
        Exit(0);
    end;
    Exit(Index - Female(Male(Index - 1)));
end;

var
    Index: Int64;

begin
    for Index := 0 to 19 do
    begin
        WriteLn(Index, ': ', Female(Index), ' ', Male(Index));
    end;
end.
