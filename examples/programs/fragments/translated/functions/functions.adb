function Square (Value : Long_Long_Integer) return Long_Long_Integer;

function Sum_Of_Squares (Limit : Long_Long_Integer) return Long_Long_Integer is
    Total : Long_Long_Integer;
begin
    Total := 0;
    for I in Long_Long_Integer range 1 .. Limit loop
        Total := Total + Square (I);
    end loop;
    return Total;
end Sum_Of_Squares;

function Square (Value : Long_Long_Integer) return Long_Long_Integer is
begin
    return Value * Value;
end Square;
