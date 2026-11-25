' Sieve of Eratosthenes in Visual Basic .NET: the primes up to 100

Module Program
    Sub Main()
        Dim limit As Long = 100
        Dim isPrime(limit) As Long
        For index As Long = 0 To limit
            isPrime(index) = 1
        Next
        isPrime(0) = 0
        isPrime(1) = 0
        For number As Long = 2 To limit
            If isPrime(number) = 1 Then
                Console.WriteLine(number)
                Dim multiple As Long = number * number
                While multiple <= limit
                    isPrime(multiple) = 0
                    multiple += number
                End While
            End If
        Next
    End Sub
End Module
