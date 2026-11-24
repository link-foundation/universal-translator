' Towers of Hanoi in Visual Basic .NET, solved recursively

Module Program
    Sub MoveDisks(count As Long, source As Long, target As Long, spare As Long)
        If count = 0 Then
            Return
        End If
        MoveDisks(count - 1, source, spare, target)
        Console.WriteLine($"Move disk {count} from {source} to {target}")
        MoveDisks(count - 1, spare, target, source)
    End Sub

    Sub Main()
        MoveDisks(4, 1, 3, 2)
    End Sub
End Module
