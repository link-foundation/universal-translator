# Sum multiples of 3 and 5 in Nim: the sum of the multiples below 1000

var total = 0
for number in 1 ..< 1000:
    if number mod 3 == 0 or number mod 5 == 0:
        total += number
echo total
