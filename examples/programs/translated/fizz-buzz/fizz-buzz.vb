' FizzBuzz in Visual Basic .NET

Module Program
    Sub Main()
        For number As Long = 1 To 100
            If number Mod 15 = 0 Then
                Console.WriteLine("FizzBuzz")
            ElseIf number Mod 3 = 0 Then
                Console.WriteLine("Fizz")
            ElseIf number Mod 5 = 0 Then
                Console.WriteLine("Buzz")
            Else
                Console.WriteLine(number)
            End If
        Next
    End Sub
End Module
