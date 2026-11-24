' Sum digits of an integer in Visual Basic .NET

Module Program
    Function SumOfDigits(number As Long) As Long
        Dim total As Long = 0
        While number > 0
            total += number Mod 10
            number = number \ 10
        End While
        Return total
    End Function

    Sub Main()
        Console.WriteLine($"The digits of 1234567890 sum to {SumOfDigits(1234567890)}")
    End Sub
End Module
