-- Sum digits of an integer in Lean

partial def sumOfDigits (number : Int) : Int := Id.run do
  let mut number : Int := number
  let mut total : Int := 0
  while number > 0 do
    total := total + Int.tmod number 10
    number := Int.tdiv number 10
  return total

def main : IO Unit := do
  IO.println s!"The digits of 1234567890 sum to {sumOfDigits 1234567890}"
