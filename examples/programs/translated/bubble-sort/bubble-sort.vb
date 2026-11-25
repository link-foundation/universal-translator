' Bubble sort in Visual Basic .NET: sort a list of numbers

Module Program
    Sub Main()
        Dim numbers As Long() = {5, 3, 8, 1, 9, 2, 7}
        Dim count As Long = numbers.Length
        For pass As Long = 0 To count - 1 - 1
            For index As Long = 0 To count - 1 - pass - 1
                If numbers(index) > numbers(index + 1) Then
                    Dim swap As Long = numbers(index)
                    numbers(index) = numbers(index + 1)
                    numbers(index + 1) = swap
                End If
            Next
        Next
        For position As Long = 0 To count - 1
            Console.WriteLine(numbers(position))
        Next
    End Sub
End Module
