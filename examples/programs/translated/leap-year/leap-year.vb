' Leap year in Visual Basic .NET

Module Program
    Function IsLeapYear(year As Long) As Boolean
        Return (year Mod 4 = 0 AndAlso year Mod 100 <> 0) OrElse year Mod 400 = 0
    End Function

    Sub Main()
        For year As Long = 1896 To 1912
            If IsLeapYear(year) Then
                Console.WriteLine($"{year} is a leap year")
            Else
                Console.WriteLine($"{year} is not a leap year")
            End If
        Next
    End Sub
End Module
