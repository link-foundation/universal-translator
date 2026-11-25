-- Factorial in Lean, defined recursively

partial def factorial (number : Int) : Int := Id.run do
  if number <= 1 then
    return 1
  return number * (factorial (number - 1))

def main : IO Unit := do
  for number in (0 : Int)...<11 do
    IO.println s!"{number}! = {factorial number}"
