' Factorial in Visual Basic .NET, defined recursively

Module Program
    Function Factorial(number As Long) As Long
        If number <= 1 Then
            Return 1
        End If
        Return number * Factorial(number - 1)
    End Function

    Sub Main()
        For number As Long = 0 To 10
            Console.WriteLine($"{number}! = {Factorial(number)}")
        Next
    End Sub
End Module
