-- Perfect numbers in Lean: numbers equal to the sum of their divisors

partial def isPerfect (number : Int) : Bool := Id.run do
  let mut sum : Int := 1
  let mut divisor : Int := 2
  while divisor * divisor <= number do
    if Int.tmod number divisor == 0 then
      sum := sum + divisor
      if divisor * divisor != number then
        sum := sum + Int.tdiv number divisor
    divisor := divisor + 1
  return number > 1 && sum == number

def main : IO Unit := do
  for number in (1 : Int)...<10001 do
    if isPerfect number then
      IO.println number
