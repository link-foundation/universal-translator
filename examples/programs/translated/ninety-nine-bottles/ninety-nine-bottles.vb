' 99 bottles of beer in Visual Basic .NET

Module Program
    Sub Main()
        Dim bottles As Long = 99
        While bottles > 0
            Console.WriteLine($"{bottles} bottles of beer on the wall, {bottles} bottles of beer.")
            Console.WriteLine($"Take one down and pass it around, {bottles - 1} bottles of beer on the wall.")
            bottles -= 1
        End While
    End Sub
End Module
