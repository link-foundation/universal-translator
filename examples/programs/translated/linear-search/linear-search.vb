' Linear search in Visual Basic .NET: find the position of a value in a list

Module Program
    Sub Main()
        Dim numbers As Long() = {31, 41, 59, 26, 53, 58, 97, 93}
        Dim wanted As Long = 53
        Dim position As Long = -1
        Dim current As Long = 0
        For index As Long = 0 To numbers.Length - 1
            Dim number As Long = numbers(index)
            If number = wanted AndAlso position < 0 Then
                position = current
            End If
            current += 1
        Next
        Console.WriteLine($"Found {wanted} at position {position}")
    End Sub
End Module
