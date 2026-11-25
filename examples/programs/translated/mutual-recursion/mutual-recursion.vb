' Mutual recursion in Visual Basic .NET: the Hofstadter Female and Male sequences

Module Program
    Function Female(index As Long) As Long
        If index = 0 Then
            Return 1
        End If
        Return index - Male(Female(index - 1))
    End Function

    Function Male(index As Long) As Long
        If index = 0 Then
            Return 0
        End If
        Return index - Female(Male(index - 1))
    End Function

    Sub Main()
        For index As Long = 0 To 19
            Console.WriteLine($"{index}: {Female(index)} {Male(index)}")
        Next
    End Sub
End Module
