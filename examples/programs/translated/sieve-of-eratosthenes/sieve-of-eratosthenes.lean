-- Sieve of Eratosthenes in Lean: the primes up to 100

def main : IO Unit := do
  let limit : Int := 100
  let mut isPrime : Array Int := Array.replicate (Int.toNat (limit + 1)) 1
  isPrime := isPrime.set! 0 0
  isPrime := isPrime.set! 1 0
  for number in (2 : Int)...<limit + 1 do
    if isPrime[Int.toNat number]! == 1 then
      IO.println number
      let mut multiple : Int := number * number
      while multiple <= limit do
        isPrime := isPrime.set! (Int.toNat multiple) 0
        multiple := multiple + number
