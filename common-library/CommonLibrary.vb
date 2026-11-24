' Standard-output operations of the common library for Visual Basic .NET.
Module CommonLibrary
    Sub PrintLine(text As String)
        Console.Write(text & vbLf)
    End Sub

    Sub WriteText(text As String)
        Console.Write(text)
    End Sub

    Sub WriteInteger(number As Long)
        Console.Write(number)
    End Sub

    Sub EndLine()
        Console.Write(vbLf)
    End Sub
End Module
