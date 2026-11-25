' Perfect numbers in Visual Basic .NET: numbers equal to the sum of their divisors

Module Program
    Function IsPerfect(number As Long) As Boolean
        Dim sum As Long = 1
        Dim divisor As Long = 2
        While divisor * divisor <= number
            If number Mod divisor = 0 Then
                sum += divisor
                If divisor * divisor <> number Then
                    sum += number \ divisor
                End If
            End If
            divisor += 1
        End While
        Return number > 1 AndAlso sum = number
    End Function

    Sub Main()
        For number As Long = 1 To 10000
            If IsPerfect(number) Then
                Console.WriteLine(number)
            End If
        Next
    End Sub
End Module
