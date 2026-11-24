' Fibonacci sequence in Visual Basic .NET, computed iteratively

Module Program
    Function Fibonacci(count As Long) As Long
        Dim previous As Long = 0
        Dim current As Long = 1
        For step_ As Long = 0 To count - 1
            Dim next_ As Long = previous + current
            previous = current
            current = next_
        Next
        Return previous
    End Function

    Sub Main()
        For index As Long = 0 To 20
            Console.WriteLine($"fibonacci({index}) = {Fibonacci(index)}")
        Next
    End Sub
End Module
