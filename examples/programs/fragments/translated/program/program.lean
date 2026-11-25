partial def square (value : Int) : Int := Id.run do
  return value * value

def main : IO Unit := do
  IO.println (square 4)
