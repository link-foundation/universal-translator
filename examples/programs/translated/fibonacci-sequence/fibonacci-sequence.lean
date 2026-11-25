-- Fibonacci sequence in Lean, computed iteratively

partial def fibonacci (count : Int) : Int := Id.run do
  let mut previous : Int := 0
  let mut current : Int := 1
  for step in (0 : Int)...<count do
    let next : Int := previous + current
    previous := current
    current := next
  return previous

def main : IO Unit := do
  for index in (0 : Int)...<21 do
    IO.println s!"fibonacci({index}) = {fibonacci index}"
