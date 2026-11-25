-- FizzBuzz in Lean

def main : IO Unit := do
  for number in (1 : Int)...<101 do
    if Int.tmod number 15 == 0 then
      IO.println "FizzBuzz"
    else if Int.tmod number 3 == 0 then
      IO.println "Fizz"
    else if Int.tmod number 5 == 0 then
      IO.println "Buzz"
    else
      IO.println number
