// Sieve of Eratosthenes in Pascal: the primes up to 100

program Main;

var
    Limit: Int64;
    IsPrime: array of Int64;
    Index: Int64;
    Number: Int64;
    Multiple: Int64;

begin
    Limit := 100;
    SetLength(IsPrime, Limit + 1);
    for Index := 0 to Limit do
    begin
        IsPrime[Index] := 1;
    end;
    IsPrime[0] := 0;
    IsPrime[1] := 0;
    for Number := 2 to Limit do
    begin
        if IsPrime[Number] = 1 then
        begin
            WriteLn(Number);
            Multiple := Number * Number;
            while Multiple <= Limit do
            begin
                IsPrime[Multiple] := 0;
                Multiple := Multiple + Number;
            end;
        end;
    end;
end.
