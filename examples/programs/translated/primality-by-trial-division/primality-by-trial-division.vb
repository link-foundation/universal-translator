' Primality by trial division in Visual Basic .NET

Module Program
    Function IsPrime(number As Long) As Boolean
        If number < 2 Then
            Return False
        End If
        Dim divisor As Long = 2
        While divisor * divisor <= number
            If number Mod divisor = 0 Then
                Return False
            End If
            divisor += 1
        End While
        Return True
    End Function

    Sub Main()
        For number As Long = 1 To 50
            If IsPrime(number) Then
                Console.WriteLine(number)
            End If
        Next
    End Sub
End Module
