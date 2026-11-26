' Greatest element of a list in Visual Basic .NET

Module Program
    Sub Main()
        Dim numbers As Long() = {17, 4, 93, 28, 65, 3, 80}
        Dim greatest As Long = numbers(0)
        For index As Long = 0 To numbers.Length - 1
            Dim number As Long = numbers(index)
            If number > greatest Then
                greatest = number
            End If
        Next
        Console.WriteLine($"The greatest element is {greatest}")
    End Sub
End Module
