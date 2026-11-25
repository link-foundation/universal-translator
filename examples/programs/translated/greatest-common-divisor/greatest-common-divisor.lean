-- Greatest common divisor in Lean, using the Euclidean algorithm

partial def greatestCommonDivisor (first : Int) (second : Int) : Int := Id.run do
  let mut first : Int := first
  let mut second : Int := second
  while second != 0 do
    let remainder : Int := Int.tmod first second
    first := second
    second := remainder
  return first

def main : IO Unit := do
  IO.println s!"The greatest common divisor of 1071 and 462 is {greatestCommonDivisor 1071 462}"
