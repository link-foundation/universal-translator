' Greatest common divisor in Visual Basic .NET, using the Euclidean algorithm

Module Program
    Function GreatestCommonDivisor(first As Long, second As Long) As Long
        While second <> 0
            Dim remainder As Long = first Mod second
            first = second
            second = remainder
        End While
        Return first
    End Function

    Sub Main()
        Console.WriteLine($"The greatest common divisor of 1071 and 462 is {GreatestCommonDivisor(1071, 462)}")
    End Sub
End Module
