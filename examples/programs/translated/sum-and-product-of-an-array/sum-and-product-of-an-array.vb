' Sum and product of an array in Visual Basic .NET

Module Program
    Sub Main()
        Dim numbers As Long() = {1, 2, 3, 4, 5}
        Dim total As Long = 0
        Dim product As Long = 1
        For index As Long = 0 To numbers.Length - 1
            total += numbers(index)
            product *= numbers(index)
        Next
        Console.WriteLine($"Sum: {total}")
        Console.WriteLine($"Product: {product}")
    End Sub
End Module
