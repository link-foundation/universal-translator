' Ackermann procedure in Visual Basic .NET, defined recursively

Module Program
    Function Ackermann(first As Long, second As Long) As Long
        If first = 0 Then
            Return second + 1
        End If
        If second = 0 Then
            Return Ackermann(first - 1, 1)
        End If
        Return Ackermann(first - 1, Ackermann(first, second - 1))
    End Function

    Sub Main()
        For first As Long = 0 To 3
            For second As Long = 0 To 4
                Console.WriteLine($"ackermann({first}, {second}) = {Ackermann(first, second)}")
            Next
        Next
    End Sub
End Module
