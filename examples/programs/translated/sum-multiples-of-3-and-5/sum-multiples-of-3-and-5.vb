' Sum multiples of 3 and 5 in Visual Basic .NET: the sum of the multiples below 1000

Module Program
    Sub Main()
        Dim total As Long = 0
        For number As Long = 1 To 999
            If number Mod 3 = 0 OrElse number Mod 5 = 0 Then
                total += number
            End If
        Next
        Console.WriteLine(total)
    End Sub
End Module
