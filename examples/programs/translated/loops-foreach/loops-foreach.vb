' Loops/Foreach in Visual Basic .NET: print every element of a collection

Module Program
    Sub Main()
        Dim numbers As Long() = {1, 1, 2, 3, 5, 8, 13, 21}
        For index As Long = 0 To numbers.Length - 1
            Dim number As Long = numbers(index)
            Console.WriteLine(number)
        Next
    End Sub
End Module
