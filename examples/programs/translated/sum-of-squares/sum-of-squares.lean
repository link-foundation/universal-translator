-- Sum of squares in Lean

partial def sumOfSquares (limit : Int) : Int := Id.run do
  let mut total : Int := 0
  let mut number : Int := 1
  while number <= limit do
    total := total + number * number
    number := number + 1
  return total

def main : IO Unit := do
  let limit : Int := 10
  IO.println s!"Sum of squares from 1 to {limit}:"
  IO.println (sumOfSquares limit)
