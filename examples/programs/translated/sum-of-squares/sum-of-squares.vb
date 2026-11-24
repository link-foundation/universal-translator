' Sum of squares in Visual Basic .NET

Module Program
    Function SumOfSquares(limit As Long) As Long
        Dim total As Long = 0
        Dim number As Long = 1
        While number <= limit
            total += number * number
            number += 1
        End While
        Return total
    End Function

    Sub Main()
        Dim limit As Long = 10
        Console.WriteLine($"Sum of squares from 1 to {limit}:")
        Console.WriteLine(SumOfSquares(limit))
    End Sub
End Module
