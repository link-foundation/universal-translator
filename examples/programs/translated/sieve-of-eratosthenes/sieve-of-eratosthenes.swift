// Sieve of Eratosthenes in Swift: the primes up to 100

let limit = 100
var isPrime = [Int](repeating: 1, count: limit + 1)
isPrime[0] = 0
isPrime[1] = 0
for number in 2..<limit + 1 {
    if isPrime[number] == 1 {
        print(number)
        var multiple = number * number
        while multiple <= limit {
            isPrime[multiple] = 0
            multiple += number
        }
    }
}
