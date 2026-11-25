Function SumOfSquares(limit As Long) As Long
    Dim total As Long = 0
    For i As Long = 1 To limit
        total += Square(i)
    Next
    Return total
End Function

Function Square(value As Long) As Long
    Return value * value
End Function
