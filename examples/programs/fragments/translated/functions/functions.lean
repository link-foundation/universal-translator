partial def sumOfSquares (limit : Int) : Int := Id.run do
  let mut total : Int := 0
  for i in (1 : Int)...<limit + 1 do
    total := total + square i
  return total

partial def square (value : Int) : Int := Id.run do
  return value * value
