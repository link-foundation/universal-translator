# FizzBuzz in Nim

for number in 1 ..< 101:
    if number mod 15 == 0:
        echo "FizzBuzz"
    elif number mod 3 == 0:
        echo "Fizz"
    elif number mod 5 == 0:
        echo "Buzz"
    else:
        echo number
