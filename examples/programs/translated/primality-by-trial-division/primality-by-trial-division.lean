-- Primality by trial division in Lean

partial def isPrime (number : Int) : Bool := Id.run do
  if number < 2 then
    return false
  let mut divisor : Int := 2
  while divisor * divisor <= number do
    if Int.tmod number divisor == 0 then
      return false
    divisor := divisor + 1
  return true

def main : IO Unit := do
  for number in (1 : Int)...<51 do
    if isPrime number then
      IO.println number
