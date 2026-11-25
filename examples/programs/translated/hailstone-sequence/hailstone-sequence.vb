' Hailstone sequence in Visual Basic .NET: count the steps to reach 1

Module Program
    Function HailstoneSteps(number As Long) As Long
        Dim steps As Long = 0
        While number <> 1
            If number Mod 2 = 0 Then
                number = number \ 2
            Else
                number = 3 * number + 1
            End If
            steps += 1
        End While
        Return steps
    End Function

    Sub Main()
        For number As Long = 1 To 10
            Console.WriteLine($"{number} takes {HailstoneSteps(number)} steps")
        Next
    End Sub
End Module
